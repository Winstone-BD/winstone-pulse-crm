import { describe, expect, it } from "vitest";
import { dailyPerformance, kpiCompletion, kpiPhase, rankKpiLines, type KpiLine } from "@/lib/daily-kpi";

const line = (o: Partial<KpiLine>): KpiLine => ({ agentId: "a", performance: 50, completedSiteVisits: 0, hotLeads: 0, bookings: 0, completedCalls: 0, achievedAt: null, ...o });

describe("locked daily KPI", () => {
  it("caps each KPI at 100% and weights 50/50", () => {
    expect(kpiCompletion(80, 25)).toBe(1);
    expect(kpiCompletion(5, 0)).toBe(0);
    expect(dailyPerformance({ calls: 50, callTarget: 25, siteVisits: 0, visitTarget: 3 })).toBe(50);
    expect(dailyPerformance({ calls: 25, callTarget: 25, siteVisits: 3, visitTarget: 3 })).toBe(100);
    expect(dailyPerformance({ calls: 10, callTarget: 25, siteVisits: 1, visitTarget: 3 })).toBe(36.7);
  });
  it("tie-break chain: performance > visits > hot > bookings > calls > earlier > id", () => {
    const r = rankKpiLines([
      line({ agentId: "c", completedCalls: 9 }),
      line({ agentId: "b", bookings: 1 }),
      line({ agentId: "a", hotLeads: 1 }),
      line({ agentId: "v", completedSiteVisits: 1 }),
      line({ agentId: "x", performance: 60 }),
      line({ agentId: "e2", achievedAt: "2026-10-03T10:00:00Z" }),
      line({ agentId: "e1", achievedAt: "2026-10-03T09:00:00Z" }),
    ]);
    expect(r.map((l) => l.agentId)).toEqual(["x", "v", "a", "b", "c", "e1", "e2"]);
  });
  it("17:30 snapshot and 18:00 final phases", () => {
    expect([kpiPhase(17 * 60 + 29), kpiPhase(17 * 60 + 30), kpiPhase(18 * 60)]).toEqual(["live", "snapshot", "final"]);
  });
});
