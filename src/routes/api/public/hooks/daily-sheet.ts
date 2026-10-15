import { createFileRoute } from "@tanstack/react-router";

/** Scheduled push of today's (Dhaka) daily lead sheet to Google Sheets. Cron secret required. */
export const Route = createFileRoute("/api/public/hooks/daily-sheet")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { authenticateCronRequest } = await import("@/integrations/supabase/cron-auth");
        const denied = await authenticateCronRequest(request);
        if (denied) return denied;
        try {
          const { dhakaDate } = await import("@/lib/handover-due");
          const { syncDailySheet } = await import("@/lib/daily-sheet.server");
          return Response.json({ ok: true, ...(await syncDailySheet(dhakaDate(new Date()))) });
        } catch (e) {
          return Response.json({ ok: false, error: e instanceof Error ? e.message : "sync failed" }, { status: 500 });
        }
      },
    },
  },
});
