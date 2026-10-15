import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { redact, stringifyData, isDeadTokenResponse } from "@/lib/outbound-guard";

describe("redaction and FCM rules", () => {
  it("redacts keys and tokens", () => {
    const out = redact('Bearer abc.def lovc_abcdefghij fc-1234567890 AIzaSyABCDEFG "token":"xyz"');
    expect(out).not.toMatch(/lovc_abc|fc-123|AIzaSy|abc\.def|xyz/);
  });
  it("caps length", () => expect(redact("a".repeat(1000)).length).toBe(300));
  it("stringifies data", () => expect(stringifyData({ a: 1, b: "x", c: null, d: { e: 1 } })).toEqual({ a: "1", b: "x", d: '{"e":1}' }));
  it("revokes only dead tokens", () => {
    const unreg = '{"error":{"code":404,"status":"NOT_FOUND","details":[{"@type":"type.googleapis.com/google.firebase.fcm.v1.FcmError","errorCode":"UNREGISTERED"}]}}';
    expect(isDeadTokenResponse(404, unreg)).toBe(true);
    expect(isDeadTokenResponse(404, "<html>Not Found</html>")).toBe(false);
    expect(isDeadTokenResponse(400, '{"error":{"status":"INVALID_ARGUMENT","message":"The registration token is not a valid FCM registration token"}}')).toBe(true);
    expect(isDeadTokenResponse(400, '{"error":{"message":"Invalid value at message.data"}}')).toBe(false);
    expect(isDeadTokenResponse(500, "")).toBe(false);
  });
  it("push uses timeout, dry-run and dead-token rule", () => {
    const src = readFileSync("src/lib/push.server.ts", "utf8");
    expect(src).toMatch(/validate_only: true/);
    expect(src).toMatch(/fetchWithTimeout/);
    expect(src).toMatch(/!dry && isDeadTokenResponse/);
    expect(src).toMatch(/if \(!dry\) \{\n\s+\/\/ Idempotency/);
  });
});

