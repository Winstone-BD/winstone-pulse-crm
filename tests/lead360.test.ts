import { describe, expect, it } from "vitest";
import { buildLeadTimeline, summarize } from "@/lib/lead360";
import { followUpReasonLabel } from "@/lib/follow-up-reasons";

const call = (id: string, at: string, connected: boolean) => ({
  id, at, agentId: "a1", connected, durationSeconds: connected ? 400 : 0,
  category: null, customerResponse: null, nextAction: null, summary: null, requirement: null,
});
const fu = (id: string, created: string, sched: string, status: string, rc = 0) => ({
  id, agentId: "a1", scheduledAt: sched, status, reasonCode: "payment", note: null,
  createdAt: created, completedAt: status === "done" ? sched : null, rescheduleCount: rc,
});

describe("Lead 360", () => {
  const now = new Date("2026-09-28T00:00:00Z");
  const calls = [call("c1", "2026-09-18T04:00:00Z", true), call("c2", "2026-09-24T05:00:00Z", false)];
  const fus = [fu("f1", "2026-09-18T05:00:00Z", "2026-09-20T04:00:00Z", "done"), fu("f2", "2026-09-26T10:00:00Z", "2026-09-29T04:00:00Z", "upcoming", 1)];

  it("counts KPIs and picks the current follow-up", () => {
    const s = summarize(calls, fus, now);
    expect(s).toMatchObject({ totalCalls: 2, connected: 1, notConnected: 1, totalFollowUps: 2, completed: 1, upcoming: 1, overdue: 0, rescheduled: 1 });
    expect(s.current?.id).toBe("f2");
    expect(s.daysSinceContact).toBe(3);
  });

  it("builds a newest-first timeline with every call and follow-up", () => {
    const t = buildLeadTimeline({
      lead: { id: "l", createdAt: "2026-09-16T04:00:00Z", source: "website", assignedTo: "a1" },
      calls, followUps: fus,
      changes: [{ id: "x", followUpId: "f2", action: "rescheduled", oldScheduledAt: "2026-09-27T04:00:00Z", newScheduledAt: "2026-09-29T04:00:00Z", reasonCode: "payment", note: null, changedBy: "a1", changedAt: "2026-09-26T10:10:00Z" }],
      events: [], agentName: () => "Sabbir",
    });
    expect(t[0]!.kind).toBe("follow_up_rescheduled");
    expect(t.at(-1)!.kind).toBe("lead_created");
    expect(t.filter((i) => i.kind.startsWith("call"))).toHaveLength(2);
    expect(t.some((i) => i.kind === "follow_up_completed")).toBe(true);
  });

  it("labels reasons, falling back to legacy notes", () => {
    expect(followUpReasonLabel("payment")).toContain("Payment");
    expect(followUpReasonLabel(null, "পুরোনো নোট")).toBe("পুরোনো নোট");
    expect(followUpReasonLabel("other", "ব্যাংক লোন")).toContain("ব্যাংক লোন");
  });
  it("does not count cancelled/rescheduled records as open tasks", () => {
    const rows = [fu("a", "2026-09-20T00:00:00Z", "2026-09-21T00:00:00Z", "cancelled"), fu("b", "2026-09-20T00:00:00Z", "2026-09-21T00:00:00Z", "rescheduled")];
    expect(summarize([], rows, now)).toMatchObject({ upcoming: 0, overdue: 0, current: null });
  });
  it("retains completion outcome and distinct cancellation/missed history", () => {
    const history = buildLeadTimeline({ lead: { id: "l", createdAt: "2026-09-20T00:00:00Z", source: null, assignedTo: "a1" }, calls: [], followUps: fus,
      changes: ["completed", "cancelled", "missed"].map(action => ({ id: action, followUpId: "f2", action, oldScheduledAt: null, newScheduledAt: null, reasonCode: "payment", note: "Customer asked to call after salary date", changedBy: "a1", changedAt: "2026-09-28T00:00:00Z" })), events: [], agentName: () => "Agent" });
    for (const action of ["completed", "cancelled", "missed"]) expect(history.find(row => row.id === `chg:${action}`)?.lines.join(" ")).toContain("Customer asked to call after salary date");
  });
});
