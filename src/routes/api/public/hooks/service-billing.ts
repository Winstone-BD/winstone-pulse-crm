import { createFileRoute } from "@tanstack/react-router";

/**
 * Scheduled billing reminder: raises the current month's invoice if missing,
 * flips lapsed invoices to overdue, and alerts HQ/IT when a bill becomes due
 * or goes overdue. Caller must present the cron secret.
 */
export const Route = createFileRoute("/api/public/hooks/service-billing")({
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

        const accepted = [
          process.env["SHIFT_CRON_SECRET"],
          process.env["LOVABLE_CRON_SECRET"],
          storedSecret,
        ].filter((value): value is string => Boolean(value));
        if (accepted.length === 0 || !header || !accepted.includes(header)) {
          return new Response(JSON.stringify({ error: "unauthorized" }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
          });
        }

        // Retired: the monthly bill is now the $46.29 USD maintenance system,
        // evaluated on every request by maintenance.server.ts.
        return Response.json({ ok: true, retired: true });
      },
    },
  },
});
