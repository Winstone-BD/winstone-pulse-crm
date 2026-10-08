import { createFileRoute } from "@tanstack/react-router";

/** Scheduled check that the live CRM loads. Caller must present the cron secret. */
export const Route = createFileRoute("/api/public/hooks/deploy-health")({
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
        if (!accepted.length || !header || !accepted.includes(header)) {
          return Response.json({ error: "unauthorized" }, { status: 401 });
        }
        const { runDeploymentHealthCheck } = await import("@/lib/runtime-errors.server");
        const result = await runDeploymentHealthCheck("https://crm.winstonebd.com");
        return Response.json({ ok: true, ...result });
      },
    },
  },
});
