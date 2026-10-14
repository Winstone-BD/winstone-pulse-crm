import { describe, expect, it } from "vitest";

import { createFailureLimiter, createRateLimiter, rateLimitedResponse, requestSourceKey } from "../src/lib/rate-limit";

const req = (h: Record<string, string>) => new Request("https://x.test/", { headers: h });

describe("rate limiting & client IP", () => {
  it("trusts only the Cloudflare client-IP header", () => {
    expect(requestSourceKey(req({ "cf-connecting-ip": "203.0.113.5" }))).toBe("203.0.113.5");
    expect(requestSourceKey(req({ "x-forwarded-for": "1.2.3.4" }))).toBe("unknown");
    expect(requestSourceKey(req({ "x-device-id": "abc" }))).toBe("unknown");
    expect(
      requestSourceKey(req({ "cf-connecting-ip": "203.0.113.5", "x-forwarded-for": "1.2.3.4" })),
    ).toBe("203.0.113.5");
  });

  it("reports retry-after for both limiters", () => {
    const l = createRateLimiter(1, 60_000);
    expect(l("k", 0)).toBe(true);
    expect(l("k", 1000)).toBe(false);
    expect(l.retryAfter("k", 1000)).toBe(59);
    const f = createFailureLimiter(1, 300_000);
    f.record("k", 0);
    expect(f.check("k", 0)).toBe(false);
    expect(f.retryAfter("k", 0)).toBe(300);
  });

  it("returns a friendly 429 with Retry-After and no internals", async () => {
    const res = rateLimitedResponse(90);
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("90");
    const body = await res.json();
    expect(body.retry_after).toBe(90);
    expect(body.error_en).toContain("2 minutes");
    expect(JSON.stringify(body)).not.toMatch(/ip|bucket|limiter/i);
  });
});
