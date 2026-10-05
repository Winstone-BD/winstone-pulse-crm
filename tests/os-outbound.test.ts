import { describe, expect, it } from "vitest";

import { buildEnvelope, classifyResponse, isDue, nextStatus, validEndpoint } from "@/lib/os-outbound";

describe("CRM → OS booking dispatch rules", () => {
  it("treats 2xx and 409 as delivered", () => {
    expect(classifyResponse(200)).toBe("sent");
    expect(classifyResponse(409)).toBe("sent");
  });
  it("stops on permanent validation errors and retries outages", () => {
    expect(classifyResponse(422)).toBe("dead");
    for (const s of [401, 403, 429, 500, 503, null]) expect(classifyResponse(s)).toBe("retry");
  });
  it("gives up after five attempts", () => {
    expect(nextStatus("retry", 4)).toBe("failed");
    expect(nextStatus("retry", 5)).toBe("dead");
  });
  it("waits the backoff before retrying", () => {
    const at = new Date("2026-10-05T00:00:00Z").getTime();
    const row = { status: "failed", retry_count: 1, processed_at: new Date(at).toISOString() };
    expect(isDue(row, at + 30_000)).toBe(false);
    expect(isDue(row, at + 61_000)).toBe(true);
    expect(isDue({ status: "sent", retry_count: 1, processed_at: null })).toBe(false);
  });
  it("keeps the same idempotency key in the envelope", () => {
    const e = buildEnvelope({ id: "x", idempotency_key: "crm-booking:1", event_type: "crm_to_os_booking.created", created_at: "t", payload: {} });
    expect(e.event_type).toBe("booking.created");
    expect(e.idempotency_key).toBe("crm-booking:1");
  });
  it("accepts only https endpoints", () => {
    expect(validEndpoint("http://os.example")).toBeNull();
    expect(validEndpoint("not a url")).toBeNull();
    expect(validEndpoint("https://os.example/api")).toBe("https://os.example/api");
  });
});
