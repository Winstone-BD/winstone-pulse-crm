import { describe, expect, it } from "vitest";

import { DEFAULT_DAILY_QUOTA, hasFixedQuota, quotaFor, ratioScore } from "@/lib/lead-quota";
import { SUPPORT_CATEGORIES, categoryLabel } from "@/lib/team-support-shared";

describe("daily quota", () => {
  it("gives every ordinary desk the floor-wide round", () => {
    expect(DEFAULT_DAILY_QUOTA).toBe(25);
    expect(quotaFor("WIN2601", 25)).toBe(25);
    expect(hasFixedQuota("WIN2601")).toBe(false);
  });

  it("keeps the Sell Team Admin on a lighter fixed round", () => {
    expect(quotaFor("WIN2607", 25)).toBe(15);
    expect(quotaFor("win2607", 40)).toBe(15);
    expect(hasFixedQuota("WIN2607")).toBe(true);
  });

  it("scores a full day as a full day, whatever the quota", () => {
    // 15 of 15 and 25 of 25 both mean "finished today's round".
    expect(ratioScore(15, 15)).toBe(ratioScore(25, 25));
  });

  it("does not reward or punish a lighter round", () => {
    // 80% on either quota lands on the same normalised score.
    expect(ratioScore(12, 15)).toBe(ratioScore(20, 25));
  });
});

describe("support categories", () => {
  it("labels every category in Bengali", () => {
    expect(SUPPORT_CATEGORIES.length).toBeGreaterThan(5);
    for (const item of SUPPORT_CATEGORIES) expect(item.label.trim().length).toBeGreaterThan(0);
    expect(categoryLabel("crm_problem")).toBe(
      SUPPORT_CATEGORIES.find((c) => c.key === "crm_problem")?.label,
    );
  });

  it("falls back to the raw value for an unknown category", () => {
    expect(categoryLabel("something_else")).toBe("something_else");
  });
});
