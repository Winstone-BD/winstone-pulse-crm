import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

/**
 * The mandatory post-call report, from the phone.
 *
 * GET  -> the agent's open report (durable: survives app kill / reboot)
 * POST action=open   -> opens the report the moment a call ends, even when the
 *                       recording failed, so every call stays reportable
 * POST action=submit -> validates category + conditional fields, closes the
 *                       report, moves the lead and creates the follow-up event
 */
const Body = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("open"),
    lead_id: z.string().uuid(),
    recording_id: z.string().uuid().nullable().optional(),
    phone_number: z.string().max(24).nullable().optional(),
    call_started_at: z.string().datetime({ offset: true }).nullable().optional(),
    duration_seconds: z.number().int().min(0).default(0),
    connected: z.boolean().default(true),
  }),
  z.object({
    action: z.literal("submit"),
    report_id: z.string().uuid(),
    category: z.string().min(2).max(40),
    summary: z.string().trim().max(4000).nullable().optional(),
    note: z.string().trim().max(4000).nullable().optional(),
    reason: z.string().trim().max(2000).nullable().optional(),
    follow_up_at: z.string().datetime({ offset: true }).nullable().optional(),
    reminder_minutes: z.number().int().min(0).max(1440).default(30),
    temperature: z.enum(["hot", "warm", "cold"]).nullable().optional(),
    grade: z.enum(["A", "B", "C", "D"]).nullable().optional(),
    ai_decision: z.enum(["accepted", "edited", "rejected"]).nullable().optional(),
    direction: z.enum(["outgoing", "incoming"]).nullable().optional(),
    call_status: z.enum(["connected", "no_answer", "busy", "failed"]).nullable().optional(),
    duration_seconds: z.number().int().min(0).max(86400).nullable().optional(),
    follow_up_needed: z.boolean().optional(),
    follow_up_note: z.string().trim().max(500).nullable().optional(),
  }),
]);

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

export const Route = createFileRoute("/api/public/agent/report")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { resolveApiCaller } = await import("@/lib/device-auth.server");
        const caller = await resolveApiCaller(request);
        if (caller.kind !== "device") return json({ error: "Unauthorized" }, 401);

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        // ?list=1 -> the agent's own report history for the in-app list.
        const url = new URL(request.url);
        if (url.searchParams.get("list")) {
          const category = url.searchParams.get("category");
          const state = url.searchParams.get("state"); // connected | not_connected
          let listQuery = supabaseAdmin
            .from("call_reports")
            .select(
              "id, lead_id, phone_number, status, category, summary, note, follow_up_at, connected, duration_seconds, call_ended_at, temperature, grade",
            )
            .eq("agent_id", caller.profile.id)
            .order("call_ended_at", { ascending: false })
            .limit(100);
          if (category) listQuery = listQuery.eq("category", category);
          if (state) listQuery = listQuery.eq("connected", state === "connected");
          const { data: list } = await listQuery;
          const ids = [...new Set((list ?? []).map((r) => r.lead_id).filter(Boolean))] as string[];
          const { data: leads } = ids.length
            ? await supabaseAdmin.from("leads").select("id, name, phone_number").in("id", ids)
            : { data: [] };
          const byId = new Map((leads ?? []).map((l) => [l.id, l]));
          return json({
            reports: (list ?? []).map((row) => ({
              ...row,
              lead: byId.get(row.lead_id ?? "") ?? null,
            })),
          });
        }

        const { data: report } = await supabaseAdmin
          .from("call_reports")
          .select(
            "id, lead_id, recording_id, phone_number, duration_seconds, connected, call_ended_at, ai_suggestion",
          )
          .eq("agent_id", caller.profile.id)
          .eq("status", "pending")
          .maybeSingle();
        if (!report) return json({ pending: null });

        const { data: lead } = await supabaseAdmin
          .from("leads")
          .select("id, name, phone_number, company")
          .eq("id", report.lead_id)
          .maybeSingle();

        const { data: recording } = report.recording_id
          ? await supabaseAdmin
              .from("call_recordings")
              .select(
                "id, analysis_status, ai_summary, sentiment, customer_objections, deal_stage, is_two_sided, recorder_source, call_direction, call_status",
              )
              .eq("id", report.recording_id)
              .maybeSingle()
          : { data: null };

        return json({ pending: { ...report, lead, recording } });
      },

      POST: async ({ request }) => {
        const { resolveApiCaller } = await import("@/lib/device-auth.server");
        const caller = await resolveApiCaller(request);
        if (caller.kind !== "device") return json({ error: "Unauthorized" }, 401);

        const parsed = Body.safeParse(await request.json().catch(() => null));
        if (!parsed.success) return json({ error: "Invalid payload" }, 400);
        const body = parsed.data;

        const { openCallReport, submitCallReport } = await import("@/lib/call-reports.server");

        if (body.action === "open") {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { leadHeldByOther } = await import("@/lib/lead-access.server");
          const { data: lead } = await supabaseAdmin
            .from("leads")
            .select("id, assigned_to, assigned_agent_id")
            .eq("id", body.lead_id)
            .maybeSingle();
          if (!lead) return json({ error: "Unknown lead" }, 404);
          if (leadHeldByOther(lead, caller.profile.id)) {
            return json({ error: "এই লিড আপনার তালিকায় নেই" }, 403);
          }

          const report = await openCallReport({
            leadId: body.lead_id,
            agentId: caller.profile.id,
            recordingId: body.recording_id ?? null,
            deviceId: caller.device.id,
            phoneNumber: body.phone_number ?? null,
            callStartedAt: body.call_started_at ?? null,
            durationSeconds: body.duration_seconds,
            connected: body.connected,
          });
          return json({ ok: true, report_id: report.id, reused: report.reused }, 201);
        }

        try {
          const result = await submitCallReport({
            reportId: body.report_id,
            agentId: caller.profile.id,
            category: body.category,
            summary: body.summary ?? null,
            note: body.note ?? null,
            reason: body.reason ?? null,
            followUpAt: body.follow_up_at ?? null,
            reminderMinutes: body.reminder_minutes,
            temperature: body.temperature ?? null,
            grade: body.grade ?? null,
            aiDecision: body.ai_decision ?? null,
            direction: body.direction ?? null,
            callStatus: body.call_status ?? null,
            durationSeconds: body.duration_seconds ?? null,
            followUpNeeded: body.follow_up_needed ?? true,
            followUpNote: body.follow_up_note ?? null,
          });
          return json({ ...result, ok: true });
        } catch (error) {
          return json({ error: error instanceof Error ? error.message : "রিপোর্ট জমা হয়নি" }, 422);
        }
      },
    },
  },
});
