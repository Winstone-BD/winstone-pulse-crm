import { describe, expect, it } from "vitest";
import { computeAccountability, isLocked, nextDate } from "@/lib/accountability";

const leads = (done: number, total: number) =>
  Array.from({ length: total }, (_, i) => ({ id: String(i), completed: i < done }));

describe("daily accountability", () => {
  it("<=10% pending is not flagged", () => {
    expect(computeAccountability({ leads: leads(45, 50), dueFollowUps: [], missedReports: 0 }).flagged).toBe(false);
  });
  it(">10% pending is flagged with real numbers", () => {
    const m = computeAccountability({ leads: leads(44, 50), dueFollowUps: [], missedReports: 1 });
    expect(m).toMatchObject({ flagged: true, pending: 6, pendingPercent: 12 });
    expect(m.reason).not.toMatch(/fraud|crime/i);
  });
  it("overdue follow-ups count as pending work", () => {
    const m = computeAccountability({
      leads: leads(50, 50),
      dueFollowUps: Array.from({ length: 10 }, (_, i) => ({ id: `f${i}`, handled: i < 3 })),
      missedReports: 0,
    });
    expect(m).toMatchObject({ eligible: 60, pending: 7, overdueFollowUps: 7, flagged: true });
  });
  it("no workload is never flagged", () => {
    expect(computeAccountability({ leads: [], dueFollowUps: [], missedReports: 0 }).flagged).toBe(false);
  });
  it("approval unlocks; review/hold keeps locked", () => {
    expect(isLocked([{ status: "approved", unlock_for_date: "2026-09-28" }], "2026-09-28")).toBe(false);
    expect(isLocked([{ status: "review_required", unlock_for_date: "2026-09-28" }], "2026-09-28")).toBe(true);
    expect(isLocked([{ status: "hold", unlock_for_date: "2026-09-27" }], "2026-09-28")).toBe(true);
    expect(isLocked([{ status: "review_required", unlock_for_date: "2026-09-29" }], "2026-09-28")).toBe(false);
  });
  it("next business date rolls month", () => {
    expect(nextDate("2026-09-30")).toBe("2026-10-01");
  });
});
