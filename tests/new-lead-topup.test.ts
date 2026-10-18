import { describe, expect, it } from "vitest";
import { newLeadNeeds, samePlan } from "@/lib/new-lead-topup";

describe("new-lead top-up to 50", () => {
  const agents = [{ id: "a", name: "A" }, { id: "b", name: "B" }, { id: "c", name: "C" }];
  it("gives each agent exactly the gap to 50", () => {
    const r = newLeadNeeds(agents, new Map([["a", 40], ["b", 17]]));
    expect(r.map((x) => x.need)).toEqual([10, 33, 50]);
  });
  it("never gives leads to an agent already at or over 50", () => {
    const r = newLeadNeeds(agents, new Map([["a", 50], ["b", 65], ["c", 49]]));
    expect(r.map((x) => x.need)).toEqual([0, 0, 1]);
  });
  it("refuses a confirm when the plan changed after preview", () => {
    expect(samePlan({ a: 10, b: 33 }, { a: 10, b: 33 })).toBe(true);
    expect(samePlan({ a: 10, b: 33 }, { a: 9, b: 33 })).toBe(false);
    expect(samePlan({ a: 10 }, { a: 10, b: 1 })).toBe(false);
  });
});
