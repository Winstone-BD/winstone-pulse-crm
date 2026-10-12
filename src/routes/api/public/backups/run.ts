import { createFileRoute } from "@tanstack/react-router";

/** Nightly CRM backup. Caller must present the server-only backup token. Idempotent per date. */
export const Route = createFileRoute("/api/public/backups/run")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const token = request.headers.get("x-backup-token") ?? "";
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data } = await supabaseAdmin.from("crm_backup_secret").select("token").eq("id", 1).maybeSingle();
        if (!data?.token || token.length !== data.token.length || token !== data.token) {
          return new Response("Unauthorized", { status: 401 });
        }
        try {
          const { runBackup } = await import("@/lib/crm-backup.server");
          const r = await runBackup();
          return Response.json({ ok: true, date: r.date, skipped: r.skipped });
        } catch (e) {
          console.error("[backup] failed:", e instanceof Error ? e.message : e);
          return Response.json({ ok: false }, { status: 500 });
        }
      },
    },
  },
});
