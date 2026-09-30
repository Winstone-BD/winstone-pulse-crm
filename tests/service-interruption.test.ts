import { describe, expect, it } from "vitest";

import { CRM_CLOSURE_START_MS, isCrmClosureActive } from "../src/lib/service-interruption";

describe("temporary CRM closure", () => {
  it("stays inactive immediately before 11:30 AM Dhaka", () => {
    expect(isCrmClosureActive(Date.parse("2026-09-30T05:29:59.999Z"))).toBe(false);
  });

  it("activates exactly at 11:30 AM Dhaka", () => {
    expect(CRM_CLOSURE_START_MS).toBe(Date.parse("2026-09-30T05:30:00.000Z"));
    expect(isCrmClosureActive(Date.parse("2026-09-30T05:30:00.000Z"))).toBe(true);
  });

  it("remains active after the scheduled start", () => {
    expect(isCrmClosureActive(Date.parse("2026-10-01T00:00:00.000Z"))).toBe(true);
  });
});