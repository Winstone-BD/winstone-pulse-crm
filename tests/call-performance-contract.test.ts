import { describe, expect, it } from "vitest";

import { callEvidence, callSessionKey, talkTimeOf, taskState } from "@/lib/call-evidence";
import {
  dailyPerformanceOf,
  dhakaDateKey,
  talkTimeAvailable,
  type CallReportEvent,
  type WorkloadFacts,
} from "@/lib/daily-performance";

const AGENT = "agent-1";
const DAY = "2026-09-25";

const workload: WorkloadFacts = {
  target: 30,
  leadsAssigned: 10,
  leadsPending: 5,
  leadsCompleted: 0,
  excessPending: 0,
};

function report(over: Partial<CallReportEvent>): CallReportEvent {
  return {
    id: over.id ?? "r1",
    leadId: over.leadId ?? "lead-1",
    agentId: AGENT,
    recordingId: over.recordingId ?? null,
    status: "submitted",
    connected: over.connected ?? true,
    connectionVerified: over.connectionVerified ?? false,
    verifiedSeconds: over.verifiedSeconds ?? null,
    durationSeconds: over.durationSeconds ?? null,
    category: over.category ?? "interested",
    at: over.at ?? `${DAY}T09:30:00+06:00`,
    classified: over.classified ?? false,
  };
}

function board(reports: CallReportEvent[]) {
  return dailyPerformanceOf({ agentId: AGENT, dateKey: DAY, reports, followUps: [], workload });
}

describe("canonical call performance contract", () => {
  it("a) connected 2m30s counts one connected call, 2.5 minutes and a finished task", () => {
    const evidence = callEvidence({ claimedConnected: true, measuredSeconds: 150 });
    expect(evidence).toEqual({ connected: true, evidence: "measured", verifiedSeconds: 150 });
    expect(taskState({ connected: true, classified: true, evidence: "measured", claimedConnected: true })).toBe(
      "completed",
    );

    const row = board([
      report({ connectionVerified: true, durationSeconds: 150, verifiedSeconds: 150, classified: true }),
    ]);
    expect(row.callsAttempted).toBe(1);
    expect(row.connectedCalls).toBe(1);
    expect(row.talkMinutes).toBe(3); // rounded minutes of 150s
    expect(talkTimeAvailable(row)).toBe(true);
    expect(row.completedTasks).toBe(1);
  });

  it("b) no answer: attempt visible, zero connected, zero talk time, task returns", () => {
    const evidence = callEvidence({ claimedConnected: true, callStatus: "no_answer" });
    expect(evidence.connected).toBe(false);
    expect(taskState({ connected: false, classified: false, evidence: "none", claimedConnected: true })).toBe(
      "manual_note",
    );

    const row = board([report({ connected: false, connectionVerified: false, classified: false })]);
    expect(row.callsAttempted).toBe(1);
    expect(row.connectedCalls).toBe(0);
    expect(row.talkMinutes).toBe(0);
    expect(row.completedTasks).toBe(0);
    expect(row.unansweredCalls).toBe(1);
  });

  it("c) busy, rejected and failed are never connected", () => {
    for (const status of ["busy", "rejected", "failed", "missed", "declined"]) {
      expect(callEvidence({ claimedConnected: true, measuredSeconds: 40, callStatus: status }).connected).toBe(
        false,
      );
    }
  });

  it("d) a report with no call evidence stays a note, never a finished task", () => {
    const evidence = callEvidence({ claimedConnected: true });
    expect(evidence).toEqual({ connected: false, evidence: "none", verifiedSeconds: null });
    expect(taskState({ connected: false, classified: true, evidence: "none", claimedConnected: true })).toBe(
      "manual_note",
    );

    const row = board([report({ connectionVerified: false, classified: true })]);
    expect(row.completedTasks).toBe(0);
    expect(row.unverifiedReports).toBe(1);
  });

  it("e) the same call session arriving twice counts once", () => {
    expect(callSessionKey({ reportId: "r1", recordingId: "rec-9" })).toBe(
      callSessionKey({ reportId: "r2", recordingId: "rec-9" }),
    );
    const row = board([
      report({ id: "r1", recordingId: "rec-9", connectionVerified: true, durationSeconds: 90, verifiedSeconds: 90, classified: true }),
      report({ id: "r2", recordingId: "rec-9", connectionVerified: true, durationSeconds: 90, verifiedSeconds: 90, classified: true }),
    ]);
    expect(row.callsAttempted).toBe(1);
    expect(row.connectedCalls).toBe(1);
  });

  it("f) many attempts on one lead raise attempts but the contacted lead stays distinct", () => {
    const row = board([
      report({ id: "r1", leadId: "lead-7", connected: false }),
      report({ id: "r2", leadId: "lead-7", connectionVerified: true, durationSeconds: 60, verifiedSeconds: 60, classified: true }),
      report({ id: "r3", leadId: "lead-7", connectionVerified: true, durationSeconds: 30, verifiedSeconds: 30, classified: true }),
    ]);
    expect(row.callsAttempted).toBe(3);
    expect(row.connectedCalls).toBe(2);
    expect(row.contactedLeads).toBe(1);
    expect(row.completedTasks).toBe(1);
  });

  it("g) the day boundary follows Asia/Dhaka, not UTC", () => {
    // 2026-09-25 23:30 Dhaka is still 25 Sept, though it is 17:30 UTC.
    expect(dhakaDateKey(new Date("2026-09-25T17:30:00Z"))).toBe("2026-09-25");
    // 00:30 Dhaka on the 26th belongs to the 26th, though UTC still says the 25th.
    expect(dhakaDateKey(new Date("2026-09-25T18:30:00Z"))).toBe("2026-09-26");

    const row = board([
      report({ id: "late", at: "2026-09-25T17:30:00Z", connectionVerified: true, durationSeconds: 60, verifiedSeconds: 60, classified: true }),
      report({ id: "next", at: "2026-09-25T18:30:00Z", connectionVerified: true, durationSeconds: 60, verifiedSeconds: 60, classified: true }),
    ]);
    expect(row.callsAttempted).toBe(1);
  });

  it("h) an unverified call cannot be marked complete to inflate the KPI", () => {
    const row = board([
      report({ id: "fake", connected: true, connectionVerified: false, classified: true, durationSeconds: 0 }),
    ]);
    expect(row.connectedCalls).toBe(0);
    expect(row.completedTasks).toBe(0);
    expect(row.performancePercent).toBe(0);
  });

  it("talk time is unavailable, never zero, when nothing was measured", () => {
    const talk = talkTimeOf([{ verifiedSeconds: null }, { verifiedSeconds: null }]);
    expect(talk).toEqual({ seconds: 0, measuredCalls: 0, unmeasuredCalls: 2 });
    const row = board([
      report({ id: "r1", connectionVerified: true, durationSeconds: 0, verifiedSeconds: null, classified: true }),
    ]);
    expect(talkTimeAvailable(row)).toBe(false);
  });
});
