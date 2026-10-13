import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { advisory, nextAction, pendingCount, progression, reminderKind, type ApprovalSummary } from "@/lib/billing-advisor";

const base: ApprovalSummary = {
  period: "2026-10", feeUsd: 46.29, dueDate: "2026-10-11T18:00:00Z", lockAt: "2026-10-14T18:00:00Z",
  paymentStatus: "unpaid", paymentRef: null, unlockStatus: "none", unlockExpiresAt: null, locked: false,
  rejectedReason: null, openRequests: [], canApprove: true,
};
const req = { id: "r1", hours: 2, reason: "Paid via bKash", requestedBy: "IT", requestedAt: "2026-10-12T05:00:00Z" };
const outside = new Date("2026-10-03T06:00:00Z");
const inWindow = new Date("2026-10-10T06:00:00Z");

describe("Billing & Approvals hub", () => {
  it("architect sees a pending approval prompt for a real request", () => {
    const s = { ...base, paymentStatus: "pending" as const, paymentRef: "TRX1", openRequests: [req] };
    expect(pendingCount(s)).toBe(2);
    expect(reminderKind(s, outside)).toBe("approval");
  });
  it("Super Admin (canApprove=false) never gets the approval prompt", () => {
    const s = { ...base, canApprove: false, paymentStatus: "pending" as const, paymentRef: "TRX1", openRequests: [req] };
    expect(reminderKind(s, outside)).not.toBe("approval");
    expect(nextAction(s)).toContain("Only the architect");
  });
  it("no request and outside the notice window → no prompt at all", () => {
    expect(pendingCount(base)).toBe(0);
    expect(reminderKind(base, outside)).toBeNull();
  });
  it("countdown reminder is a deadline notice only, never an approval", () => {
    expect(reminderKind(base, inWindow)).toBe("deadline");
    expect(progression(base, inWindow).find((s) => s.key === "decision")?.state).not.toBe("done");
  });
  it("advisory text is grounded and says a reference is not proof", () => {
    const lines = advisory({ ...base, paymentStatus: "pending", paymentRef: "TRX1", openRequests: [req] }, inWindow);
    expect(lines.join(" ")).toContain("TRX1");
    expect(lines.join(" ")).toContain("does not prove payment");
    expect(lines.join(" ")).toContain("relocks automatically");
  });
  it("advisor module has no write calls", () => {
    const src = readFileSync("src/lib/billing-advisor.ts", "utf8");
    expect(src).not.toMatch(/architectDecision|architectPaymentDecision|supabase|fetch\(/);
  });
  it("pending CTA opens the real architect page; decisions stay PIN-session gated", () => {
    const hub = readFileSync("src/components/crm/BillingApprovalsHub.tsx", "utf8");
    expect(hub).toContain('"/tech?review=1"');
    expect(hub).not.toMatch(/architectDecision|architectPaymentDecision/);
    const fns = readFileSync("src/lib/maintenance.functions.ts", "utf8");
    expect(fns).toContain("canApprove: who !== null");
    const decision = fns.slice(fns.indexOf("export const architectDecision"));
    expect(decision).toContain("await architect(data.session)");
    expect(fns).toContain("architectSessionValid(session, who.userId)");
  });
  it("IT Console lists a Billing & Approvals section", () => {
    expect(readFileSync("src/lib/page-sections.ts", "utf8")).toContain('en: "Billing & Approvals"');
    expect(readFileSync("src/routes/system.tsx", "utf8")).toContain('sec === "approvals"');
  });
});
