import { describe, expect, it } from "vitest";
import {
  assertDistributionDay, dhakaDateOf, isBusinessDay, isDistributionDay,
  nextBusinessDay, previousBusinessDay, DistributionBlockedError,
} from "@/lib/business-day";

describe("Friday non-distribution rule (Asia/Dhaka)", () => {
  it("blocks Friday", () => {
    expect(isDistributionDay("2026-10-02")).toBe(false); // Friday
    expect(() => assertDistributionDay("2026-10-02")).toThrow(DistributionBlockedError);
  });
  it("allows Saturday and other days", () => {
    for (const d of ["2026-10-03", "2026-10-04", "2026-10-01", "2026-09-28"]) {
      expect(isDistributionDay(d)).toBe(true);
      expect(() => assertDistributionDay(d)).not.toThrow();
    }
  });
  it("uses Dhaka date, not UTC", () => {
    // Thu 2026-10-01 19:00 UTC = Fri 01:00 Dhaka
    expect(dhakaDateOf(Date.UTC(2026, 9, 1, 19))).toBe("2026-10-02");
    expect(isDistributionDay(dhakaDateOf(Date.UTC(2026, 9, 1, 19)))).toBe(false);
    // Fri 2026-10-02 18:30 UTC = Sat 00:30 Dhaka
    expect(isDistributionDay(dhakaDateOf(Date.UTC(2026, 9, 2, 18, 30)))).toBe(true);
  });
  it("accountability skips Friday", () => {
    expect(isBusinessDay("2026-10-02")).toBe(false);
    expect(nextBusinessDay("2026-10-01")).toBe("2026-10-03");
    expect(previousBusinessDay("2026-10-03")).toBe("2026-10-01");
    expect(nextBusinessDay("2026-10-03")).toBe("2026-10-04");
  });
});
