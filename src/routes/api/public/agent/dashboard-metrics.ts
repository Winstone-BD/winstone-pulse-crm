import { createFileRoute } from "@tanstack/react-router";

/**
 * Agent dashboard numbers for the Android app.
 *
 * GET /api/public/agent/dashboard-metrics
 * Header: x-device-token
 *
 * Every figure comes from the shared server calculation the web CRM uses, for
 * the Asia/Dhaka business day decided here — the phone never counts anything
 * itself and never uses the device date. Target (workload) and actual activity
 * are reported separately, so receiving 30 leads is never mistaken for 30 calls.
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

        const { agentDailyPerformance } = await import("@/lib/daily-performance.server");
        const day = await agentDailyPerformance(caller.profile.id);
        const me = day.me;

        if (!me) {
          return json({
            ok: true,
            date_key: day.dateKey,
            time_zone: day.timeZone,
            progress_percent: 0,
            target: 0,
            assigned: 0,
            called: 0,
            connected: 0,
            qualified: 0,
            follow_ups_completed: 0,
            site_visits_scheduled: 0,
            site_visits_completed: 0,
            bookings: 0,
            talk_minutes: 0,
            carried_over: 0,
            new_from_database: 0,
            reassigned_in: 0,
            reassigned_out: 0,
            excess_pending: 0,
            connect_rate: 0,
            conversion_rate: 0,
            pool_shortage: day.poolShortage,
          });
        }

        return json({
          ok: true,
          date_key: day.dateKey,
          time_zone: day.timeZone,
          /** Share of the day's target actually worked on — not possession. */
          progress_percent: me.activityPercent,
          target: me.target,
          assigned: me.leadsAssigned,
          called: me.callsAttempted,
          connected: me.connectedCalls,
          qualified: me.qualifiedLeads,
          follow_ups_completed: me.followUpsCompleted,
          site_visits_scheduled: me.siteVisitsScheduled,
          site_visits_completed: me.siteVisitsCompleted,
          bookings: me.bookings,
          talk_minutes: me.talkMinutes,
          carried_over: me.carriedOverPending,
          new_from_database: me.newFromDatabase,
          reassigned_in: me.reassignedIn,
          reassigned_out: me.reassignedOut,
          excess_pending: me.excessPending,
          connect_rate: me.connectRate,
          conversion_rate: me.conversionRate,
          pool_shortage: day.poolShortage,
        });
      },
    },
  },
});
