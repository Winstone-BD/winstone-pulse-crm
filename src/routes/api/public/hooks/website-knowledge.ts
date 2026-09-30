import { createFileRoute } from "@tanstack/react-router";

/**
 * Scheduled refresh of the company website copy agents' answers are grounded on.
 * Read-only against the website, idempotent (pages are upserted by URL).
 * Caller must present the cron secret.
 */
export const Route = createFileRoute("/api/public/hooks/website-knowledge")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const header =
          request.headers.get("x-cron-secret") ??
          request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
          "";

        const accepted = [
          process.env["SHIFT_CRON_SECRET"],
          process.env["LOVABLE_CRON_SECRET"],
        ].filter((value): value is string => Boolean(value));
        if (accepted.length === 0 || !header || !accepted.includes(header)) {
          return new Response(JSON.stringify({ error: "unauthorized" }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
          });
        }

        try {
          const { refreshWebsitePages } = await import("@/lib/website-knowledge.server");
          return Response.json({ ok: true, ...(await refreshWebsitePages()) });
        } catch (error) {
          return Response.json(
            { ok: false, error: error instanceof Error ? error.message : "refresh failed" },
            { status: 500 },
          );
        }
      },
    },
  },
});
