import { describe, expect, it } from "vitest";

import { DURATION_MISMATCH_TOLERANCE_SECONDS } from "@/lib/call-reports.functions";

/** Mirrors the server filter in listDurationMismatches. */
function isMismatch(stored: number, phone: number): boolean {
  return Math.abs(stored - phone) > DURATION_MISMATCH_TOLERANCE_SECONDS;
}

describe("duration mismatch flagging", () => {
  it("uses a 15-second tolerance", () => {
    expect(DURATION_MISMATCH_TOLERANCE_SECONDS).toBe(15);
  });

  it("flags differences above 15 seconds", () => {
    expect(isMismatch(0, 16)).toBe(true);
    expect(isMismatch(300, 60)).toBe(true);
  });

  it("ignores differences within 15 seconds", () => {
    expect(isMismatch(100, 115)).toBe(false);
    expect(isMismatch(100, 100)).toBe(false);
  });
});
