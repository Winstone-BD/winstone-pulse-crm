import { describe, expect, it } from "vitest";
import { dhakaDate, handoverDue } from "@/lib/handover-due";

const now = new Date("2026-10-15T05:00:00Z"); // 11:00 Dhaka, 15 Oct

describe("handover due rules", () => {
  it("documents due 7 Dhaka days after first completed visit", () => {
    const d = handoverDue({ visits: [{ status: "completed", outcome: "interested", outcome_at: "2026-10-10T19:30:00Z", visit_at: "2026-10-10T10:00:00Z" }], booking: null }, now);
    // 19:30 UTC on 10 Oct = 01:30 Dhaka on 11 Oct → due 18 Oct
    expect(d).toEqual([{ kind: "documents", dueDate: "2026-10-18", daysLeft: 3, state: "upcoming" }]);
  });
  it("no documents item before any completed visit", () => {
    expect(handoverDue({ visits: [{ status: "scheduled", outcome: null, outcome_at: null, visit_at: "2026-10-01T04:00:00Z" }], booking: null }, now)).toEqual([]);
  });
  it("overdue documents", () => {
    const d = handoverDue({ visits: [{ status: "completed", outcome: null, outcome_at: null, visit_at: "2026-10-01T04:00:00Z" }], booking: null }, now);
    expect(d[0]).toMatchObject({ dueDate: "2026-10-08", state: "overdue", daysLeft: -7 });
  });
  it("payment due on booking day until HQ approves; documents satisfied by booking", () => {
    const b = { booked_at: "2026-10-15T02:00:00Z", approval_status: "pending" };
    const v = [{ status: "completed", outcome: null, outcome_at: null, visit_at: "2026-10-01T04:00:00Z" }];
    expect(handoverDue({ visits: v, booking: b }, now)).toEqual([{ kind: "payment", dueDate: "2026-10-15", daysLeft: 0, state: "today" }]);
    expect(handoverDue({ visits: v, booking: { ...b, approval_status: "approved" } }, now)).toEqual([]);
  });
  it("dhakaDate crosses midnight correctly", () => {
    expect(dhakaDate("2026-10-14T18:00:00Z")).toBe("2026-10-15");
    expect(dhakaDate("2026-10-14T17:59:00Z")).toBe("2026-10-14");
  });
});
