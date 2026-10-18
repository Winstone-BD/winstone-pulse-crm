/**
 * Durable transcription + AI analysis queue.
 *
 * Recording rows carry their own state machine so nothing is ever lost:
 *   pending -> processing -> completed | failed | not_available
 *
 * `analysis_attempts` + `analysis_error` make retries visible; the sweep is
 * idempotent and safe to call from the upload route, the IT Console and cron.
 */
const MAX_ATTEMPTS = 5;
import { analysisLeaseExpired } from "./recording-recovery";

export type AnalysisState = "pending" | "processing" | "completed" | "failed" | "not_available";

export async function analyzePending(limit = 3) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: rows } = await supabaseAdmin
    .from("call_recordings")
    .select("id, analysis_status, analysis_attempts, lead_id, agent_id")
    .in("analysis_status", ["pending", "failed"])
    .lt("analysis_attempts", MAX_ATTEMPTS)
    .order("created_at", { ascending: true })
    .limit(limit);

  const results: { id: string; status: AnalysisState }[] = [];
  for (const row of rows ?? []) {
    results.push({ id: row.id, status: await analyzeOne(row.id) });
  }
  return results;
}

export async function analyzeOne(recordingId: string): Promise<AnalysisState> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { processRecording } = await import("@/lib/call-intel.server");
  const { logLeadEvent } = await import("@/lib/lead-events.server");
  const { upsertCallJob } = await import("@/lib/call-jobs.server");

  const { data: row } = await supabaseAdmin
    .from("call_recordings")
    .select("id, lead_id, agent_id, analysis_attempts, audio_url, storage_path, analysis_status, updated_at")
    .eq("id", recordingId)
    .maybeSingle();
  if (!row) return "failed";
  if (row.analysis_status === "completed") return "completed";
  if (row.analysis_status === "processing" && !analysisLeaseExpired(row.updated_at)) return "processing";

  if (!row.audio_url && !row.storage_path) {
    await supabaseAdmin
      .from("call_recordings")
      .update({
        analysis_status: "not_available",
        analysis_error: "no audio file",
        recording_status: "not_available",
      })
      .eq("id", recordingId);
    await upsertCallJob({
      recordingId,
      jobType: "transcription",
      status: "failed",
      errorMessage: "no audio file",
    });
    return "not_available";
  }

  const attempts = (row.analysis_attempts ?? 0) + 1;
  const { data: claimed, error: claimError } = await supabaseAdmin
    .from("call_recordings")
    .update({ analysis_status: "processing", analysis_attempts: attempts })
    .eq("id", recordingId)
    .eq("updated_at", row.updated_at)
    .eq("analysis_status", row.analysis_status)
    .select("id")
    .maybeSingle();
  if (claimError) throw new Error(claimError.message);
  if (!claimed) return "processing";
  await upsertCallJob({
    recordingId,
    jobType: "transcription",
    status: "processing",
    countAttempt: true,
  });

  try {
    const outcome = await processRecording(recordingId);
    if (outcome === "empty") {
      // Silence in the file is permanent: re-running the same audio only spends
      // credits. The call stays truthful as "no speech in the recording" and the
      // agent's own submitted report remains HQ's source for this call.
      await supabaseAdmin
        .from("call_recordings")
        .update({
          analysis_status: "not_available",
          analysis_error: "রেকর্ডিংয়ে কথা পাওয়া যায়নি — এজেন্টের রিপোর্টই এই কলের সূত্র",
          recording_status: "not_available",
        })
        .eq("id", recordingId);
      await upsertCallJob({
        recordingId,
        jobType: "transcription",
        status: "failed",
        errorMessage: "no speech detected in recording",
      });
      await logLeadEvent({
        leadId: row.lead_id,
        agentId: row.agent_id,
        recordingId,
        kind: "transcript_failed",
        detail: "রেকর্ডিংয়ে কথা পাওয়া যায়নি — এজেন্টের জমা দেওয়া রিপোর্ট থেকেই সারসংক্ষেপ হবে",
      });
      return "not_available";
    }

    await supabaseAdmin
      .from("call_recordings")
      .update({ analysis_status: "completed", analysis_error: null })
      .eq("id", recordingId);
    await upsertCallJob({ recordingId, jobType: "transcription", status: "completed" });
    await upsertCallJob({ recordingId, jobType: "ai_analysis", status: "completed" });
    await logLeadEvent({
      leadId: row.lead_id,
      agentId: row.agent_id,
      recordingId,
      kind: "transcript_ready",
      detail: "ট্রান্সক্রিপ্ট ও এআই বিশ্লেষণ তৈরি",
    });
    return "completed";
  } catch (error) {
    const message = error instanceof Error ? error.message : "analysis failed";
    await supabaseAdmin
      .from("call_recordings")
      .update({
        analysis_status: attempts >= MAX_ATTEMPTS ? "not_available" : "failed",
        analysis_error: message.slice(0, 500),
      })
      .eq("id", recordingId);
    await upsertCallJob({
      recordingId,
      jobType: "transcription",
      status: "failed",
      errorMessage: message,
    });
    await logLeadEvent({
      leadId: row.lead_id,
      agentId: row.agent_id,
      recordingId,
      kind: "transcript_failed",
      detail: `এআই বিশ্লেষণ ব্যর্থ (চেষ্টা ${attempts}) — আবার চেষ্টা হবে`,
    });
    return attempts >= MAX_ATTEMPTS ? "not_available" : "failed";
  }
}
