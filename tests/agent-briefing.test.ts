import { describe, expect, it } from "vitest";
import { AGENT_BRIEFING_POLICY_VERSION, briefingRequiredAt, dhakaBriefingClock } from "@/lib/agent-briefing.server";

describe("daily 9:05 agent briefing gate", () => {
  it("is open immediately before 9:05 Dhaka", () => {
    expect(briefingRequiredAt(Date.parse("2026-09-30T03:04:59Z"))).toBe(false);
  });

  it("locks exactly at 9:05 Dhaka", () => {
    expect(briefingRequiredAt(Date.parse("2026-09-30T03:05:00Z"))).toBe(true);
  });

  it("uses Dhaka business date across the UTC boundary", () => {
    expect(dhakaBriefingClock(Date.parse("2026-09-30T19:00:00Z"))).toEqual({
      businessDate: "2026-10-01",
      minuteOfDay: 60,
    });
  });

  it("has an explicit version so policy changes require a new acknowledgement", () => {
    expect(AGENT_BRIEFING_POLICY_VERSION).toMatch(/^\d{4}-\d{2}-\d{2}-v\d+$/);
  });
});