import { createFileRoute } from "@tanstack/react-router";

/** Scheduled Market News collection. Caller must present the shared cron secret. */
export const Route = createFileRoute("/api/public/hooks/market-news")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const header =
          request.headers.get("x-cron-secret") ?? request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: stored } = await supabaseAdmin.from("system_settings").select("value").eq("key", "shift_cron_secret").maybeSingle();
        const storedSecret =
          stored && typeof stored.value === "object" && stored.value !== null ? (stored.value as { secret?: string }).secret : undefined;
        const accepted = [process.env["SHIFT_CRON_SECRET"], process.env["LOVABLE_CRON_SECRET"], storedSecret].filter(
          (v): v is string => Boolean(v),
        );
        if (accepted.length === 0 || !header || !accepted.includes(header)) {
          return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: { "Content-Type": "application/json" } });
        }
        try {
          const { collectNews } = await import("@/lib/market-news.server");
          const r = await collectNews("AI Auto-Collector");
          return Response.json(r);
        } catch (e) {
          return Response.json({ error: (e as Error).message }, { status: 500 });
        }
      },
    },
  },
});
