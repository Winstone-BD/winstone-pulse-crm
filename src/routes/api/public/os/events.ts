import { createFileRoute } from "@tanstack/react-router";
import { createRateLimiter, requestSourceKey } from "@/lib/rate-limit";

/** 120 requests per minute per source address. */
const osLimiter = createRateLimiter(120, 60_000);

const json = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });

/**
 * Winstone OS → CRM1 receiver (single endpoint, see docs/crm1-receiver.md).
 * GET = readiness (configured yes/no only, never the secret).
 * POST accepts two envelopes:
 *  - legacy `{event_id,event_type,occurred_at,data}` booking/payment events (unchanged)
 *  - unified `{event_id,event_type,idempotency_key?,occurred_at,payload}` (lead_ingested)
 */
export const Route = createFileRoute("/api/public/os/events")({
  server: {
    handlers: {
      GET: async () =>
        json(200, {
          receiver: "winstone-os-events",
          configured: Boolean(process.env["CRM_BRIDGE_SECRET"]),
          api_version: "1",
          event_types: ["booking.created", "booking.updated", "booking.cancelled", "payment.updated", "lead_ingested"],
        }),
      POST: async ({ request }) => {
        const secret = process.env["CRM_BRIDGE_SECRET"];
        if (!secret) return json(503, { ok: false, error: "receiver_not_configured", retryable: true });

        if (!osLimiter(requestSourceKey(request))) return json(429, { ok: false, error: "rate_limited", retryable: true });

        const rawBody = await request.text();
        if (rawBody.length > 64_000) return json(413, { ok: false, error: "payload_too_large" });

        const bridgeRules = await import("@/lib/os-bridge");
        const signature = request.headers.get("x-winstone-signature");
        const headerKey = request.headers.get("x-idempotency-key");

        // Auth: HMAC (timestamped, replay-window) or Bearer shared secret.
        if (signature) {
          const failure = await bridgeRules.verifyOsRequest({
            secret,
            rawBody,
            timestamp: request.headers.get("x-winstone-timestamp"),
            signature,
            // HMAC authenticates raw bytes before parsing. The envelope's
            // real idempotency key is validated immediately after parsing.
            idempotencyKey: "signature-only-check",
          });
          if (failure) return json(401, { ok: false, error: failure });
        } else if (!bridgeRules.verifyBearer(secret, request.headers.get("authorization"))) {
          return json(401, { ok: false, error: "unauthorized" });
        }

        let parsed: unknown;
        try {
          parsed = JSON.parse(rawBody);
        } catch {
          return json(400, { ok: false, error: "malformed_json" });
        }

        const bridge = await import("@/lib/os-bridge.server");
        const payloadHash = await bridgeRules.sha256Hex(rawBody);
        const apiVersion = request.headers.get("x-winstone-api-version");
        const isV2 = !!parsed && typeof parsed === "object" && "payload" in parsed;

        if (isV2) {
          const v2 = bridgeRules.parseV2Envelope(parsed);
          if (!v2.ok) return json(422, { ok: false, error: v2.error, issues: v2.issues ?? [], retryable: false });
          const key = headerKey ?? v2.envelope.idempotency_key ?? null;
          if (!key) return json(422, { ok: false, error: "missing_idempotency_key", retryable: false });
          if (!bridgeRules.IDEMPOTENCY_KEY_RE.test(key)) return json(422, { ok: false, error: "invalid_idempotency_key", retryable: false });
          if (headerKey && v2.envelope.idempotency_key && headerKey !== v2.envelope.idempotency_key) {
            return json(422, { ok: false, error: "idempotency_key_mismatch", retryable: false });
          }
          try {
            const claim = await bridge.claimOsEvent({ key, event: v2.envelope, apiVersion, payloadHash });
            if (claim.kind === "conflict") return json(409, { ok: false, error: "idempotency_key_reused" });
            if (claim.kind === "duplicate") {
              if (claim.status !== "failed" || !(await bridge.releaseFailedClaim(key))) {
                return json(409, { ok: true, status: "duplicate_ignored", outcome: claim.outcome });
              }
            }
            const r = await bridge.applyLeadIngested(key, v2.envelope, v2.lead, v2.phone);
            return json(r.outcome === "lead_created" ? 201 : 200, { ok: true, status: r.outcome, lead_id: r.leadId });
          } catch (error) {
            console.error("[os-bridge] lead_ingested failed", error);
            await bridge.markOsEventFailed(key, error).catch(() => undefined);
            return json(500, { ok: false, error: "processing_failed", retryable: true });
          }
        }

        // ---- Legacy booking/payment envelope: behaviour unchanged ----
        if (!headerKey) return json(400, { ok: false, error: "missing_idempotency_key" });
        if (!bridgeRules.IDEMPOTENCY_KEY_RE.test(headerKey)) return json(400, { ok: false, error: "invalid_idempotency_key" });
        const result = bridgeRules.osEventSchema.safeParse(parsed);
        if (!result.success) {
          const unsupported = result.error.issues.some((i) => i.path[0] === "event_type");
          return json(unsupported ? 422 : 400, {
            ok: false,
            error: unsupported ? "unsupported_event_type" : "invalid_event_schema",
          });
        }
        try {
          const claim = await bridge.claimOsEvent({ key: headerKey, event: result.data, apiVersion, payloadHash });
          if (claim.kind === "conflict") return json(409, { ok: false, error: "idempotency_key_reused" });
          if (claim.kind === "duplicate") {
            if (claim.status !== "failed" || !(await bridge.releaseFailedClaim(headerKey))) {
              return json(200, { ok: true, duplicate: true, status: claim.status, outcome: claim.outcome });
            }
          }
          const outcome = await bridge.applyOsEvent(headerKey, result.data);
          return json(200, { ok: true, duplicate: false, outcome });
        } catch (error) {
          console.error("[os-bridge] processing failed", error);
          await bridge.markOsEventFailed(headerKey, error).catch(() => undefined);
          return json(500, { ok: false, error: "processing_failed", retryable: true });
        }
      },
    },
  },
});
