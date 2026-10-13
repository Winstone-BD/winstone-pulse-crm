import { describe, expect, it } from "vitest";
import { stagingBlocker, verifyAppBackend } from "./staging/guard";

const ok = {
  STAGING_E2E: "1",
  SUPABASE_URL: "https://abcdefghijklmnopqrst.supabase.co",
  STAGING_CONFIRM: "abcdefghijklmnopqrst",
  STAGING_APP_URL: "https://staging-example.lovable.app",
  STAGING_APP_ALLOWLIST: "staging-example.lovable.app",
};

const meta = (servers: string[]) =>
  (async () => new Response(JSON.stringify({ authorization_servers: servers }))) as unknown as typeof fetch;

describe("staging guard fails closed", () => {
  it("passes only a fully confirmed staging target", () => expect(stagingBlocker(ok)).toBeNull());
  it("blocks without opt-in", () => expect(stagingBlocker({ ...ok, STAGING_E2E: undefined })).toMatch(/not set/));
  it("blocks the live backend", () =>
    expect(stagingBlocker({ ...ok, SUPABASE_URL: "https://siepfegeubbqwhodyxcg.supabase.co", STAGING_CONFIRM: "siepfegeubbqwhodyxcg" })).toMatch(/LIVE/));
  it("blocks unknown hosts (proxies, localhost, http)", () =>
    expect(stagingBlocker({ ...ok, SUPABASE_URL: "http://localhost:54321" })).toMatch(/unknown/));
  it("blocks mismatched confirmation", () => expect(stagingBlocker({ ...ok, STAGING_CONFIRM: "x" })).toMatch(/exactly/));
  it("requires an app URL", () => expect(stagingBlocker({ ...ok, STAGING_APP_URL: undefined })).toMatch(/missing/));
  it("blocks the live site and its preview even if allow-listed", () => {
    for (const h of ["crm.winstonebd.com", "winstone-pulse-crm.lovable.app", "id-preview--990267f3-4198-4d83-ae21-7d9c802617f4.lovable.app"])
      expect(stagingBlocker({ ...ok, STAGING_APP_URL: `https://${h}`, STAGING_APP_ALLOWLIST: h })).toMatch(/live site/);
  });
  it("blocks hosts not on the allow-list", () =>
    expect(stagingBlocker({ ...ok, STAGING_APP_ALLOWLIST: "" })).toMatch(/ALLOWLIST/));
  it("blocks non-https app URLs", () =>
    expect(stagingBlocker({ ...ok, STAGING_APP_URL: "http://staging-example.lovable.app" })).toMatch(/https/));
});

describe("app backend verification", () => {
  it("accepts an app whose issuer is the staging ref", async () =>
    expect(verifyAppBackend("https://s", "abcdefghijklmnopqrst", meta(["https://abcdefghijklmnopqrst.supabase.co/auth/v1"]))).resolves.toBeUndefined());
  it("refuses an app that signs in against live", async () =>
    expect(verifyAppBackend("https://s", "abcdefghijklmnopqrst", meta(["https://siepfegeubbqwhodyxcg.supabase.co/auth/v1"]))).rejects.toThrow(/LIVE/));
  it("refuses a mismatched or missing issuer", async () =>
    expect(verifyAppBackend("https://s", "abcdefghijklmnopqrst", meta([]))).rejects.toThrow(/does not match/));
});
