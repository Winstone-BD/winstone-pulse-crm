import { beforeEach, describe, expect, it, vi } from "vitest";
import { canonicalBdPhone, hmacHex, parseV2Envelope, verifyBearer } from "@/lib/os-bridge";

// Isolated: the DB layer is mocked — no rows are ever written.
const bridge = vi.hoisted(() => ({
  claimOsEvent: vi.fn(),
  releaseFailedClaim: vi.fn(),
  applyLeadIngested: vi.fn(),
  applyOsEvent: vi.fn(),
  markOsEventFailed: vi.fn(),
}));
vi.mock("@/lib/os-bridge.server", () => bridge);

const SECRET = "test-secret-not-real-0123456789";
const lead = {
  external_lead_id: "ext-1",
  source: "meta_ads",
  contact: { name: "Test Person", phone: "01712345678", email: "t@example.test", city: "Dhaka" },
  qualification: { project_interest: "x", intent_level: "high", ai_confidence_score: 0.8 },
  metadata: { campaign_id: "c1", operator_id: "o1" },
};
const envelope = (o: Record<string, unknown> = {}) => ({
  event_id: "evt-1",
  event_type: "lead_ingested",
  idempotency_key: "idem-key-0001",
  occurred_at: "2026-10-03T10:00:00+06:00",
  payload: lead,
  ...o,
});

async function post(body: unknown, headers: Record<string, string> = { authorization: `Bearer ${SECRET}` }) {
  const { Route } = await import("@/routes/api/public/os/events");
  const handlers = (Route.options as any).server.handlers;
  const req = new Request("http://x/api/public/os/events", {
    method: "POST",
    headers: { "content-type": "application/json", "cf-connecting-ip": String(Math.random()), ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
  const res: Response = await handlers.POST({ request: req });
  return { status: res.status, body: await res.json() };
}

describe("unified envelope parsing", () => {
  it("accepts a valid lead_ingested and canonicalises +880", () => {
    const r = parseV2Envelope(envelope());
    expect(r.ok && r.phone).toBe("8801712345678");
  });
  it("rejects unknown discriminator, bad payload and non-BD phone with 422", () => {
    expect(parseV2Envelope(envelope({ event_type: "x" }))).toMatchObject({ ok: false, status: 422, error: "unsupported_event_type" });
    expect(parseV2Envelope(envelope({ payload: { ...lead, contact: { name: "a" } } }))).toMatchObject({ error: "invalid_payload" });
    expect(parseV2Envelope(envelope({ payload: { ...lead, contact: { ...lead.contact, phone: "12345678" } } }))).toMatchObject({ error: "invalid_phone" });
    expect(canonicalBdPhone("+880 1712-345678")).toBe("8801712345678");
  });
  it("bearer check is exact", () => {
    expect(verifyBearer(SECRET, `Bearer ${SECRET}`)).toBe(true);
    expect(verifyBearer(SECRET, `Bearer ${SECRET}x`)).toBe(false);
    expect(verifyBearer(SECRET, null)).toBe(false);
  });
});

describe("receiver route", () => {
  beforeEach(() => {
    vi.stubEnv("CRM_BRIDGE_SECRET", SECRET);
    Object.values(bridge).forEach((f) => f.mockReset());
  });

  it("503 when secret is not configured", async () => {
    vi.stubEnv("CRM_BRIDGE_SECRET", "");
    expect((await post(envelope())).status).toBe(503);
  });
  it("401 on missing or wrong auth", async () => {
    expect((await post(envelope(), {})).status).toBe(401);
    expect((await post(envelope(), { authorization: "Bearer nope" })).status).toBe(401);
    expect((await post(envelope(), { "x-winstone-signature": "deadbeef", "x-winstone-timestamp": String(Math.floor(Date.now() / 1000)) })).status).toBe(401);
  });
  it("201 on new lead, routed to canonical intake", async () => {
    bridge.claimOsEvent.mockResolvedValue({ kind: "fresh" });
    bridge.applyLeadIngested.mockResolvedValue({ outcome: "lead_created", leadId: "L1" });
    const r = await post(envelope());
    expect(r.status).toBe(201);
    expect(bridge.applyLeadIngested.mock.calls[0]?.[3]).toBe("8801712345678");
  });
  it("200 when the phone already exists", async () => {
    bridge.claimOsEvent.mockResolvedValue({ kind: "fresh" });
    bridge.applyLeadIngested.mockResolvedValue({ outcome: "lead_exists", leadId: "L1" });
    expect((await post(envelope())).status).toBe(200);
  });
  it("409 duplicate_ignored on replay", async () => {
    bridge.claimOsEvent.mockResolvedValue({ kind: "duplicate", status: "processed", outcome: "lead_created" });
    const r = await post(envelope());
    expect(r).toMatchObject({ status: 409, body: { status: "duplicate_ignored" } });
    expect(bridge.applyLeadIngested).not.toHaveBeenCalled();
  });
  it("422 validation is non-retryable, incl. missing idempotency key", async () => {
    const r = await post(envelope({ payload: {} }));
    expect(r).toMatchObject({ status: 422, body: { retryable: false } });
    const { idempotency_key: _k, ...noKey } = envelope();
    expect((await post(noKey)).status).toBe(422);
  });
  it("500 retryable on transient failure and marks receipt failed", async () => {
    bridge.claimOsEvent.mockResolvedValue({ kind: "fresh" });
    bridge.applyLeadIngested.mockRejectedValue(new Error("db down"));
    const r = await post(envelope());
    expect(r).toMatchObject({ status: 500, body: { retryable: true } });
    expect(bridge.markOsEventFailed).toHaveBeenCalled();
  });
  it("HMAC auth still works for the unified envelope", async () => {
    bridge.claimOsEvent.mockResolvedValue({ kind: "fresh" });
    bridge.applyLeadIngested.mockResolvedValue({ outcome: "lead_created", leadId: "L1" });
    const body = JSON.stringify(envelope());
    const ts = String(Math.floor(Date.now() / 1000));
    const sig = await hmacHex(SECRET, `${ts}.${body}`);
    expect((await post(body, { "x-winstone-signature": sig, "x-winstone-timestamp": ts })).status).toBe(201);
  });
  it("legacy booking/payment envelope is unchanged (200 + duplicate:true)", async () => {
    const legacy = { event_id: "e1", event_type: "payment.updated", occurred_at: "2026-10-03T10:00:00Z", data: { payment_status: "paid" } };
    const body = JSON.stringify(legacy);
    const ts = String(Math.floor(Date.now() / 1000));
    const sig = await hmacHex(SECRET, `${ts}.${body}`);
    const h = { "x-winstone-signature": sig, "x-winstone-timestamp": ts, "x-idempotency-key": "legacy-key-001" };
    bridge.claimOsEvent.mockResolvedValue({ kind: "fresh" });
    bridge.applyOsEvent.mockResolvedValue("no_target");
    expect(await post(body, h)).toMatchObject({ status: 200, body: { outcome: "no_target" } });
    bridge.claimOsEvent.mockResolvedValue({ kind: "duplicate", status: "processed", outcome: "no_target" });
    expect(await post(body, h)).toMatchObject({ status: 200, body: { duplicate: true } });
    expect(bridge.applyLeadIngested).not.toHaveBeenCalled();
  });
});
