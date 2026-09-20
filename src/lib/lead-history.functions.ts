import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/**
 * One lead's full call history for Lead 360.
 *
 * Every submitted call report is a call — that is the canonical source for
 * "a call happened" across the whole CRM. A recording file is extra evidence
 * attached to the same call when the phone managed to sync the audio, and the
 * AI summary/sentiment is extra again, only shown once the analysis actually
 * completed. Nothing here is inferred: a missing recording says so, and a
 * pending analysis says so.
 */
const Input = z.object({
  token: z.string().nullable().optional(),
  leadId: z.string().uuid(),
});

export type LeadCallRecordingEvidence = {
  id: string;
  hasAudio: boolean;
  durationSeconds: number;
  isTwoSided: boolean;
  syncStatus: string;
  analysisStatus: string | null;
  aiSummary: string | null;
  sentiment: string | null;
  aiIntent: string | null;
  aiNextAction: string | null;
  transcriptionText: string | null;
  createdAt: string;
};

export type LeadCall = {
  id: string;
  at: string;
  /** Verified by the phone's own record — the same rule every KPI uses. */
  connected: boolean;
  /** Proven talk seconds, or null when the phone measured nothing. */
  verifiedSeconds: number | null;
  durationSeconds: number;
  category: string | null;
  summary: string | null;
  note: string | null;
  reason: string | null;
  temperature: string | null;
  grade: string | null;
  followUpAt: string | null;
  agentId: string | null;
  recording: LeadCallRecordingEvidence | null;
};

export const getLeadCallHistory = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => Input.parse(input ?? {}))
  .handler(async ({ data }): Promise<{ calls: LeadCall[]; orphanRecordings: LeadCallRecordingEvidence[] }> => {
    const { resolveCaller } = await import("@/lib/access.server");
    const caller = await resolveCaller(data.token ?? null);
    if (caller.scope === "none") return { calls: [], orphanRecordings: [] };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    if (caller.scope === "agent" && caller.profile) {
      // An agent only sees the history of a lead that is on their own desk.
      const { data: lead } = await supabaseAdmin
        .from("leads")
        .select("assigned_to, assigned_agent_id")
        .eq("id", data.leadId)
        .maybeSingle();
      const owner = lead?.assigned_to ?? lead?.assigned_agent_id ?? null;
      if (owner !== caller.profile.id) return { calls: [], orphanRecordings: [] };
    }

    const [reports, recordings] = await Promise.all([
      supabaseAdmin
        .from("call_reports")
        .select(
          "id, agent_id, connected, connection_verified, duration_seconds, category, summary, note, reason, temperature, grade, follow_up_at, recording_id, call_started_at, call_ended_at, submitted_at, created_at",
        )
        .eq("lead_id", data.leadId)
        .eq("status", "submitted")
        .order("created_at", { ascending: true })
        .limit(200),
      supabaseAdmin
        .from("call_recordings")
        .select(
          "id, audio_url, duration_seconds, is_two_sided, sync_status, analysis_status, ai_summary, sentiment, ai_intent, ai_next_action, transcription_text, created_at",
        )
        .eq("lead_id", data.leadId)
        .order("created_at", { ascending: true })
        .limit(200),
    ]);

    const evidence = (row: NonNullable<typeof recordings.data>[number]): LeadCallRecordingEvidence => ({
      id: row.id,
      hasAudio: Boolean(row.audio_url),
      durationSeconds: row.duration_seconds ?? 0,
      isTwoSided: Boolean(row.is_two_sided),
      syncStatus: row.sync_status ?? "uploaded",
      analysisStatus: row.analysis_status ?? null,
      aiSummary: row.ai_summary ?? null,
      sentiment: row.sentiment ?? null,
      aiIntent: row.ai_intent ?? null,
      aiNextAction: row.ai_next_action ?? null,
      transcriptionText: row.transcription_text ?? null,
      createdAt: row.created_at,
    });

    const byId = new Map((recordings.data ?? []).map((row) => [row.id, evidence(row)]));
    const attached = new Set<string>();

    // One row per call session, and the connection state comes from the shared
    // rule — Lead 360 must not call a conversation "কথা হয়েছে" when the desk,
    // HQ and the daily report count the same call as "কেউ ধরেনি".
    const { canonicalCallsOf, reportConnected } = await import("@/lib/call-evidence");
    const sessions = canonicalCallsOf(reports.data ?? []);
    const sessionIds = new Set(sessions.map((c) => c.id));

    const calls: LeadCall[] = (reports.data ?? [])
      .filter((row) => sessionIds.has(row.id))
      .map((row) => {
      const recording = row.recording_id ? byId.get(row.recording_id) ?? null : null;
      if (recording) attached.add(recording.id);
      const measured = row.duration_seconds ?? 0;
      return {
        id: row.id,
        at: row.submitted_at ?? row.call_ended_at ?? row.created_at,
        connected: reportConnected(row),
        verifiedSeconds: measured > 0 ? measured : null,
        durationSeconds: measured,
        category: row.category ?? null,
        summary: row.summary ?? null,
        note: row.note ?? null,
        reason: row.reason ?? null,
        temperature: row.temperature ?? null,
        grade: row.grade ?? null,
        followUpAt: row.follow_up_at ?? null,
        agentId: row.agent_id ?? null,
        recording,
      };
    });

    // Audio that synced without a matching report still belongs on the timeline.
    const orphanRecordings = [...byId.values()].filter((row) => !attached.has(row.id));

    return { calls, orphanRecordings };
  });
