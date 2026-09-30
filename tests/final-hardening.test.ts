import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const read = (p: string) => readFileSync(p, "utf8");

describe("final hardening", () => {
  it("dashboard snapshot has no latest-N caps on calls/messages/events", () => {
    const s = read("src/lib/crm.functions.ts");
    expect(s).not.toMatch(/call_recordings"\)\s*\.select\("\*"\)\s*\.order\("created_at", \{ ascending: false \}\)\s*\.limit/);
    expect(s).not.toMatch(/\.limit\(500\)/);
    expect((s.match(/pageAll\(/g) ?? []).length).toBeGreaterThanOrEqual(6);
  });
  it("migration logs report/call events with correlation ids", () => {
    const m = read("drizzle/migrations/0064_history_correlation_and_report_events.sql");
    expect(m).toContain("correlation_id");
    expect(m).toContain("call_reports_log_change");
    expect(m).toContain("call_recordings_log_created");
  });
  it("Lead 360 labels the new history kinds", () => {
    const s = read("src/lib/lead360.ts");
    for (const k of ["report_status", "report_correction", "call_logged"]) expect(s).toContain(k);
  });
});

import { leadNotAssignedTo } from "@/lib/lead-access.server";
describe("call start ownership", () => {
  it("refuses unassigned and other-agent leads, allows own", () => {
    expect(leadNotAssignedTo({ assigned_to: null, assigned_agent_id: null }, "me")).toBe(true);
    expect(leadNotAssignedTo({ assigned_to: "x" }, "me")).toBe(true);
    expect(leadNotAssignedTo({ assigned_agent_id: "me" }, "me")).toBe(false);
  });
});

import { existsSync } from "node:fs";
describe("handover documents", () => {
  it("canonical PDFs exist in the project", () => {
    for (const f of ["public/winstone-system-manual.pdf", "public/winstone-client-handover.pdf", "public/winstone-audit-report.pdf"]) expect(existsSync(f)).toBe(true);
  });
});
