import { describe, expect, it } from "vitest";
import { isParked, nextOpenSlot, planNoAnswer, RetryPlanError, dhakaSlotIso } from "@/lib/no-answer-cadence";

// Mon 2026-10-12 12:00 Dhaka
const NOW = Date.parse("2026-10-12T06:00:00Z");

describe("did-not-receive cadence", () => {
  it("attempt 1 defaults to +2 days morning", () => {
    const p = planNoAnswer(1, null, NOW);
    expect(p.stage).toBe("snooze");
    expect(p.retryAt).toBe(dhakaSlotIso("2026-10-14", "10:30"));
  });
  it("attempt 2 is +3 days with soft message stage", () => {
    const p = planNoAnswer(2, { mode: "plus3", slot: "evening" }, NOW);
    expect(p.stage).toBe("snooze_soft");
    expect(p.retryAt).toBe(dhakaSlotIso("2026-10-15", "18:00"));
  });
  it("attempt 3 goes to unresponsive, 7 days later, ignoring the pick", () => {
    const p = planNoAnswer(3, { mode: "plus2", slot: "evening" }, NOW);
    expect(p.stage).toBe("unresponsive");
    expect(p.retryAt).toBe(dhakaSlotIso("2026-10-19", "10:30"));
  });
  it("Friday moves to Saturday same slot", () => {
    // Wed 10-14 + 2 = Fri 10-16
    const wed = Date.parse("2026-10-14T06:00:00Z");
    const p = planNoAnswer(1, { mode: "plus2", slot: "afternoon" }, wed);
    expect(p.moved).toBe(true);
    expect(p.retryAt).toBe(dhakaSlotIso("2026-10-17", "15:00"));
  });
  it("holidays are skipped too", () => {
    const r = nextOpenSlot(dhakaSlotIso("2026-10-17", "10:30"), ["2026-10-17"]);
    expect(r.at).toBe(dhakaSlotIso("2026-10-18", "10:30"));
  });
  it("refuses a past custom time", () => {
    expect(() => planNoAnswer(1, { mode: "custom", slot: "custom", customAt: "2026-10-11T06:00:00Z" }, NOW)).toThrow(RetryPlanError);
  });
  it("parked leads stay off the dial list until due", () => {
    expect(isParked({ work_state: "snoozed", retry_after: "2026-10-14T00:00:00Z" }, NOW)).toBe(true);
    expect(isParked({ work_state: "snoozed", retry_after: "2026-10-11T00:00:00Z" }, NOW)).toBe(false);
    expect(isParked({ work_state: "pending", retry_after: "2026-10-14T00:00:00Z" }, NOW)).toBe(false);
  });
});
