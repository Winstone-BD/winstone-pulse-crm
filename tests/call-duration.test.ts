import { describe, expect, it } from "vitest";
import { resolveCallDuration, webStopwatchSeconds } from "../src/lib/call-duration";

describe("call duration", () => {
  it("uses the phone-reported time over the stored time", () => {
    expect(resolveCallDuration({ phoneSeconds: 95, storedSeconds: 234083, enteredSeconds: 60 })).toBe(95);
  });
  it("ignores an impossible stored time and falls back to the entered time", () => {
    expect(resolveCallDuration({ phoneSeconds: null, storedSeconds: 234083, enteredSeconds: 120 })).toBe(120);
  });
  it("never counts a multi-day web stopwatch as talk time", () => {
    expect(webStopwatchSeconds(0 + 1, 234083 * 1000)).toBe(0);
    expect(webStopwatchSeconds(1000, 1000 + 90_000)).toBe(90);
  });
});

import { pickPhoneMeasuredSeconds } from "@/lib/call-duration";
describe("web call uses phone-measured time", () => {
  const opened = "2026-10-18T10:10:00Z";
  it("takes the phone call-log duration for the same call", () => {
    expect(pickPhoneMeasuredSeconds(opened, [{ started_at: "2026-10-18T10:05:00Z", duration_seconds: 187, call_source: "call_log" }])).toBe(187);
  });
  it("ignores web stopwatch rows and calls older than 3 hours", () => {
    expect(pickPhoneMeasuredSeconds(opened, [
      { started_at: "2026-10-18T10:05:00Z", duration_seconds: 900, call_source: "web" },
      { started_at: "2026-10-18T06:00:00Z", duration_seconds: 60, call_source: "android_sim" },
    ])).toBeNull();
  });
});
