import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  AUTO_REFILL_BATCH,
  AUTO_REFILL_DAILY_CAP,
  decideAutoRefill,
} from "../src/lib/lead-refill.rules";

const read = (p: string) => readFileSync(resolve(__dirname, "..", p), "utf8");

describe("decideAutoRefill — the empty-desk rules", () => {
  const base = { activeLeads: 0, assignedToday: 50, reportsToday: 12, refillsToday: 0 };

  it("gives a small fixed batch when the queue is empty and today's work is logged", () => {
    expect(decideAutoRefill(base)).toEqual({ give: true, quantity: AUTO_REFILL_BATCH });
  });

  it("never refills while any lead is still open on the desk", () => {
    expect(decideAutoRefill({ ...base, activeLeads: 1 })).toEqual({
      give: false,
      reason: "has_leads",
    });
  });

  it("holds the batch when today's leads were never logged (no skipping work)", () => {
    expect(decideAutoRefill({ ...base, reportsToday: 0 })).toEqual({
      give: false,
      reason: "work_not_logged",
    });
  });

  it("lets a desk that was never given leads today get a batch without a report", () => {
    expect(decideAutoRefill({ ...base, assignedToday: 0, reportsToday: 0 })).toEqual({
      give: true,
      quantity: AUTO_REFILL_BATCH,
    });
  });

  it("stops at the daily cap", () => {
    expect(decideAutoRefill({ ...base, refillsToday: AUTO_REFILL_DAILY_CAP })).toEqual({
      give: false,
      reason: "daily_cap",
    });
  });

  it("uses a small fixed batch and a cap of two", () => {
    expect(AUTO_REFILL_BATCH).toBe(10);
    expect(AUTO_REFILL_DAILY_CAP).toBe(2);
  });
});

describe("auto-refill wiring (source checks)", () => {
  const pool = read("src/lib/lead-pool.server.ts");
  const fns = read("src/lib/lead-pool.functions.ts");
  const desk = read("src/routes/desk.tsx");

  it("server refill is gated: distribution day, briefing ack, guarded grant path", () => {
    expect(pool).toContain("autoRefillLeadsForAgent");
    expect(pool).toContain("assertDistributionDay");
    expect(pool).toContain("requireAgentBriefing");
    expect(pool).toContain("decideAutoRefill");
    expect(pool).toContain('source: "auto_refill"');
    // It reuses the one guarded grant path — no second write path.
    expect(pool).toContain("grantExtraLeads({");
  });

  it("the agent-facing function requires a signed-in, approved, non-readonly agent", () => {
    expect(fns).toContain("autoRefillMyLeads");
    expect(fns).toContain("resolveCaller");
    expect(fns).toContain('caller.scope !== "agent"');
    expect(fns).toContain('caller.approval !== "approved"');
    expect(fns).toContain("caller.readOnly");
  });

  it("the desk asks only while the queue is empty and refreshes on arrival", () => {
    expect(desk).toContain("AutoLeadRefill");
    expect(desk).toContain("autoRefillMyLeads");
    expect(desk).toContain("leads.length > 0");
    expect(desk).toContain('queryKey: ["crm-snapshot"]');
  });
});
