import { describe, expect, it } from "vitest";

import { contactRate, connectRate, winRate, type FloorMetrics } from "../src/lib/crm-metrics";
import {
  dailyPerformanceOf,
  isDoneFollowUp,
  isOpenFollowUp,
} from "../src/lib/daily-performance";

const base: FloorMetrics = {
  dateKey: "2026-09-20",
  timeZone: "Asia/Dhaka",
  generatedAt: "2026-09-20T05:00:00.000Z",
  totalLeads: 1000,
  newLeads: 100,
  contactedLeads: 500,
  pendingLeads: 400,
  qualifiedLeads: 120,
  hotLeads: 40,
  warmLeads: 80,
  coldLeads: 60,
  assignedLeads: 900,
  unassignedLeads: 100,
  closedWon: 50,
  callAttempts: 800,
  connectedCalls: 400,
  attemptsToday: 30,
  connectedToday: 12,
  followUpDue: 7,
  followUpOverdue: 3,
  visitsCompleted: 5,
  recordingSync: 200,
  trend: [],
  agents: [],
};

describe("floor metric rates", () => {
  it("derives rates from the same totals, never from recordings", () => {
    expect(contactRate(base)).toBe(50);
    expect(connectRate(base)).toBe(50);
    expect(winRate(base)).toBe(5);
  });

  it("never divides by zero on an empty database", () => {
    const empty = { ...base, totalLeads: 0, callAttempts: 0 };
    expect(contactRate(empty)).toBe(0);
    expect(connectRate(empty)).toBe(0);
    expect(winRate(empty)).toBe(0);
  });
});

describe("follow-up status spellings", () => {
  it("treats what the app writes as open work", () => {
    expect(isOpenFollowUp("upcoming")).toBe(true);
    expect(isOpenFollowUp("pending")).toBe(true);
    expect(isOpenFollowUp("done")).toBe(false);
  });

  it("treats what the app writes as finished work", () => {
    expect(isDoneFollowUp("done")).toBe(true);
    expect(isDoneFollowUp("completed")).toBe(true);
    expect(isDoneFollowUp("upcoming")).toBe(false);
  });

  it("counts real 'upcoming'/'done' rows in the day's performance", () => {
    const row = dailyPerformanceOf({
      agentId: "a1",
      dateKey: "2026-09-20",
      reports: [],
      followUps: [
        {
          id: "f1",
          agentId: "a1",
          leadId: "l1",
          category: "call",
          status: "upcoming",
          scheduledAt: "2026-09-20T05:00:00.000Z",
          completedAt: null,
          createdAt: "2026-09-19T05:00:00.000Z",
        },
        {
          id: "f2",
          agentId: "a1",
          leadId: "l2",
          category: "site_visit",
          status: "done",
          scheduledAt: "2026-09-20T04:00:00.000Z",
          completedAt: "2026-09-20T06:00:00.000Z",
          createdAt: "2026-09-19T05:00:00.000Z",
        },
      ],
      workload: {
        leadsAssigned: 30,
        carriedOverPending: 0,
        newFromDatabase: 30,
        reassignedIn: 0,
        reassignedOut: 0,
        excessPending: 0,
        target: 30,
      },
    });
    expect(row.followUpsDue).toBe(1);
    expect(row.followUpsCompleted).toBe(1);
    expect(row.siteVisitsCompleted).toBe(1);
  });
});
