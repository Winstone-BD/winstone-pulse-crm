import { describe, expect, it } from "vitest";
import { computeCommandCenter, presetRange, type CcLead, type CcReport } from "./command-center";

const L = (id: string, o: Partial<CcLead> = {}): CcLead => ({ id, status: "pending", temperature: null, outcome_category: null, source: "facebook", created_at: "2026-09-29T04:00:00Z", assigned_agent_id: "a1", assigned_to: null, ...o });
const R = (id: string, lead: string, o: Partial<CcReport> = {}): CcReport => ({ id, lead_id: lead, agent_id: "a1", category: null, customer_response: null, next_action: null, requirement: null, submitted_at: "2026-09-30T05:00:00Z", created_at: "2026-09-30T05:00:00Z", ...o });
const now = new Date("2026-09-30T08:00:00Z");
const base = { calls: [], followUps: [], agents: [{ id: "a1", name: "A" }, { id: "a2", name: "B" }], now, dailyLeadQuota: 50 };
const filters = { ...presetRange("7d", now), agentId: null, source: null, project: null };

describe("command center aggregation", () => {
  it("counts funnel only from real rows and computes stage conversion", () => {
    const cc = computeCommandCenter({ ...base, filters,
      leads: [L("1", { status: "contacted", temperature: "hot" }), L("2", { status: "contacted" }), L("3")],
      reports: [R("r1", "1", { customer_response: "site_visit" }), R("r2", "1", { category: "closed_converted" })] });
    expect(cc.funnel.map((s) => s.count)).toEqual([3, 2, 1, 1, 1]);
    expect(cc.funnel[1].fromPrev).toBeCloseTo(66.7);
    expect(cc.kpi.revenue).toBeNull();
  });
  it("agent filter isolates leads and reports", () => {
    const cc = computeCommandCenter({ ...base, filters: { ...filters, agentId: "a2" },
      leads: [L("1"), L("2", { assigned_agent_id: "a2" })], reports: [R("r1", "1", { category: "closed_converted" })] });
    expect(cc.kpi.totalLeads).toBe(1);
    expect(cc.kpi.bookings).toBe(0);
    expect(cc.agentRows.map((a) => a.id)).toEqual(["a2"]);
  });
  it("follow-up health buckets by Dhaka day", () => {
    const cc = computeCommandCenter({ ...base, filters, leads: [L("1")], reports: [],
      followUps: [
        { id: "f1", lead_id: "1", agent_id: "a1", status: "upcoming", scheduled_at: "2026-09-30T10:00:00Z", completed_at: null },
        { id: "f2", lead_id: "1", agent_id: "a1", status: "upcoming", scheduled_at: "2026-09-28T10:00:00Z", completed_at: null },
        { id: "f3", lead_id: "1", agent_id: "a1", status: "done", scheduled_at: null, completed_at: "2026-09-29T10:00:00Z" },
      ] });
    expect([cc.followUpHealth.dueToday.count, cc.followUpHealth.overdue.count, cc.followUpHealth.completed.count]).toEqual([1, 1, 1]);
  });
  it("gives no insights on insufficient data", () => {
    const cc = computeCommandCenter({ ...base, filters, leads: [L("1")], reports: [] });
    expect(cc.insights).toEqual([]);
  });
});
