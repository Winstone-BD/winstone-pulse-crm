import { createFileRoute } from "@tanstack/react-router";

/**
 * Monthly summary PDF → Drive "Daily Call Exports". Scheduled for the 1st of
 * each month (Dhaka) and saves the previous month. Requires the cron secret.
 */
export const Route = createFileRoute("/api/public/hooks/monthly-summary")({
  server: {
    handlers: {
      POST: async ({ request }) => {
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
        const accepted = [process.env["SHIFT_CRON_SECRET"], process.env["LOVABLE_CRON_SECRET"], storedSecret].filter(
          (v): v is string => Boolean(v),
        );
        if (!header || !accepted.includes(header)) {
          return Response.json({ error: "unauthorized" }, { status: 401 });
        }
        try {
          const { saveMonthlySummaryToDrive, previousDhakaMonth } = await import("@/lib/monthly-summary.server");
          const month = new URL(request.url).searchParams.get("month") ?? previousDhakaMonth();
          return Response.json({ ok: true, ...(await saveMonthlySummaryToDrive(month, "Monthly scheduler")) });
        } catch (error) {
          console.error("monthly summary failed", error);
          return Response.json({ error: error instanceof Error ? error.message : "failed" }, { status: 500 });
        }
      },
    },
  },
});
