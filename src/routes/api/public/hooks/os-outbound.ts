import { createFileRoute } from "@tanstack/react-router";

/** Scheduled CRM → OS booking dispatcher. Caller must present the cron secret. */
export const Route = createFileRoute("/api/public/hooks/os-outbound")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { authenticateCronRequest } = await import("@/integrations/supabase/cron-auth");
        const denied = await authenticateCronRequest(request);
        if (denied) return denied;
        const { dispatchOsQueue } = await import("@/lib/os-outbound.server");
        try {
          return Response.json(await dispatchOsQueue());
        } catch {
          return Response.json({ ok: false, error: "dispatch_failed" }, { status: 500 });
        }
      },
    },
  },
});
