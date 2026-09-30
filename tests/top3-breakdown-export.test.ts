import { describe, expect, it } from "vitest";
import { rankPerformers, scoreBreakdown, scoreOf } from "@/lib/top-performer.server";
import { buildLead360Export } from "@/lib/lead360-export";

const line = (o: Record<string, unknown>) => ({ agentId: "a", name: "A", called: 0, connected: 0, reports: 0, followUps: 0, talkMinutes: 0, connectRate: 0, score: 10, quota: 50, targetQuota: 50, assigned: 0, completed: 0, completionPercent: 0, fairScore: 0, ...o }) as never;

describe("Top 3 breakdown and tie-breakers", () => {
  it("breakdown sums to the score formula", () => {
    const l = { connected: 3, reports: 4, followUps: 2, talkMinutes: 11 };
    const total = scoreBreakdown(l).reduce((s, p) => s + p.points, 0);
    expect(total).toBeCloseTo(scoreOf(l), 5);
  });
  it("equal scores break by calls, then reports, then talk minutes, then id", () => {
    const r = rankPerformers([
      line({ agentId: "d", called: 5, reports: 5, talkMinutes: 5 }),
      line({ agentId: "c", called: 5, reports: 5, talkMinutes: 9 }),
      line({ agentId: "b", called: 5, reports: 7, talkMinutes: 1 }),
      line({ agentId: "a", called: 9, reports: 1, talkMinutes: 1 }),
      line({ agentId: "e", called: 5, reports: 5, talkMinutes: 5 }),
    ]);
    expect(r.map((x: { agentId: string }) => x.agentId)).toEqual(["a", "b", "c", "d", "e"]);
  });
});

describe("Lead 360 server export", () => {
  it("includes filters, generated-at and neutralised cells", () => {
    const out = buildLead360Export(
      [{ id: "1", name: "=HYPERLINK()", phone: "017", source: null, referenceBy: null, calls: 1, connected: 1, followUps: 0, nextFollowUpAt: null, fuState: "none" }],
      [{ label: "Source", value: "facebook" }],
      new Date("2026-09-30T13:00:00Z"),
    );
    expect(out.csv).toContain("Source: facebook");
    expect(out.csv).toContain("Generated at");
    expect(out.csv).toContain(`"'=HYPERLINK()"`);
  });
});
