import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

/**
 * Agent Workspace feed for the Winstone Connect Android app.
 *
 * GET /api/public/agent/workspace?employee_id=WIN2601
 * Header: x-ingest-secret
 *
 * Returns the agent's profile, their leads, and their call / WhatsApp logs so the
 * app shows exactly what the web "My Leads" page shows for that agent.
 */
const Query = z.object({
  employee_id: z.string().trim().min(2).max(32).optional(),
  agent_id: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(500).default(200),
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

export const Route = createFileRoute("/api/public/agent/workspace")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { resolveApiCaller } = await import("@/lib/device-auth.server");
        const caller = await resolveApiCaller(request);
        if (caller.kind === "none") return json({ error: "Unauthorized" }, 401);

        const url = new URL(request.url);
        const parsed = Query.safeParse(Object.fromEntries(url.searchParams));
        if (!parsed.success) return json({ error: "Invalid query" }, 400);
        const { limit } = parsed.data;
        // A phone may only ever read its own agent's workspace.
        const agent_id = caller.kind === "device" ? caller.profile.id : parsed.data.agent_id;
        const employee_id = caller.kind === "device" ? undefined : parsed.data.employee_id;
        if (!employee_id && !agent_id) {
          return json({ error: "employee_id or agent_id is required" }, 400);
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        // Roster: agent list so the app can offer an "Operating as" switcher too.
        const { data: roster } = await supabaseAdmin
          .from("profiles")
          .select("id, name, employee_id, phone, role, is_active")
          .eq("is_active", true)
          .order("name");

        const agent = (roster ?? []).find((p) =>
          agent_id ? p.id === agent_id : p.employee_id === employee_id,
        );
        if (!agent) return json({ error: "Unknown agent" }, 404);

        const { data: leads, error: leadsError } = await supabaseAdmin
          .from("leads")
          .select(
            "id, name, phone_number, company, notes, status, outcome_category, call_attempts, source, created_at, updated_at, work_date, work_state, last_call_at, classified_at, carried_from_date, assignment_source, retry_after, unanswered_attempts",
          )
          .or(`assigned_to.eq.${agent.id},assigned_agent_id.eq.${agent.id}`)
          .order("updated_at", { ascending: false })
          .limit(limit);
        if (leadsError) return json({ error: leadsError.message }, 500);

        const leadIds = (leads ?? []).map((l) => l.id);
        // The phone's call history is the canonical one: every submitted
        // post-call report is a call, connected only with the phone's own proof,
        // and a synced recording is extra evidence attached to that same call.
        // This is exactly what web Lead 360 lists, so the two never disagree.
        const [{ data: calls }, { data: messages }] = leadIds.length
          ? await Promise.all([
              supabaseAdmin
                .from("call_reports")
                .select(
                  "id, lead_id, agent_id, connected, connection_verified, duration_seconds, recording_id, call_started_at, call_ended_at, submitted_at, created_at",
                )
                .eq("status", "submitted")
                .in("lead_id", leadIds)
                .order("created_at", { ascending: false })
                .limit(limit),
              supabaseAdmin
                .from("whatsapp_interactions")
                .select(
                  "id, lead_id, agent_id, sender_type, message_type, message_content, created_at",
                )
                .in("lead_id", leadIds)
                .order("created_at", { ascending: false })
                .limit(limit),
            ])
          : [{ data: [] }, { data: [] }];

        // Attach the recording evidence (audio sync state, AI result) to each
        // canonical call. Nothing is filled in where the phone sent nothing.
        const { canonicalCallsOf } = await import("@/lib/call-evidence");
        const sessions = canonicalCallsOf(calls ?? []);
        const recordingIds = sessions
          .map((c) => c.recordingId)
          .filter((id): id is string => !!id);
        const { data: recordingRows } = recordingIds.length
          ? await supabaseAdmin
              .from("call_recordings")
              .select(
                "id, phone_number, call_direction, sync_status, is_two_sided, ai_summary, sentiment, analysis_status",
              )
              .in("id", recordingIds)
          : { data: [] };
        const recordingById = new Map((recordingRows ?? []).map((row) => [row.id, row]));
        const leadPhone = new Map((leads ?? []).map((l) => [l.id, l.phone_number]));

        const callRows = sessions.map((call) => {
          const rec = call.recordingId ? recordingById.get(call.recordingId) : undefined;
          return {
            id: call.id,
            lead_id: call.leadId,
            agent_id: call.agentId,
            phone_number: rec?.phone_number ?? (call.leadId ? leadPhone.get(call.leadId) ?? "" : ""),
            connected: call.verifiedConnected,
            /** null = the phone measured no duration; never shown as 0 minutes. */
            verified_seconds: call.verifiedSeconds,
            duration_seconds: call.verifiedSeconds ?? 0,
            call_direction: rec?.call_direction ?? "outgoing",
            /** "report_only" = the report synced, the audio file never did. */
            sync_status: rec?.sync_status ?? "report_only",
            is_two_sided: rec?.is_two_sided ?? false,
            ai_summary: rec?.ai_summary ?? null,
            sentiment: rec?.sentiment ?? null,
            analysis_status: rec?.analysis_status ?? null,
            created_at: call.at,
          };
        });

        // The SAME allocation state the web dashboard shows. The app never
        // computes a quota, a pending count or an excess number of its own, and
        // it never uses the device date — this is the Asia/Dhaka business day.
        const { floorAllocationStatus } = await import("@/lib/workday-allocation.server");
        const { dhakaToday } = await import("@/lib/lead-pool.server");
        const board = await floorAllocationStatus(dhakaToday());
        const allocation = {
          work_date: board.workDate,
          special: board.special,
          pool_available: board.poolAvailable,
          shortage: board.shortage,
          me: board.agents.find((row) => row.agentId === agent.id) ?? null,
        };

        return json({
          ok: true,
          server_time: new Date().toISOString(),
          allocation,
          agent,
          roster: roster ?? [],
          leads: leads ?? [],
          calls: callRows,
          whatsapp: messages ?? [],
        });
      },
    },
  },
});
