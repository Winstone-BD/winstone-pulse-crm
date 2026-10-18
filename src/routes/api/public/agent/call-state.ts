import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { reconcileCallTiming, terminalCallStates } from "@/lib/call-timing";

/**
 * Call lifecycle contract for the Android companion.
 *
 * initiated -> ringing -> answered -> completed (or failed / no_answer).
 *
 * The phone owns a `call_uid` it generates before dialling and reuses for every
 * state push of the same call. That id lands in `external_call_id`, which is
 * uniquely indexed, so an offline replay or a WorkManager retry updates the same
 * row instead of creating a second call. Nothing here claims a recording: when
 * the device cannot record, `recording_status` is written as `not_available` and
 * the mandatory report flow continues untouched.
 */
const Body = z.object({
  call_uid: z.string().trim().min(6).max(120),
  lead_id: z.string().uuid(),
  state: z.enum(["initiated", "ringing", "answered", "completed", "failed", "no_answer"]),
  at: z.string().datetime({ offset: true }).optional(),
  duration_seconds: z
    .number()
    .int()
    .min(0)
    .max(24 * 3600)
    .optional(),
  agent_phone: z.string().trim().min(5).max(20).nullable().optional(),
  recording_supported: z.boolean().optional(),
  recording_note: z.string().trim().max(300).nullable().optional(),
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

export const Route = createFileRoute("/api/public/agent/call-state")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { resolveApiCaller } = await import("@/lib/device-auth.server");
        const caller = await resolveApiCaller(request);
        if (caller.kind !== "device") return json({ error: "Unauthorized" }, 401);

        const parsed = Body.safeParse(await request.json().catch(() => null));
        if (!parsed.success) return json({ error: "Invalid payload" }, 400);
        const body = parsed.data;
        const at = body.at ?? new Date().toISOString();

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { leadNotAssignedTo, LEAD_NOT_YOURS } = await import("@/lib/lead-access.server");

        const { data: lead } = await supabaseAdmin
          .from("leads")
          .select("id, phone_number, assigned_to, assigned_agent_id")
          .eq("id", body.lead_id)
          .maybeSingle();
        if (!lead) return json({ error: "Unknown lead" }, 404);
        // Calls sync only onto leads assigned to this agent — unassigned pool leads are LeadHub-only.
        if (leadNotAssignedTo(lead, caller.profile.id)) {
          return json({ error: LEAD_NOT_YOURS }, 403);
        }

        // recording_status is honest: only the upload endpoint may set
        // "available" once real audio is stored.
        const recordingStatus =
          body.recording_supported === false
            ? "not_available"
            : body.state === "completed"
              ? "pending"
              : "unknown";

        const { data: existing, error: lookupError } = await supabaseAdmin
          .from("call_recordings")
          .select("id, lead_id, call_status, agent_id, created_at, duration_seconds, device_reported_duration_seconds, recording_status, started_at")
          .eq("external_call_id", body.call_uid)
          .maybeSingle();
        if (lookupError) return json({ error: "Call lookup unavailable" }, 503);
        if (existing && (existing.agent_id !== caller.profile.id || existing.lead_id !== lead.id)) {
          return json({ error: "This call belongs to another agent or lead" }, 403);
        }
        const timing = reconcileCallTiming({ state: body.state, claimedSeconds: body.duration_seconds, existing, nowMs: Date.now() });
        const durationSeconds = timing.durationSeconds;
        const effectiveRecordingStatus = existing && terminalCallStates.has(existing.call_status ?? "")
          ? existing.recording_status : recordingStatus;

        const patch = {
          call_status: timing.state,
          agent_phone: body.agent_phone ?? caller.profile.phone ?? null,
          recording_status: effectiveRecordingStatus,
          ...(timing.applyEventTime && body.state === "initiated" ? { started_at: at } : {}),
          ...(timing.applyEventTime && body.state === "answered" ? { answered_at: at } : {}),
          ...(timing.applyEventTime && terminalCallStates.has(body.state)
            ? { finished_at: at }
            : {}),
          duration_seconds: durationSeconds,
          device_reported_duration_seconds: timing.reportedSeconds,
        };

        let recordingId = existing?.id ?? null;

        if (existing) {
          // Compare-and-set: a simultaneous completion must not be overwritten by a late start.
          let update = supabaseAdmin.from("call_recordings").update(patch).eq("id", existing.id)
            .eq("duration_seconds", existing.duration_seconds);
          update = existing.call_status == null ? update.is("call_status", null) : update.eq("call_status", existing.call_status);
          const saved = await update.select("id").maybeSingle();
          if (saved.error || !saved.data) return json({ error: "Call changed; retry sync" }, 409);
        } else {
          const { data: inserted, error } = await supabaseAdmin
            .from("call_recordings")
            .insert({
              lead_id: lead.id,
              agent_id: caller.profile.id,
              device_id: caller.device.id,
              phone_number: lead.phone_number,
              call_direction: "outgoing",
              duration_seconds: durationSeconds ?? 0,
              is_two_sided: false,
              sync_status: "uploaded",
              analysis_status: "pending",
              call_source: "android_sim",
              external_call_id: body.call_uid,
              upload_status: "pending",
              ...patch,
            })
            .select("id")
            .single();
          if (error) {
            // Retry through the ownership check and reconciliation with the winning row.
            return json({ error: "Call sync unavailable; retry" }, error.code === "23505" ? 409 : 503);
          } else {
            recordingId = inserted?.id ?? null;
          }
        }

        const { recordSyncEvent } = await import("@/lib/call-jobs.server");
        await recordSyncEvent({
          agentId: caller.profile.id,
          deviceId: caller.device.id,
          eventType: `call_${body.state}`,
          entityType: "call_recording",
          entityId: recordingId,
          idempotencyKey: `call_state:${body.call_uid}:${body.state}`,
          payload: {
            lead_id: lead.id,
            recording_supported: body.recording_supported ?? null,
            recording_note: body.recording_note ?? null,
          },
        });

        if (body.state === "initiated" && !existing) {
          const { logLeadEvent } = await import("@/lib/lead-events.server");
          await logLeadEvent({
            leadId: lead.id,
            agentId: caller.profile.id,
            kind: "call_started",
            detail: `${caller.profile.name} কল শুরু করেছেন`,
          });
        }

        // Every finished call is reportable — answered, unanswered or failed.
        // Opened here on the server so the report exists even if the phone never
        // gets to send its own "open report" request.
        let reportId: string | null = null;
        if (body.state === "completed" || body.state === "no_answer" || body.state === "failed") {
          if (timing.applyEventTime) await supabaseAdmin.from("leads").update({ last_call_at: at }).eq("id", lead.id);
          const { openCallReport } = await import("@/lib/call-reports.server");
          const report = await openCallReport({
            leadId: lead.id,
            agentId: caller.profile.id,
            recordingId,
            deviceId: caller.device.id,
            phoneNumber: lead.phone_number,
            durationSeconds: durationSeconds ?? 0,
            deviceReportedDurationSeconds: timing.reportedSeconds,
            connected: timing.state === "completed",
          });
          reportId = report.id;
          // Only this call's unfinished report; never revise submitted/finalized history.
          if (recordingId) await supabaseAdmin.from("call_reports")
            .update({ duration_seconds: durationSeconds, device_reported_duration_seconds: timing.reportedSeconds })
            .eq("recording_id", recordingId).eq("agent_id", caller.profile.id).in("status", ["pending", "queued"]);
        }

        return json({
          ok: true,
          call_uid: body.call_uid,
          recording_id: recordingId,
          report_id: reportId,
          call_status: timing.state,
          recording_status: effectiveRecordingStatus,
        });
      },
    },
  },
});
