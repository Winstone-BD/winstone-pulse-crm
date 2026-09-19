import { describe, expect, it } from "vitest";

import {
  isRetryDue,
  MAX_UNANSWERED_ATTEMPTS,
  needsSupervisorDecision,
  nextRetryAt,
  reportTrust,
  retryDelayMinutes,
} from "@/lib/call-retry";
import { dailyPerformanceOf, type CallReportEvent } from "@/lib/daily-performance";

const NOW = new Date("2026-09-20T05:00:00Z");

function report(over: Partial<CallReportEvent>): CallReportEvent {
  return {
    id: "r1",
    leadId: "l1",
    agentId: "a1",
    status: "submitted",
    connected: true,
    durationSeconds: 120,
    category: "interested",
    at: "2026-09-20T05:00:00Z",
    classified: true,
    ...over,
  };
}

describe("unanswered calls come back", () => {
  it("waits longer after every failed try", () => {
    expect(retryDelayMinutes(1)).toBe(90);
    expect(retryDelayMinutes(2)).toBe(240);
    expect(retryDelayMinutes(3)).toBe(1440);
    expect(retryDelayMinutes(9)).toBe(2880);
  });

  it("schedules the next try ahead of now", () => {
    const at = nextRetryAt(1, NOW);
    expect(new Date(at).getTime()).toBe(NOW.getTime() + 90 * 60_000);
    expect(isRetryDue(at, NOW)).toBe(false);
    expect(isRetryDue(at, new Date(NOW.getTime() + 91 * 60_000))).toBe(true);
    expect(isRetryDue(null, NOW)).toBe(true);
  });

  it("asks for a coordinator after too many silent tries", () => {
    expect(needsSupervisorDecision(MAX_UNANSWERED_ATTEMPTS - 1)).toBe(false);
    expect(needsSupervisorDecision(MAX_UNANSWERED_ATTEMPTS)).toBe(true);
  });
});

describe("report honesty", () => {
  it("flags a talked-to call the phone has no trace of", () => {
    const trust = reportTrust({
      claimedConnected: true,
      measuredSeconds: 0,
      declaredSeconds: 180,
      hasRecording: false,
      callStartedAt: null,
    });
    expect(trust.suspicious).toBe(true);
    expect(trust.warning).toContain("সতর্কতা");
    expect(trust.reasons.length).toBeGreaterThan(1);
  });

  it("flags a call too short for a conversation", () => {
    expect(
      reportTrust({
        claimedConnected: true,
        measuredSeconds: 3,
        declaredSeconds: 3,
        hasRecording: true,
        callStartedAt: "2026-09-20T05:00:00Z",
      }).suspicious,
    ).toBe(true);
  });

  it("accepts a real call the phone could not measure", () => {
    const trust = reportTrust({
      claimedConnected: true,
      measuredSeconds: 0,
      declaredSeconds: 40,
      hasRecording: false,
      callStartedAt: "2026-09-20T05:00:00Z",
    });
    expect(trust.suspicious).toBe(false);
    expect(trust.warning).toBeNull();
  });

  it("never flags an honest unanswered report", () => {
    expect(
      reportTrust({
        claimedConnected: false,
        measuredSeconds: 0,
        declaredSeconds: 0,
        hasRecording: false,
        callStartedAt: null,
      }).suspicious,
    ).toBe(false);
  });
});

describe("performance counts connected, classified work", () => {
  const workload = {
    leadsAssigned: 10,
    carriedOverPending: 0,
    newFromDatabase: 10,
    reassignedIn: 0,
    reassignedOut: 0,
    excessPending: 0,
    target: 10,
  };

  it("does not count an unanswered call as a finished task", () => {
    const day = dailyPerformanceOf({
      agentId: "a1",
      dateKey: "2026-09-20",
      reports: [
        report({ id: "r1", leadId: "l1" }),
        report({ id: "r2", leadId: "l2", connected: false, classified: false, durationSeconds: 0 }),
      ],
      followUps: [],
      workload,
    });
    expect(day.callsAttempted).toBe(2);
    expect(day.connectedCalls).toBe(1);
    expect(day.completedTasks).toBe(1);
    expect(day.unansweredCalls).toBe(1);
    expect(day.performancePercent).toBe(10);
    expect(day.talkMinutes).toBe(2);
  });

  it("counts a lead once however many calls it took", () => {
    const day = dailyPerformanceOf({
      agentId: "a1",
      dateKey: "2026-09-20",
      reports: [report({ id: "r1" }), report({ id: "r2" })],
      followUps: [],
      workload,
    });
    expect(day.completedTasks).toBe(1);
    expect(day.talkMinutes).toBe(4);
  });

  it("ignores a connected call that was never classified", () => {
    const day = dailyPerformanceOf({
      agentId: "a1",
      dateKey: "2026-09-20",
      reports: [report({ classified: false })],
      followUps: [],
      workload,
    });
    expect(day.connectedCalls).toBe(1);
    expect(day.completedTasks).toBe(0);
  });
});
