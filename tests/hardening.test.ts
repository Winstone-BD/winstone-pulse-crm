import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { contactCloseReasonLabel, isContactCloseReason } from "@/lib/contact-close-reasons";
import { buildLeadTimeline, lead360Csv } from "@/lib/lead360";
import { MANUAL_SECTIONS, MANUAL_VERSION } from "@/lib/system-manual";

describe("contact-close reasons", () => {
  it("accepts only canonical codes", () => {
    expect(isContactCloseReason("not_interested")).toBe(true);
    expect(isContactCloseReason("not_connected")).toBe(true);
    expect(isContactCloseReason("already_bought")).toBe(false);
    expect(isContactCloseReason("")).toBe(false);
  });
  it("shows legacy free text unchanged", () => {
    expect(contactCloseReasonLabel("কিনে ফেলেছেন")).toBe("কিনে ফেলেছেন");
    expect(contactCloseReasonLabel("other", "loan")).toBe("Other — loan");
  });
});

describe("Lead 360 full history", () => {
  const calls = Array.from({ length: 2500 }, (_, i) => ({
    id: `c${i}`, at: new Date(Date.UTC(2025, 0, 1) + i * 60_000).toISOString(), agentId: "a", connected: i % 2 === 0,
    durationSeconds: 60, category: null, customerResponse: null, nextAction: null, summary: null, requirement: null,
  }));
  const t = buildLeadTimeline({
    lead: { id: "l", createdAt: "2024-12-31T00:00:00Z", source: "x", assignedTo: "a" },
    calls: [...calls, calls[0]!], // a retried duplicate
    followUps: [], changes: [], events: [],
    stateChanges: [{ id: "s1", field: "assigned_to", oldValue: null, newValue: "a", changedBy: null, source: "leadhub", at: "2025-01-01T00:00:00Z" }],
    agentName: (id) => (id ? "Agent" : "—"),
  });
  it("keeps every event beyond 1000 rows and never renders duplicates", () => {
    expect(t).toHaveLength(2500 + 1 + 1);
    expect(new Set(t.map((i) => i.id)).size).toBe(t.length);
  });
  it("exports every event with generated-at and neutralized formulas", () => {
    const csv = lead360Csv({ lead: "=cmd", phone: "8801", generatedAt: new Date() }, t);
    expect(csv).toContain(`Total events: ${t.length}`);
    expect(csv).toContain(`"'=cmd"`);
  });
});

describe("append-only history (schema)", () => {
  const sql = readFileSync("drizzle/migrations/0061_append_only_lead_history.sql", "utf8");
  it("blocks update/delete on lead history tables", () => {
    expect(sql).toMatch(/lead_events_immutable BEFORE UPDATE OR DELETE/);
    expect(sql).toMatch(/lead_state_changes_immutable BEFORE UPDATE OR DELETE/);
  });
});

describe("system manual", () => {
  it("has one canonical source surfaced in HQ and IT", () => {
    expect(MANUAL_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
    expect(MANUAL_SECTIONS.length).toBeGreaterThanOrEqual(18);
    for (const f of ["src/routes/hq.tsx", "src/routes/system.tsx"]) {
      expect(readFileSync(f, "utf8")).toContain("<SystemManualCard />");
    }
  });
});

describe("server-side gates", () => {
  const fns = readFileSync("src/lib/call-reports.functions.ts", "utf8");
  it("briefing gate guards both call start and report submission", () => {
    expect(fns.match(/requireAgentBriefing\(me\.id\)/g)?.length).toBeGreaterThanOrEqual(2);
  });
  it("agent snapshot is filtered by the agent's own id", () => {
    const crm = readFileSync("src/lib/crm.functions.ts", "utf8");
    expect(crm).toMatch(/caller\.scope === "agent"/);
    expect(crm).toMatch(/assigned_to: null/);
  });
});
