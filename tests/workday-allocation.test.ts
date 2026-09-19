import { describe, expect, it } from "vitest";

import {
  allocationState,
  isSpecialWorkday,
  planAllocation,
  type AgentLoad,
} from "@/lib/workday-allocation";

const QUOTA = 30;
const agent = (id: string, pending: number, movableExcess?: number): AgentLoad => ({
  id,
  quota: QUOTA,
  pending,
  movableExcess: movableExcess ?? Math.max(0, pending - QUOTA),
});

describe("দৈনিক বণ্টনের হিসাব", () => {
  it("কোনো পেন্ডিং না থাকলে পূর্ণ ৩০টি লিড দেয়", () => {
    const plan = planAllocation([agent("a", 0)], 500);
    expect(plan.topUp["a"]).toBe(30);
    expect(plan.shortage).toBe(0);
  });

  it("১–২৯ পেন্ডিং থাকলে ঠিক ঘাটতিটুকুই দেয়", () => {
    const plan = planAllocation([agent("a", 12), agent("b", 29)], 500);
    expect(plan.topUp["a"]).toBe(18);
    expect(plan.topUp["b"]).toBe(1);
  });

  it("ঠিক ৩০ পেন্ডিং থাকলে নতুন লিড দেয় না", () => {
    const plan = planAllocation([agent("a", 30)], 500);
    expect(plan.topUp["a"] ?? 0).toBe(0);
    expect(plan.transfers).toHaveLength(0);
  });

  it("৩০-এর বেশি পেন্ডিং থাকলে অতিরিক্ত অংশ কম চাপের ডেস্কে যায়, কেউ ৩০ ছাড়ায় না", () => {
    const plan = planAllocation([agent("donor", 40), agent("receiver", 25)], 0);
    expect(plan.transfers).toEqual([{ from: "donor", to: "receiver", count: 5 }]);
    expect(plan.unresolvedExcess["donor"]).toBe(5);
  });

  it("সবাই ৩০-এর উপরে হলে কোথাও সরে না, অতিরিক্ত মীমাংসাধীন দেখায়", () => {
    const plan = planAllocation([agent("a", 35), agent("b", 33)], 200);
    expect(plan.transfers).toHaveLength(0);
    expect(plan.unresolvedExcess).toEqual({ a: 5, b: 3 });
  });

  it("ডেটাবেজে লিড কম থাকলে সত্যি ঘাটতি দেখায়, বানানো সংখ্যা নয়", () => {
    const plan = planAllocation([agent("a", 0), agent("b", 0)], 10);
    expect((plan.topUp["a"] ?? 0) + (plan.topUp["b"] ?? 0)).toBe(10);
    expect(plan.shortage).toBe(50);
  });

  it("কাজ শুরু হওয়া বা সুরক্ষিত লিড সরানো যায় না — movable ০ হলে কিছুই যায় না", () => {
    const plan = planAllocation([agent("donor", 45, 0), agent("receiver", 10)], 0);
    expect(plan.transfers).toHaveLength(0);
    expect(plan.unresolvedExcess["donor"]).toBe(15);
  });

  it("বার বার চালালেও (রিফ্রেশ/ক্রন রিরান/ওয়েব+অ্যাপ একসাথে) ডুপ্লিকেট হয় না", () => {
    const loads = [agent("a", 0), agent("donor", 40), agent("b", 28)];
    const first = planAllocation(loads, 500);
    const settled: AgentLoad[] = [
      agent("a", 0 + (first.topUp["a"] ?? 0)),
      agent("donor", 40 - 12, 0),
      agent("b", 28 + (first.topUp["b"] ?? 0) + 12 > 30 ? 30 : 30),
    ];
    const again = planAllocation(settled, 500);
    expect(again.transfers).toHaveLength(0);
    expect(Object.values(again.topUp).reduce((s, n) => s + n, 0)).toBe(0);
  });

  it("অবস্থা সঠিকভাবে বলে", () => {
    const base = {
      agentId: "a",
      name: "A",
      employeeId: null,
      quota: 30,
      carriedOver: 0,
      carriedFrom: null,
      newFromDatabase: 0,
      receivedFromOthers: 0,
      movedToOthers: 0,
      completed: 0,
    };
    expect(allocationState({ ...base, pending: 30, excess: 0, gap: 0 })).toBe("on_target");
    expect(allocationState({ ...base, pending: 20, excess: 0, gap: 10 })).toBe("short");
    expect(allocationState({ ...base, pending: 41, excess: 11, gap: 0 })).toBe("excess");
  });

  it("বিশদ ক্যারি-ওভার নিয়ম শুধু ২০ সেপ্টেম্বর ২০২৬-র জন্য", () => {
    expect(isSpecialWorkday("2026-09-20")).toBe(true);
    expect(isSpecialWorkday("2026-09-21")).toBe(false);
  });
});
