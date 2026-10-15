import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { checkOutboundUrl, redact, stringifyData, isDeadTokenResponse } from "@/lib/outbound-guard";
import { firecrawlRequest } from "@/lib/firecrawl.server";
import { placesRequest, PLACES_FIELD_MASK } from "@/lib/maps.server";

describe("SSRF guard", () => {
  it.each([
    ["http://winstonebd.com", "https_only"],
    ["https://127.0.0.1/", "ip_literal_not_allowed"],
    ["https://169.254.169.254/latest", "ip_literal_not_allowed"],
    ["https://[::1]/", "ip_literal_not_allowed"],
    ["https://2130706433/", "ip_literal_not_allowed"],
    ["https://localhost/", "internal_host"],
    ["https://db.internal/", "internal_host"],
    ["https://u:p@winstonebd.com/", "credentials_in_url"],
    ["https://winstonebd.com:8443/", "port_not_allowed"],
    ["https://evil.com/", "host_not_allowlisted"],
    ["https://winstonebd.com.evil.com/", "host_not_allowlisted"],
    ["file:///etc/passwd", "https_only"],
  ])("blocks %s", (url, reason) => {
    expect(checkOutboundUrl(url)).toEqual({ ok: false, reason });
  });
  it("allows the site and subdomains", () => {
    expect(checkOutboundUrl("https://winstonebd.com/projects").ok).toBe(true);
    expect(checkOutboundUrl("https://blog.winstonebd.com/").ok).toBe(true);
  });
});

describe("redaction and FCM rules", () => {
  it("redacts keys and tokens", () => {
    const out = redact('Bearer abc.def lovc_abcdefghij fc-1234567890 AIzaSyABCDEFG "token":"xyz"');
    expect(out).not.toMatch(/lovc_abc|fc-123|AIzaSy|abc\.def|xyz/);
  });
  it("caps length", () => expect(redact("a".repeat(1000)).length).toBe(300));
  it("stringifies data", () => expect(stringifyData({ a: 1, b: "x", c: null, d: { e: 1 } })).toEqual({ a: "1", b: "x", d: '{"e":1}' }));
  it("revokes only dead tokens", () => {
    expect(isDeadTokenResponse(404, "")).toBe(true);
    expect(isDeadTokenResponse(400, '{"error":{"status":"INVALID_ARGUMENT","message":"The registration token is not a valid FCM registration token"}}')).toBe(true);
    expect(isDeadTokenResponse(400, '{"error":{"message":"Invalid value at message.data"}}')).toBe(false);
    expect(isDeadTokenResponse(500, "")).toBe(false);
  });
  it("push uses timeout, dry-run and dead-token rule", () => {
    const src = readFileSync("src/lib/push.server.ts", "utf8");
    expect(src).toMatch(/validate_only: true/);
    expect(src).toMatch(/fetchWithTimeout/);
    expect(src).toMatch(/isDeadTokenResponse/);
  });
});

describe("Firecrawl and Places requests", () => {
  it("gateway mode for lovc_ keys, direct for fc- keys", () => {
    const g = firecrawlRequest("lovc_x", "lk")!;
    expect(g.base).toContain("connector-gateway.lovable.dev/firecrawl/v2");
    expect(g.headers["X-Connection-Api-Key"]).toBe("lovc_x");
    const d = firecrawlRequest("fc-x", "lk")!;
    expect(d.base).toBe("https://api.firecrawl.dev/v2");
    expect(d.headers).not.toHaveProperty("X-Connection-Api-Key");
    expect(firecrawlRequest("lovc_x", undefined)).toBeNull();
  });
  it("Places always sends a field mask and bounded query", () => {
    const r = placesRequest("x".repeat(500), "k");
    expect((r.init.headers as Record<string, string>)["X-Goog-FieldMask"]).toBe(PLACES_FIELD_MASK);
    expect(JSON.parse(r.init.body as string).textQuery.length).toBe(200);
  });
  it("server functions require HQ/IT authority and rate limiting", () => {
    const src = readFileSync("src/lib/external-data.functions.ts", "utf8");
    expect(src).toMatch(/scope !== "authority"/);
    expect(src).toMatch(/createRateLimiter/);
    expect(src).not.toMatch(/^import .*\.server"/m);
  });
});
