import { describe, expect, it } from "vitest";
import { businessDaysSince, neglectStage } from "@/lib/lead-neglect";

describe("lead neglect stages (Friday excluded)", () => {
  it("no notice on assignment day", () => {
    expect(neglectStage("2026-10-04", "2026-10-04")).toEqual({ kind: "none" });
  });
  it("two notices then recall", () => {
    // Sun 10-04 given → Mon 1, Tue 2, Wed recall
    expect(neglectStage("2026-10-04", "2026-10-05")).toEqual({ kind: "notice", day: 1 });
    expect(neglectStage("2026-10-04", "2026-10-06")).toEqual({ kind: "notice", day: 2 });
    expect(neglectStage("2026-10-04", "2026-10-07")).toEqual({ kind: "recall" });
  });
  it("Friday does not count", () => {
    // Wed 10-07 given → Thu 1, Fri skip, Sat 2, Sun recall
    expect(businessDaysSince("2026-10-07", "2026-10-10")).toBe(2);
    expect(neglectStage("2026-10-07", "2026-10-10")).toEqual({ kind: "notice", day: 2 });
    expect(neglectStage("2026-10-07", "2026-10-11")).toEqual({ kind: "recall" });
  });
});

import { nextNeglectAction } from "@/lib/lead-neglect";
describe("neglect never recalls without delivered warnings", () => {
  it("old lead with no notices gets notice 1 first", () => {
    expect(nextNeglectAction(new Map(), "2026-10-07")).toEqual({ kind: "notice", day: 1 });
  });
  it("notice 2 only on a later day than notice 1", () => {
    expect(nextNeglectAction(new Map([[1, "2026-10-07"]]), "2026-10-07")).toEqual({ kind: "wait" });
    expect(nextNeglectAction(new Map([[1, "2026-10-07"]]), "2026-10-08")).toEqual({ kind: "notice", day: 2 });
  });
  it("recall only after both notices, on a later day", () => {
    const both = new Map([[1, "2026-10-05"], [2, "2026-10-06"]]);
    expect(nextNeglectAction(both, "2026-10-06")).toEqual({ kind: "wait" });
    expect(nextNeglectAction(both, "2026-10-07")).toEqual({ kind: "recall" });
  });
});
