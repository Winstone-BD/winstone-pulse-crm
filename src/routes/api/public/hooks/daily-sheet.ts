import { createFileRoute } from "@tanstack/react-router";

/** Scheduled push of today's (Dhaka) daily lead sheet to Google Sheets. Cron secret required. */
export const Route = createFileRoute("/api/public/hooks/daily-sheet")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { authenticateCronRequest } = await import("@/integrations/supabase/cron-auth");
        let denied = await authenticateCronRequest(request);
        if (denied) {
          // Also accept the shared cron secret used by the other scheduled jobs
          // (server-only: system_settings denies anon/authenticated access).
          const header =
            request.headers.get("x-cron-secret") ??
            request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
            "";
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { data: stored } = await supabaseAdmin
            .from("system_settings")
            .select("value")
            .eq("key", "shift_cron_secret")
            .maybeSingle();
          const storedSecret =
            stored && typeof stored.value === "object" && stored.value !== null
              ? (stored.value as { secret?: string }).secret
              : undefined;
          const accepted = [
            process.env["SHIFT_CRON_SECRET"],
            process.env["LOVABLE_CRON_SECRET"],
            storedSecret,
          ].filter((value): value is string => Boolean(value));
          if (accepted.length === 0 || !header || !accepted.includes(header)) {
            return denied;
          }
          denied = null;
        }
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
