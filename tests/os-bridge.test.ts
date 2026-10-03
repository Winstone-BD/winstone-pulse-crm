import { describe, expect, it } from "vitest";
import { hmacHex, osEventSchema, verifyOsRequest } from "@/lib/os-bridge";

const secret = "test-secret";
const now = 1_790_000_000;
const body = JSON.stringify({
  event_id: "evt_1",
  event_type: "booking.cancelled",
  occurred_at: "2026-10-03T06:00:00Z",
  data: { crm_booking_id: "11111111-1111-4111-8111-111111111111" },
});
const sign = (ts: string, b = body) => hmacHex(secret, `${ts}.${b}`);
const base = { secret, rawBody: body, nowSeconds: now, idempotencyKey: "idem-key-0001" };

describe("Winstone OS receiver", () => {
  it("rejects unsigned", async () => {
    expect(await verifyOsRequest({ ...base, timestamp: String(now), signature: null })).toBe("missing_signature");
  });
  it("rejects bad signature", async () => {
    expect(await verifyOsRequest({ ...base, timestamp: String(now), signature: "ab".repeat(32) })).toBe("invalid_signature");
  });
  it("rejects tampered body", async () => {
    const sig = await sign(String(now));
    expect(await verifyOsRequest({ ...base, rawBody: body + " ", timestamp: String(now), signature: sig })).toBe("invalid_signature");
  });
  it("rejects stale timestamp", async () => {
    const ts = String(now - 301);
    expect(await verifyOsRequest({ ...base, timestamp: ts, signature: await sign(ts) })).toBe("stale_timestamp");
  });
  it("rejects missing/invalid idempotency key", async () => {
    const ts = String(now);
    const sig = await sign(ts);
    expect(await verifyOsRequest({ ...base, idempotencyKey: null, timestamp: ts, signature: sig })).toBe("missing_idempotency_key");
    expect(await verifyOsRequest({ ...base, idempotencyKey: "bad key!", timestamp: ts, signature: sig })).toBe("invalid_idempotency_key");
  });
  it("accepts a valid signed event (sha256= prefix too)", async () => {
    const ts = String(now);
    const sig = await sign(ts);
    expect(await verifyOsRequest({ ...base, timestamp: ts, signature: sig })).toBeNull();
    expect(await verifyOsRequest({ ...base, timestamp: ts, signature: `sha256=${sig}` })).toBeNull();
    expect(osEventSchema.safeParse(JSON.parse(body)).success).toBe(true);
  });
  it("rejects malformed and unsupported payloads", () => {
    expect(osEventSchema.safeParse({ event_id: "x" }).success).toBe(false);
    expect(osEventSchema.safeParse({ ...JSON.parse(body), event_type: "lead.deleted" }).success).toBe(false);
    expect(osEventSchema.safeParse({ ...JSON.parse(body), data: { lead_id: "not-a-uuid" } }).success).toBe(false);
    expect(osEventSchema.safeParse({ ...JSON.parse(body), data: { extra: 1 } }).success).toBe(false);
  });
  it("duplicate keys are deterministic: same body hashes identically", async () => {
    const { sha256Hex } = await import("@/lib/os-bridge");
    expect(await sha256Hex(body)).toBe(await sha256Hex(body));
    expect(await sha256Hex(body)).not.toBe(await sha256Hex(body + "x"));
  });
});
