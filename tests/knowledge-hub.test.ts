import { describe, expect, it } from "vitest";
import { dedupeByLink, finalizeCitedAnswer, isHubPublicPage, NO_SOURCE_ANSWER, parseHubFeed, pinOfficialFirst } from "@/lib/knowledge-hub-rules";
import { canonicalBdPhone, parseV2Envelope } from "@/lib/os-bridge";

describe("hub public-page allowlist", () => {
  it("allows only /projects/*, /faq, /news/*", () => {
    expect(isHubPublicPage("https://winstonebd.com/projects/winstone-heights")).toBe(true);
    expect(isHubPublicPage("https://winstonebd.com/faq")).toBe(true);
    expect(isHubPublicPage("https://winstonebd.com/news/launch-2026")).toBe(true);
    for (const bad of [
      "https://winstonebd.com/admin", "https://winstonebd.com/", "http://winstonebd.com/faq",
      "https://evil.com/projects/x", "https://winstonebd.com.evil.com/faq", "https://user:p@winstonebd.com/faq",
      "https://winstonebd.com:8443/faq", "https://winstonebd.com/projects/x?redirect=http://169.254.169.254",
      "https://winstonebd.com/projects/../admin", "https://sub.winstonebd.com/faq", "not a url",
    ]) expect(isHubPublicPage(bad)).toBe(false);
  });
});

describe("official news feed", () => {
  const rss = `<rss><channel>
    <item><title>A</title><link>https://winstonebd.com/news/a</link><pubDate>Sun, 11 Oct 2026 08:00:00 GMT</pubDate><description>x</description></item>
    <item><title>A dup</title><link>https://winstonebd.com/news/a/</link></item>
    <item><title>Off-site</title><link>https://evil.com/news/b</link></item>
  </channel></rss>`;
  it("keeps original title/date/link, dedupes by link, drops off-site", () => {
    const items = parseHubFeed(rss);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ title: "A", link: "https://winstonebd.com/news/a", publishedAt: "2026-10-11T08:00:00.000Z" });
  });
  it("tolerates JSON feeds", () => {
    expect(parseHubFeed(JSON.stringify({ items: [{ title: "J", url: "https://winstonebd.com/news/j" }] }))[0]?.title).toBe("J");
    expect(parseHubFeed("{bad")).toEqual([]);
  });
  it("dedupeByLink ignores trailing slash / query", () => {
    expect(dedupeByLink([{ link: "https://winstonebd.com/news/a" }, { link: "https://winstonebd.com/news/a/?u=1" }])).toHaveLength(1);
  });
  it("pins fresh official items first, stable otherwise", () => {
    const now = Date.parse("2026-10-11T00:00:00Z");
    const r = pinOfficialFirst([
      { id: 1, origin: "auto", created_at: "2026-10-10T00:00:00Z" },
      { id: 2, origin: "official", created_at: "2026-10-09T00:00:00Z" },
      { id: 3, origin: "official", created_at: "2026-08-01T00:00:00Z" },
    ], now);
    expect(r.map((x) => x.id)).toEqual([2, 1, 3]);
  });
});

describe("phone normalization", () => {
  it("canonicalises BD mobiles", () => {
    for (const p of ["01712345678", "+8801712345678", "8801712345678", "1712345678", "017-1234 5678"]) expect(canonicalBdPhone(p)).toBe("8801712345678");
    expect(canonicalBdPhone("01212345678")).toBeNull();
    expect(canonicalBdPhone("12345")).toBeNull();
  });
});

describe("site_visit.requested schema (fail closed)", () => {
  const env = (payload: unknown, extra: Record<string, unknown> = {}) => ({
    event_id: "evt_1", event_type: "site_visit.requested", occurred_at: "2026-10-11T10:00:00+06:00", payload, ...extra,
  });
  const ok = { request_id: "hub_r1", name: "Rahim", phone: "01712345678", project: "winstone-heights", visitors: 2 };
  it("accepts a valid request and never yields a confirmed visit", () => {
    const r = parseV2Envelope(env(ok));
    expect(r.ok).toBe(true);
    if (r.ok && r.kind === "site_visit.requested") {
      expect(r.phone).toBe("8801712345678");
      expect(r.visit).not.toHaveProperty("status");
      expect(r.visit).not.toHaveProperty("visit_at");
    }
  });
  it("rejects unknown fields, bad phone, missing id, unknown type", () => {
    expect(parseV2Envelope(env({ ...ok, status: "confirmed" })).ok).toBe(false);
    expect(parseV2Envelope(env({ ...ok, phone: "12345" })).ok).toBe(false);
    expect(parseV2Envelope(env({ ...ok, request_id: "" })).ok).toBe(false);
    expect(parseV2Envelope(env(ok, { event_type: "site_visit.confirmed" })).ok).toBe(false);
    expect(parseV2Envelope(env(ok, { extra: 1 })).ok).toBe(false);
  });
});

describe("cited answers", () => {
  it("falls back exactly when not covered or no sources", () => {
    expect(finalizeCitedAnswer({ answer: "x", covered: false }, [{ url: "u" }])).toEqual({ answer: NO_SOURCE_ANSWER, covered: false, sources: [] });
    expect(finalizeCitedAnswer({ answer: "x", covered: true }, []).answer).toBe("তথ্য পাওয়া যায়নি — অনুমান করবেন না");
    expect(finalizeCitedAnswer({ answer: "ok", covered: true }, [{ url: "https://winstonebd.com/faq" }]).sources).toHaveLength(1);
  });
});

import { hmacHex, verifyOsRequest } from "@/lib/os-bridge";
describe("signed event verification (before parsing)", () => {
  const secret = "test-secret-not-real";
  const body = JSON.stringify({ event_id: "e", event_type: "site_visit.requested", occurred_at: "2026-10-11T10:00:00Z", payload: {} });
  const now = 1_791_720_000;
  it("accepts valid, rejects tampered, stale and replayed-old timestamps", async () => {
    const sig = await hmacHex(secret, `${now}.${body}`);
    const base = { secret, rawBody: body, timestamp: String(now), signature: `sha256=${sig}`, idempotencyKey: "hub_r1_key", nowSeconds: now };
    expect(await verifyOsRequest(base)).toBeNull();
    expect(await verifyOsRequest({ ...base, rawBody: body + " " })).toBe("invalid_signature");
    expect(await verifyOsRequest({ ...base, nowSeconds: now + 301 })).toBe("stale_timestamp");
    expect(await verifyOsRequest({ ...base, signature: null })).toBe("missing_signature");
  });
});

import { visitRequestVisible } from "@/lib/knowledge-hub-rules";
describe("visit request authorization", () => {
  it("assigned agent yes, other agent no, HQ/IT yes, unassigned hidden from agents", () => {
    expect(visitRequestVisible({ scope: "agent", agentId: "a1" }, "a1")).toBe(true);
    expect(visitRequestVisible({ scope: "agent", agentId: "a2" }, "a1")).toBe(false);
    expect(visitRequestVisible({ scope: "agent", agentId: null }, null)).toBe(false);
    expect(visitRequestVisible({ scope: "authority" }, "a1")).toBe(true);
  });
});
