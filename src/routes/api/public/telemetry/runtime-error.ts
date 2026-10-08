import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

/**
 * Browser crash reports. Public on purpose — a page that failed to load has no
 * session. Accepts only small, sanitised text, stores no query strings, and
 * returns nothing private. Same-origin only.
 */
const Body = z.object({
  kind: z.string().min(1).max(60),
  message: z.string().min(1).max(2000),
  route: z.string().max(500).default("/"),
});

export const Route = createFileRoute("/api/public/telemetry/runtime-error")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const origin = request.headers.get("origin");
        const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
        if (origin && host && new URL(origin).host !== host) {
          return new Response(null, { status: 403 });
        }
        const text = await request.text();
        if (text.length > 4000) return new Response(null, { status: 413 });
        let parsed;
        try {
          parsed = Body.parse(JSON.parse(text));
        } catch {
          return new Response(null, { status: 400 });
        }
        try {
          const { recordRuntimeError } = await import("@/lib/runtime-errors.server");
          await recordRuntimeError({
            source: "browser",
            ...parsed,
            browser: request.headers.get("user-agent"),
          });
        } catch (e) {
          console.error("runtime-error ingest failed", e);
        }
        return new Response(null, { status: 204 });
      },
    },
  },
});
