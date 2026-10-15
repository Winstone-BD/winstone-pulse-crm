import { describe, expect, it } from "vitest";
import { followupsToday, isInactive, overdueByAgent, sheetCsv, stageCounts } from "@/lib/pipeline-intel";

const now = new Date("2026-10-15T06:00:00Z"); // 12:00 Dhaka

describe("pipeline calculations", () => {
  it("counts follow-ups due today vs overdue by Dhaka day", () => {
    const r = followupsToday([
      { agent_id: "a", scheduled_at: "2026-10-15T09:00:00Z", status: "upcoming" },
      { agent_id: "a", scheduled_at: "2026-10-14T18:30:00Z", status: "upcoming" }, // 00:30 Dhaka 15th → today
      { agent_id: "a", scheduled_at: "2026-10-14T10:00:00Z", status: "upcoming" }, // yesterday → overdue
      { agent_id: "a", scheduled_at: "2026-10-15T09:00:00Z", status: "done" },
    ], now);
    expect(r).toEqual({ today: "2026-10-15", dueToday: 2, overdue: 1 });
  });
  it("inactive needs 7 full days without call or update and excludes closed", () => {
    const old = { status: "follow_up", last_call_at: "2026-10-07T00:00:00Z", updated_at: "2026-10-07T00:00:00Z", created_at: "2026-09-01T00:00:00Z" };
    expect(isInactive(old, now)).toBe(true);
    expect(isInactive({ ...old, updated_at: "2026-10-10T00:00:00Z" }, now)).toBe(false);
    expect(isInactive({ ...old, status: "closed" }, now)).toBe(false);
  });
  it("sums booking value in integer cents and reports missing amounts", () => {
    const r = stageCounts([{ status: "pending" }, { status: "pending" }, { status: "closed" }], [
      { approval_status: "pending", amount_usd: 0.1 }, { approval_status: "pending", amount_usd: 0.2 }, { approval_status: "pending", amount_usd: null },
    ]);
    expect(r.stages).toMatchObject({ pending: 2, closed: 1, contacted: 0 });
    expect(r.bookings["pending"]).toEqual({ count: 3, usdCents: 30, missingAmount: 1 });
  });
  it("ranks agents by overdue follow-ups", () => {
    const r = overdueByAgent([
      { agent_id: "a", scheduled_at: "2026-10-14T00:00:00Z", status: "upcoming" },
      { agent_id: "b", scheduled_at: "2026-10-14T00:00:00Z", status: "upcoming" },
      { agent_id: "b", scheduled_at: "2026-10-13T00:00:00Z", status: "upcoming" },
      { agent_id: "a", scheduled_at: "2026-10-16T00:00:00Z", status: "upcoming" },
    ], now);
    expect(r).toEqual([["b", 2], ["a", 1]]);
  });
  it("CSV escapes quotes and blocks formula injection", () => {
    const csv = sheetCsv([{ leadId: "1", lead: '=HYPERLINK("x")', phone: "+8801", agent: null, status: "pending", stage: "proposal", visits: 1, visitsCompleted: 0, bookings: 0, paymentStatus: "—", lastActivity: null }]);
    expect(csv.split("\n")[0]).toBe(`Lead,Phone,Agent,Status,Stage,Visits,Visits completed,Bookings,Payment status,Last activity (Dhaka)`);
    expect(csv.split("\n")[1]).toBe(`"'=HYPERLINK(""x"")",'+8801,,pending,proposal,1,0,0,—,`);
  });
});
