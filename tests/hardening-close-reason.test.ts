import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { validateReport } from "@/lib/call-reports.server";
import { contactCloseReasonLabel, CONTACT_CLOSE_REASONS } from "@/lib/contact-close-reasons";
import { briefingRequiredAt } from "@/lib/agent-briefing.server";

const base = {
  category: "not_interested", summary: "কথা হয়েছে", note: "নোট", reason: "দাম বেশি", direction: "outgoing",
  callStatus: "connected", durationSeconds: 40, connected: true, followUpAt: null, followUpNeeded: false,
} as never;

describe("contact-close reason contract", () => {
  it("rejects closing contact without a structured reason", () => {
    const r = validateReport({ ...(base as object), noFollowUpReason: null, followUpNote: "কিছু" } as never);
    expect(r).not.toBeNull();
  });
  it("rejects 'other' without a note, accepts with a note", () => {
    expect(validateReport({ ...(base as object), noFollowUpReason: "other", followUpNote: "" } as never)).not.toBeNull();
    expect(validateReport({ ...(base as object), noFollowUpReason: "other", followUpNote: "দেশের বাইরে" } as never)?.field).not.toBe("followUpAt");
  });
  it("rejects unknown codes", () => {
    expect(validateReport({ ...(base as object), noFollowUpReason: "whatever" } as never)?.field).toBe("noFollowUpReason");
  });
  it("shows the Other note in labels", () => {
    expect(contactCloseReasonLabel("other", "বিদেশে")).toBe("Other — বিদেশে");
  });
  it("Android picker mirrors the canonical list", () => {
    const kt = readFileSync("android/app/src/main/java/com/winstone/connect/ui/ContactCloseReasons.kt", "utf8");
    for (const r of CONTACT_CLOSE_REASONS) expect(kt).toContain(`"${r.code}" to "${r.label}"`);
  });
});

describe("append-only history (migration)", () => {
  const sql = readFileSync("drizzle/migrations/0063_canonical_close_reason_history.sql", "utf8");
  it("writes contact_closed into immutable lead_events and enforces the reason in the DB", () => {
    expect(sql).toMatch(/'contact_closed'/);
    expect(sql).toMatch(/contact close reason required/);
  });
  it("logs cancellations with old/new values and blocks follow-up deletes", () => {
    expect(sql).toMatch(/'cancelled'/);
    expect(sql).toMatch(/old_reason_code/);
    expect(sql).toMatch(/BEFORE DELETE ON public\.follow_up_events/);
  });
});

describe("LeadHub-only assignment", () => {
  it("self-claim is retired", async () => {
    const mod = await import("@/lib/agent-desk.functions");
    expect(mod.SELF_CLAIM_RETIRED).toBe(true);
  });
});

describe("9:05 gate", () => {
  it("is required from 09:05 Dhaka only", () => {
    expect(briefingRequiredAt(new Date("2026-09-30T03:04:00Z"))).toBe(false);
    expect(briefingRequiredAt(new Date("2026-09-30T03:05:00Z"))).toBe(true);
  });
  it("is enforced on server actions, not only call start", () => {
    const desk = readFileSync("src/lib/agent-desk.functions.ts", "utf8");
    const calls = readFileSync("src/lib/call-reports.functions.ts", "utf8");
    const api = readFileSync("src/routes/api/public/agent/report.ts", "utf8");
    expect(desk.match(/assertBriefingForCaller/g)?.length).toBeGreaterThanOrEqual(3);
    expect(calls.match(/assertAgentBriefing|assertBriefingForCaller/g)?.length).toBeGreaterThanOrEqual(3);
    expect(api).toContain("requireAgentBriefing");
  });
});

describe("no silent truncation", () => {
  it("agent follow-ups are paged, not limited to 500", () => {
    const calls = readFileSync("src/lib/call-reports.functions.ts", "utf8");
    const i = calls.indexOf("export const myFollowUps");
    expect(calls.slice(i, calls.indexOf("export const completeFollowUp")).includes(".limit(500)")).toBe(false);
  });
});
vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: {} }));
