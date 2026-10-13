import { createFileRoute } from "@tanstack/react-router";

/**
 * Lightweight liveness probe for the browser's connection-status indicator.
 * Answers instantly with no data so the client can tell "my internet is down"
 * apart from "the server is not answering". Safe for anyone to call.
 */
export const Route = createFileRoute("/api/public/health")({
  server: {
    handlers: {
      GET: () =>
        Response.json(
          { ok: true, at: new Date().toISOString() },
          { headers: { "Cache-Control": "no-store" } },
        ),
      HEAD: () => new Response(null, { status: 200, headers: { "Cache-Control": "no-store" } }),
    },
  },
});
