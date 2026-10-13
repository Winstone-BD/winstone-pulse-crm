import { describe, expect, it } from "vitest";
import { billingStates, decide, defaultDueAt, defaultLockAt } from "@/lib/maintenance-rules";

const dhaka = (local: string) => new Date(`${local}+06:00`);
const P = "2026-10";
const base = { lockAt: defaultLockAt(P), dueAt: defaultDueAt(P), paymentStatus: "unpaid" as const, unlockStatus: "none" as const, unlockExpiresAt: null };

describe("Dhaka boundaries", () => {
  it.each([
    ["2026-10-09T00:00:00", "upcoming", false],
    ["2026-10-11T16:59:59", "upcoming", false],
    ["2026-10-11T17:00:00", "soon", false],
    ["2026-10-14T23:59:59", "due_today", false],
    ["2026-10-15T00:00:00", "locked", true],
  ])("%s → %s", (t, stage, locked) => {
    expect(decide({ ...base, now: dhaka(t) })).toEqual({ stage, locked });
  });
});

describe("distinct billing states", () => {
  it("unpaid before due is OPEN/UNPAID/ACTIVE", () => {
    expect(billingStates({ ...base, now: dhaka("2026-10-10T10:00:00") })).toEqual({ invoice: "OPEN", payment: "UNPAID", access: "ACTIVE", recoveryPending: false });
  });
  it("overdue only after the 12th", () => {
    expect(billingStates({ ...base, now: dhaka("2026-10-12T23:59:00") }).invoice).toBe("OPEN");
    expect(billingStates({ ...base, now: dhaka("2026-10-13T00:00:00") }).invoice).toBe("OVERDUE");
  });
  it("pending at lock time is a recovery state, never PAID and never plain UNPAID", () => {
    const s = billingStates({ ...base, paymentStatus: "pending", now: dhaka("2026-10-15T00:00:00") });
    expect(s).toEqual({ invoice: "OVERDUE", payment: "PENDING_VERIFICATION", access: "LOCKED", recoveryPending: true });
  });
  it("verified payment restores access automatically, no unlock needed", () => {
    expect(billingStates({ ...base, paymentStatus: "verified", now: dhaka("2026-10-20T00:00:00") })).toEqual({ invoice: "PAID", payment: "VERIFIED", access: "ACTIVE", recoveryPending: false });
  });
  it("rejected reference is FAILED and stays locked after the deadline", () => {
    const s = billingStates({ ...base, rejectedAt: "2026-10-14T00:00:00Z", now: dhaka("2026-10-16T00:00:00") });
    expect(s.payment).toBe("FAILED");
    expect(s.access).toBe("LOCKED");
  });
});
