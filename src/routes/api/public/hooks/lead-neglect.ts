import { createFileRoute } from "@tanstack/react-router";

/** Daily neglect sweep (08:55 Dhaka, before distribution). Requires the cron secret. */
export const Route = createFileRoute("/api/public/hooks/lead-neglect")({
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
          const { runNeglectSweep } = await import("@/lib/lead-neglect.server");
          return Response.json({ ok: true, ...(await runNeglectSweep()) });
        } catch (error) {
          console.error("neglect sweep failed", error);
          return Response.json({ error: "failed" }, { status: 500 });
        }
      },
    },
  },
});
