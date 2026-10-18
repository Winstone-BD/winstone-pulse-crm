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
