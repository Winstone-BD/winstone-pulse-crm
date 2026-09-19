import { createFileRoute } from "@tanstack/react-router";

/**
 * Agent dashboard KPIs for the Android V2 home screen.
 *
 * GET /api/public/agent/dashboard-metrics
 * Header: x-device-token
 *
 * Returns today's progress counts: assigned, called, connected, interested,
 * follow-up, site-visit, plus priority buckets.
 */
function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

export const Route = createFileRoute("/api/public/agent/dashboard-metrics")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { resolveApiCaller } = await import("@/lib/device-auth.server");
        const caller = await resolveApiCaller(request);
        if (caller.kind !== "device") return json({ error: "Unauthorized" }, 401);

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const agentId = caller.profile.id;

        const todayStart = new Date();
        todayStart.setUTCHours(0, 0, 0, 0);
        const todayIso = todayStart.toISOString();

        const [{ data: leads }, { data: reports }] = await Promise.all([
          supabaseAdmin
            .from("leads")
            .select("id, status, created_at, updated_at")
            .or(`assigned_to.eq.${agentId},assigned_agent_id.eq.${agentId}`),
          supabaseAdmin
            .from("call_reports")
            .select("id, connected, duration_seconds, category, created_at")
            .eq("agent_id", agentId)
            .gte("created_at", todayIso),
        ]);

        const assigned = (leads ?? []).length;
        const calledToday = reports ?? [];
        const called = calledToday.length;
        const connected = calledToday.filter((r) => r.connected).length;
        const interested = calledToday.filter((r) => r.category === "interested" || r.category === "hot_lead").length;
        const followUp = calledToday.filter((r) => r.category === "follow_up").length;
        const siteVisit = calledToday.filter((r) => r.category === "site_visit").length;

        // Priority buckets
        const hotLeads = (leads ?? []).filter((l) => l.status === "pending").length;
        const followUpsDue = (leads ?? []).filter((l) => l.status === "follow_up").length;
        const newAssigned = (leads ?? []).filter((l) => {
          const created = l.created_at ? new Date(l.created_at).getTime() : 0;
          return created >= todayStart.getTime();
        }).length;
        const missedRetry = calledToday.filter((r) => r.category === "no_answer" || r.category === "callback").length;

        const progressPercent = assigned > 0 ? Math.min(100, Math.round((called / assigned) * 100)) : 0;

        return json({
          ok: true,
          progress_percent: progressPercent,
          assigned,
          called,
          connected,
          interested,
          follow_up: followUp,
          site_visit: siteVisit,
          hot_leads: hotLeads,
          follow_ups_due: followUpsDue,
          new_assigned: newAssigned,
          missed_retry: missedRetry,
        });
      },
    },
  },
});
