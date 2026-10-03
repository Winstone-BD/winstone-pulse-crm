import { createFileRoute } from "@tanstack/react-router";
import { createRateLimiter } from "@/lib/rate-limit";

/** 120 requests per minute per source address. */
const osLimiter = createRateLimiter(120, 60_000);


const json = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });

/**
 * Winstone OS → CRM signed event receiver.
 * GET = readiness (configured yes/no only, never the secret).
 */
export const Route = createFileRoute("/api/public/os/events")({
  server: {
    handlers: {
      GET: async () =>
        json(200, {
          receiver: "winstone-os-events",
          configured: Boolean(process.env["CRM_BRIDGE_SECRET"]),
          api_version: "1",
        }),
      POST: async ({ request }) => {
        const secret = process.env["CRM_BRIDGE_SECRET"];
        if (!secret) return json(503, { ok: false, error: "receiver_not_configured" });

        const ip =
          request.headers.get("cf-connecting-ip") ??
          request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
          "unknown";
        if (!osLimiter(ip)) return json(429, { ok: false, error: "rate_limited", retryable: true });


        const rawBody = await request.text();
        if (rawBody.length > 64_000) return json(413, { ok: false, error: "payload_too_large" });

        const { verifyOsRequest, osEventSchema, sha256Hex } = await import("@/lib/os-bridge");
        const key = request.headers.get("x-idempotency-key");
        const failure = await verifyOsRequest({
          secret,
          rawBody,
          timestamp: request.headers.get("x-winstone-timestamp"),
          signature: request.headers.get("x-winstone-signature"),
          idempotencyKey: key,
        });
        if (failure) {
          const status = failure.includes("idempotency") ? 400 : 401;
          return json(status, { ok: false, error: failure });
        }

        let parsed: unknown;
        try {
          parsed = JSON.parse(rawBody);
        } catch {
          return json(400, { ok: false, error: "malformed_json" });
        }
        const result = osEventSchema.safeParse(parsed);
        if (!result.success) {
          const unsupported = result.error.issues.some((i) => i.path[0] === "event_type");
          return json(unsupported ? 422 : 400, {
            ok: false,
            error: unsupported ? "unsupported_event_type" : "invalid_event_schema",
          });
        }

        const bridge = await import("@/lib/os-bridge.server");
        const idemKey = key as string;
        try {
          const claim = await bridge.claimOsEvent({
            key: idemKey,
            event: result.data,
            apiVersion: request.headers.get("x-winstone-api-version"),
            payloadHash: await sha256Hex(rawBody),
          });
          if (claim.kind === "conflict") return json(409, { ok: false, error: "idempotency_key_reused" });
          if (claim.kind === "duplicate") {
            if (claim.status !== "failed" || !(await bridge.releaseFailedClaim(idemKey))) {
              return json(200, { ok: true, duplicate: true, status: claim.status, outcome: claim.outcome });
            }
          }
          const outcome = await bridge.applyOsEvent(idemKey, result.data);
          return json(200, { ok: true, duplicate: false, outcome });
        } catch (error) {
          console.error("[os-bridge] processing failed", error);
          await bridge.markOsEventFailed(idemKey, error).catch(() => undefined);
          return json(500, { ok: false, error: "processing_failed", retryable: true });
        }
      },
    },
  },
});
