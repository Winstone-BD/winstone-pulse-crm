import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

/**
 * Incoming calls observed on the agent's phone.
 *
 * The outgoing contract (`/agent/call-state`) always knows the lead id because
 * the app dialled it. An incoming call has only a number, so this endpoint
 * resolves the lead by phone and creates it when the caller is new — a callback
 * from a stranger becomes a real lead owned by the agent who received it.
 *
 * Idempotent per `call_uid` + state: a WorkManager retry updates the same call
 * row instead of inserting a second one. Nothing here claims a recording.
 */
const Body = z.object({
  call_uid: z.string().trim().min(6).max(120),
  phone_number: z.string().trim().min(5).max(25),
  contact_name: z.string().trim().max(120).nullable().optional(),
  state: z.enum(["ringing", "answered", "completed", "no_answer", "failed"]),
  at: z.string().datetime({ offset: true }).optional(),
  duration_seconds: z
    .number()
    .int()
    .min(0)
    .max(24 * 3600)
    .optional(),
  recording_supported: z.boolean().optional(),
  recording_note: z.string().trim().max(300).nullable().optional(),
  /**
   * "incoming" (default) is a callback from the customer. "outgoing" is a call
   * the agent dialled from the phone's own dialer instead of from the app — the
   * phone still observes it, so it must land in the CRM the same way.
   */
  direction: z.enum(["incoming", "outgoing"]).optional(),
  /**
   * "call_log" means the phone found this call afterwards while reconciling the
   * system call log (app was killed, call placed from WhatsApp/another dialer).
   * Those arrive late, so they are matched against calls already reported in the
   * same minute instead of creating a second call row for one physical call.
   */
  source: z.enum(["realtime", "call_log"]).optional(),
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

export const Route = createFileRoute("/api/public/agent/incoming-call")({
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
        const outgoing = body.direction === "outgoing";

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { leadOwnerId } = await import("@/lib/lead-access.server");
        const { normalizeLeadPhone, intakeLead } = await import("@/lib/lead-intake.server");
        const { resolveLeadIdByPhone, eligibleLeadIds } = await import(
          "@/lib/lead-eligibility.server"
        );
        const phone = normalizeLeadPhone(body.phone_number);

        // Late call-log reconciliation: if the live receiver already reported a
        // call to this number around the same minute, that is the same physical
        // call — reuse it instead of logging the call twice.
        if (body.source === "call_log") {
          const centre = new Date(at).getTime();
          const { data: near } = await supabaseAdmin
            .from("call_recordings")
            .select("id, lead_id, external_call_id, call_status")
            .eq("agent_id", caller.profile.id)
            .eq("phone_number", phone)
            .gte("started_at", new Date(centre - 150_000).toISOString())
            .lte("started_at", new Date(centre + 150_000).toISOString())
            .limit(1)
            .maybeSingle();
          if (near && near.external_call_id !== body.call_uid) {
            return json({
              ok: true,
              call_uid: body.call_uid,
              lead_id: near.lead_id,
              lead_created: false,
              recording_id: near.id,
              report_id: null,
              call_status: near.call_status,
              recording_status: "unknown",
              duplicate_of: near.external_call_id,
            });
          }
        }
        // A call from a "new" number is matched to an existing lead first, so the
        // same customer never ends up with two lead cards.
        const phoneStatus = await resolveLeadIdByPhone(body.phone_number, caller.profile.id);
        const { data: found } = phoneStatus.existingLeadId
          ? await supabaseAdmin
              .from("leads")
              .select("id, assigned_to, assigned_agent_id")
              .eq("id", phoneStatus.existingLeadId)
              .maybeSingle()
          : { data: null };

        let leadId = found?.id ?? null;
        let created = false;

        if (!leadId) {
          const { InvalidLeadPhoneError } = await import("@/lib/lead-intake.server");
          const intake = await intakeLead({
            // A call the agent dialled from the phone is not a callback.
            name: body.contact_name?.trim() || `${outgoing ? "কল" : "ফিরতি কল"} ${phone}`,
            phoneNumber: phone,
            ownerId: caller.profile.id,
            ownerName: caller.profile.name,
            referenceBy: outgoing ? "ফোন থেকে কল" : "কলব্যাক",
            notes: outgoing
              ? "এজেন্ট ফোনের ডায়ালার থেকে কল করেছেন"
              : "ক্রেতা নিজে ফোন করেছেন (এজেন্টের ফোনে ইনকামিং কল)",
          }).catch((err: unknown) => {
            if (err instanceof InvalidLeadPhoneError) return null;
            throw err;
          });
          if (!intake)
            return new Response(
              JSON.stringify({ error: "সঠিক বাংলাদেশি মোবাইল নম্বর দিন", code: "invalid_phone" }),
              { status: 422, headers: { "Content-Type": "application/json" } },
            );
          leadId = intake.leadId;
          created = !intake.duplicate;
        } else if (!leadOwnerId(found)) {
          // Unowned lead called this agent: it becomes theirs, like a web callback.
          const canClaim = new Set(await eligibleLeadIds([leadId])).has(leadId);
          if (canClaim) {
            await supabaseAdmin
              .from("leads")
              .update({
                assigned_to: caller.profile.id,
                assigned_agent_id: caller.profile.id,
                assignment_source: outgoing ? "dialer_claim" : "callback_claim",
              })
              .eq("id", leadId)
              .is("assigned_to", null)
              .is("assigned_agent_id", null);
          }
        }

        const recordingStatus =
          body.recording_supported === false
            ? "not_available"
            : body.state === "completed"
              ? "pending"
              : "unknown";

        const patch = {
          call_status: body.state,
          agent_phone: caller.profile.phone ?? null,
          recording_status: recordingStatus,
          ...(body.state === "answered" ? { answered_at: at } : {}),
          ...(body.state === "completed" || body.state === "failed" || body.state === "no_answer"
            ? { finished_at: at }
            : {}),
          ...(body.duration_seconds !== undefined
            ? { duration_seconds: body.duration_seconds }
            : {}),
        };

        const { data: existing } = await supabaseAdmin
          .from("call_recordings")
          .select("id, agent_id")
          .eq("external_call_id", body.call_uid)
          .maybeSingle();

        // A call id belongs to the phone that first reported it; another
        // agent's device can never update that row.
        if (existing && existing.agent_id !== caller.profile.id) {
          return json({ error: "call_uid belongs to another agent", code: "call_uid_conflict" }, 409);
        }

        let recordingId = existing?.id ?? null;

        if (existing) {
          await supabaseAdmin
            .from("call_recordings")
            .update(patch)
            .eq("id", existing.id)
            .eq("agent_id", caller.profile.id);
        } else {
          const { data: inserted, error } = await supabaseAdmin
            .from("call_recordings")
            .insert({
              lead_id: leadId,
              agent_id: caller.profile.id,
              device_id: caller.device.id,
              phone_number: phone,
              call_direction: outgoing ? "outgoing" : "incoming_callback",
              duration_seconds: body.duration_seconds ?? 0,
              is_two_sided: false,
              sync_status: "uploaded",
              analysis_status: "pending",
              call_source: outgoing ? "android_dialer" : "android_incoming",
              external_call_id: body.call_uid,
              upload_status: "pending",
              started_at: at,
              ...patch,
            })
            .select("id")
            .single();
          if (error) {
            const { data: raced } = await supabaseAdmin
              .from("call_recordings")
              .select("id, agent_id")
              .eq("external_call_id", body.call_uid)
              .maybeSingle();
            if (!raced) return json({ error: error.message }, 500);
            if (raced.agent_id !== caller.profile.id) {
              return json({ error: "call_uid belongs to another agent", code: "call_uid_conflict" }, 409);
            }
            recordingId = raced.id;
          } else {
            recordingId = inserted?.id ?? null;
          }
        }

        const { logLeadEvent } = await import("@/lib/lead-events.server");
        const { recordSyncEvent } = await import("@/lib/call-jobs.server");

        await recordSyncEvent({
          agentId: caller.profile.id,
          deviceId: caller.device.id,
          eventType: `${outgoing ? "dialer" : "incoming"}_${body.state}`,
          entityType: "call_recording",
          entityId: recordingId,
          idempotencyKey: `${outgoing ? "dialer_call" : "incoming_call"}:${body.call_uid}:${body.state}`,
          payload: {
            lead_id: leadId,
            phone_number: phone,
            lead_created: created,
            recording_supported: body.recording_supported ?? null,
            recording_note: body.recording_note ?? null,
          },
        });

        if (body.state === "ringing" || (outgoing && body.state === "answered")) {
          await logLeadEvent({
            leadId,
            agentId: caller.profile.id,
            kind: "call_started",
            detail: outgoing
              ? `${caller.profile.name} ফোনের ডায়ালার থেকে কল শুরু করেছেন`
              : `ক্রেতা ${caller.profile.name}-কে ফিরতি কল করেছেন`,
          });
        }

        let reportId: string | null = null;
        const connected = body.state === "completed";

        if (body.state === "completed" || body.state === "no_answer" || body.state === "failed") {
          await supabaseAdmin.from("leads").update({ last_call_at: at }).eq("id", leadId);

          if (!connected) {
            await logLeadEvent({
              leadId,
              agentId: caller.profile.id,
              kind: "call_ended",
              detail: outgoing ? "কল ধরা হয়নি" : "ইনকামিং কল ধরা হয়নি",
            });
          }

          // Answered or not, the call must be reported: the report opens for
          // every finished call, and `connected` decides which fields are required.
          const { openCallReport } = await import("@/lib/call-reports.server");
          const report = await openCallReport({
            leadId,
            agentId: caller.profile.id,
            recordingId,
            deviceId: caller.device.id,
            phoneNumber: phone,
            durationSeconds: body.duration_seconds ?? 0,
            connected,
          });
          reportId = report.id;
        }

        return json({
          ok: true,
          call_uid: body.call_uid,
          lead_id: leadId,
          lead_created: created,
          recording_id: recordingId,
          report_id: reportId,
          call_status: body.state,
          recording_status: recordingStatus,
        });
      },
    },
  },
});
