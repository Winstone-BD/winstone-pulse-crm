import { describe, expect, it } from "vitest";

import { DEFAULT_DAILY_QUOTA, hasFixedQuota, quotaFor, ratioScore } from "@/lib/lead-quota";

describe("daily lead quota", () => {
  it("gives the Sell Team Admin a fixed 15-lead round", () => {
    expect(quotaFor("WIN2607", 30)).toBe(15);
    expect(quotaFor("win2607", 40)).toBe(15);
    expect(hasFixedQuota("WIN2607")).toBe(true);
  });

  it("leaves every other desk on the floor-wide round", () => {
    expect(quotaFor("WIN2601", 30)).toBe(30);
    expect(quotaFor(null, 25)).toBe(25);
    expect(hasFixedQuota("WIN2601")).toBe(false);
  });

  it("compares performance as a ratio so a lighter quota is not punished", () => {
    // Half the leads, half the raw score — identical ratio score.
    expect(ratioScore(40, 15)).toBe(ratioScore(80, 30));
    expect(ratioScore(30, DEFAULT_DAILY_QUOTA)).toBe(30);
  });
});
