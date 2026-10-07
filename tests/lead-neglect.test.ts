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

describe("sweep simulation with skipped cron days", () => {
  function simulate(assigned: string, runDays: string[]) {
    const sent = new Map<number, string>();
    const log: string[] = [];
    for (const day of runDays) {
      if (neglectStage(assigned, day).kind === "none") { log.push(`${day}:none`); continue; }
      const a = nextNeglectAction(sent, day);
      if (a.kind === "notice") sent.set(a.day, day);
      log.push(`${day}:${a.kind === "notice" ? `notice${a.day}` : a.kind}`);
      if (a.kind === "recall") break;
    }
    return log;
  }
  it("daily runs: notice1, notice2, recall", () => {
    expect(simulate("2026-10-04", ["2026-10-04", "2026-10-05", "2026-10-06", "2026-10-07"]))
      .toEqual(["2026-10-04:none", "2026-10-05:notice1", "2026-10-06:notice2", "2026-10-07:recall"]);
  });
  it("first-ever sweep on a 10-day-old lead still warns twice first", () => {
    expect(simulate("2026-09-20", ["2026-10-04", "2026-10-05", "2026-10-06"]))
      .toEqual(["2026-10-04:notice1", "2026-10-05:notice2", "2026-10-06:recall"]);
  });
  it("cron skips days: warnings are delayed, never skipped", () => {
    expect(simulate("2026-10-04", ["2026-10-07", "2026-10-11", "2026-10-13"]))
      .toEqual(["2026-10-07:notice1", "2026-10-11:notice2", "2026-10-13:recall"]);
  });
  it("same-day rerun does not advance", () => {
    expect(simulate("2026-10-04", ["2026-10-05", "2026-10-05", "2026-10-05"]))
      .toEqual(["2026-10-05:notice1", "2026-10-05:wait", "2026-10-05:wait"]);
  });
});
