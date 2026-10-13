import { describe, expect, it } from "vitest";
import { stagingBlocker } from "./staging/guard";

const ok = { STAGING_E2E: "1", SUPABASE_URL: "https://abcdefghijklmnopqrst.supabase.co", STAGING_CONFIRM: "abcdefghijklmnopqrst" };

describe("staging guard fails closed", () => {
  it("passes only a confirmed non-live backend", () => expect(stagingBlocker(ok)).toBeNull());
  it("blocks without opt-in", () => expect(stagingBlocker({ ...ok, STAGING_E2E: undefined })).toMatch(/not set/));
  it("blocks the live backend", () =>
    expect(stagingBlocker({ ...ok, SUPABASE_URL: "https://siepfegeubbqwhodyxcg.supabase.co", STAGING_CONFIRM: "siepfegeubbqwhodyxcg" })).toMatch(/LIVE/));
  it("blocks unknown hosts (proxies, localhost)", () =>
    expect(stagingBlocker({ ...ok, SUPABASE_URL: "http://localhost:54321" })).toMatch(/unknown/));
  it("blocks mismatched confirmation", () => expect(stagingBlocker({ ...ok, STAGING_CONFIRM: "x" })).toMatch(/exactly/));
  it("blocks the live site as app URL", () =>
    expect(stagingBlocker({ ...ok, STAGING_APP_URL: "https://crm.winstonebd.com" })).toMatch(/live site/));
});
