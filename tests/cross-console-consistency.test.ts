import { describe, expect, it } from "vitest";

import {
  canonicalCallsOf,
  reportConnected,
  talkTimeOf,
  type CallReportRow,
} from "@/lib/call-evidence";
import { buildAgentStats, buildBillingSummary } from "@/lib/crm-data";
import { dhakaDateKey } from "@/lib/daily-performance";
import type { Lead, Profile, WhatsappMessage } from "@/lib/crm-data";

const agent = {
  id: "a1",
  name: "Test Agent",
  employee_id: "WIN2601",
  role: "agent",
  presence: "idle",
  is_active: true,
  approval_status: "approved",
  last_active_at: new Date().toISOString(),
} as unknown as Profile;

const lead = (id: string, extra: Partial<Lead> = {}): Lead =>
  ({
    id,
    name: `Lead ${id}`,
    assigned_to: "a1",
    assigned_agent_id: "a1",
    status: "pending",
    work_state: "pending",
    temperature: null,
    outcome_category: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }) as unknown as Lead;

const report = (over: Partial<CallReportRow> & { id: string }): CallReportRow => ({
  agent_id: "a1",
  lead_id: "l1",
  connected: true,
  connection_verified: null,
  duration_seconds: null,
  recording_id: null,
  call_started_at: null,
  call_ended_at: null,
  submitted_at: new Date().toISOString(),
  created_at: new Date().toISOString(),
  ...over,
});

describe("canonical call layer — one truth for every console", () => {
  it("counts a measured 2m30s call as one connected call with 150s talk time", () => {
    const calls = canonicalCallsOf([report({ id: "r1", duration_seconds: 150 })]);
    expect(calls).toHaveLength(1);
    expect(calls[0]!.verifiedConnected).toBe(true);
    expect(talkTimeOf(calls.map((c) => ({ connected: c.verifiedConnected, verifiedSeconds: c.verifiedSeconds }))))
      .toEqual({ seconds: 150, measuredCalls: 1, unmeasuredCalls: 0 });
  });

  it("a no-answer report is an attempt but never a connected call", () => {
    const rows = [report({ id: "r1", connected: false, duration_seconds: 0 })];
    const calls = canonicalCallsOf(rows);
    expect(calls).toHaveLength(1);
    expect(calls[0]!.verifiedConnected).toBe(false);
    expect(reportConnected(rows[0]!)).toBe(false);
  });

  it("a report with no phone evidence at all does not become a connected call", () => {
    expect(reportConnected(report({ id: "r1", duration_seconds: 0 }))).toBe(false);
  });

  it("collapses a retried upload of the same call session into one call", () => {
    const calls = canonicalCallsOf([
      report({ id: "r1", recording_id: "rec1", duration_seconds: 60 }),
      report({ id: "r2", recording_id: "rec1", duration_seconds: 60 }),
    ]);
    expect(calls).toHaveLength(1);
  });

  it("keeps separate attempts on the same lead separate but the lead contacted once", () => {
    const calls = canonicalCallsOf([
      report({ id: "r1", lead_id: "l1", duration_seconds: 30 }),
      report({ id: "r2", lead_id: "l1", duration_seconds: 45 }),
    ]);
    expect(calls).toHaveLength(2);
    const contacted = new Set(calls.filter((c) => c.verifiedConnected).map((c) => c.leadId));
    expect(contacted.size).toBe(1);
  });

  it("agent stats and the billing rollup read the same canonical calls", () => {
    const calls = canonicalCallsOf([
      report({ id: "r1", lead_id: "l1", duration_seconds: 120 }),
      report({ id: "r2", lead_id: "l2", connected: false, duration_seconds: 0 }),
    ]);
    const stats = buildAgentStats([agent], [lead("l1"), lead("l2")], calls, [] as WhatsappMessage[])[0]!;
    expect(stats.dials).toBe(2);
    expect(stats.connected).toBe(1);
    expect(stats.contactedLeads).toBe(1);
    expect(stats.talkSeconds).toBe(120);
    expect(stats.talkTimeAvailable).toBe(true);

    const billing = buildBillingSummary(calls, [lead("l1")]);
    expect(billing.dials).toBe(stats.dials);
    expect(billing.connected).toBe(stats.connected);
    expect(billing.billableMinutes).toBe(2);
  });

  it("never invents minutes when the phone measured nothing", () => {
    const calls = canonicalCallsOf([report({ id: "r1", recording_id: "rec9" })]);
    const stats = buildAgentStats([agent], [lead("l1")], calls, [] as WhatsappMessage[])[0]!;
    expect(stats.connected).toBe(1);
    expect(stats.talkSeconds).toBe(0);
    expect(stats.talkTimeAvailable).toBe(false);
    expect(stats.unmeasuredCalls).toBe(1);
  });

  it("buckets a call just after Dhaka midnight into the new Dhaka day", () => {
    // 2026-09-20 18:10 UTC = 2026-09-21 00:10 Dhaka
    const calls = canonicalCallsOf([
      report({ id: "r1", duration_seconds: 60, call_ended_at: "2026-09-20T18:10:00.000Z" }),
      report({ id: "r2", duration_seconds: 60, call_ended_at: "2026-09-20T17:50:00.000Z" }),
    ]);
    expect(dhakaDateKey(new Date(calls[0]!.at))).toBe("2026-09-21");
    expect(dhakaDateKey(new Date(calls[1]!.at))).toBe("2026-09-20");
  });

  it("today's stats follow the Dhaka day, not the browser clock", () => {
    const todayKey = dhakaDateKey();
    const calls = canonicalCallsOf([
      report({ id: "r1", duration_seconds: 90, call_ended_at: new Date().toISOString() }),
      report({ id: "r2", duration_seconds: 90, call_ended_at: "2020-01-01T00:00:00.000Z" }),
    ]);
    const stats = buildAgentStats([agent], [lead("l1")], calls, [] as WhatsappMessage[], true)[0]!;
    expect(dhakaDateKey(new Date(calls[0]!.at))).toBe(todayKey);
    expect(stats.dials).toBe(1);
    expect(stats.connected).toBe(1);
  });
});
