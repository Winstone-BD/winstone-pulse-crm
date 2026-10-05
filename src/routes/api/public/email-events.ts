import { createFileRoute } from "@tanstack/react-router";
import { createRateLimiter, requestSourceKey } from "@/lib/rate-limit";

const limiter = createRateLimiter(120, 60_000);
const json = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });

/**
 * Hostinger Mail inbound webhook (message.received). Auth = Bearer webhook secret
 * (HOSTINGER_EMAIL_WEBHOOK_SECRET). Stores metadata + hash only; duplicates are 200 no-ops.
 */
export const Route = createFileRoute("/api/public/email-events")({
  server: {
    handlers: {
      GET: async () =>
        json(200, {
          receiver: "hostinger-email-events",
          configured: Boolean(process.env["HOSTINGER_EMAIL_WEBHOOK_SECRET"]),
        }),
      POST: async ({ request }) => {
        if (!limiter(requestSourceKey(request)))
          return json(429, { ok: false, error: "rate_limited" });
        const { checkEmailEvent } = await import("@/lib/email-events");
        const check = await checkEmailEvent({
          secret: process.env["HOSTINGER_EMAIL_WEBHOOK_SECRET"],
          authorization: request.headers.get("authorization"),
          rawBody: await request.text(),
        });
        if (!check.ok) return json(check.status, { ok: false, error: check.error });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { error } = await supabaseAdmin.from("email_event_receipts").insert({
          event_key: check.eventKey,
          event_type: check.eventType,
          mailbox: check.mailbox,
          payload_hash: check.payloadHash,
        });
        if (error) {
          if (error.code === "23505") return json(200, { ok: true, duplicate: true });
          console.error("[email-events] persist failed", error.code);
          return json(500, { ok: false, error: "persist_failed", retryable: true });
        }
        return json(200, { ok: true });
      },
    },
  },
});
