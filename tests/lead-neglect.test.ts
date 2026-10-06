import { describe, expect, it } from "vitest";
import { businessDaysSince, neglectStage } from "@/lib/lead-neglect";

describe("lead neglect stages (Friday excluded)", () => {
  it("no notice on assignment day", () => {
    expect(neglectStage("2026-10-04", "2026-10-04")).toEqual({ kind: "none" });
  });
  it("three notices then recall", () => {
    // Sun 10-04 given → Mon 1, Tue 2, Wed 3, Thu recall
    expect(neglectStage("2026-10-04", "2026-10-05")).toEqual({ kind: "notice", day: 1 });
    expect(neglectStage("2026-10-04", "2026-10-07")).toEqual({ kind: "notice", day: 3 });
    expect(neglectStage("2026-10-04", "2026-10-08")).toEqual({ kind: "recall" });
  });
  it("Friday does not count", () => {
    // Wed 10-07 given → Thu 1, Fri skip, Sat 2, Sun 3, Mon recall
    expect(businessDaysSince("2026-10-07", "2026-10-10")).toBe(2);
    expect(neglectStage("2026-10-07", "2026-10-11")).toEqual({ kind: "notice", day: 3 });
    expect(neglectStage("2026-10-07", "2026-10-12")).toEqual({ kind: "recall" });
  });
});
