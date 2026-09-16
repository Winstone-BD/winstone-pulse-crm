import { describe, expect, it } from "vitest";

import { stageFor } from "@/lib/service-billing-alerts.server";
import { dueAtFor, graceUntilFor, nextPeriod } from "@/lib/service-billing.server";
import type { ServiceInvoice } from "@/lib/service-billing.server";

function invoice(period: string, status: ServiceInvoice["status"]): ServiceInvoice {
  return {
    period,
    amountBdt: 4000,
    status,
    dueAt: dueAtFor(period),
    graceUntil: graceUntilFor(period),
    paidAt: null,
    verifiedAt: null,
    verifiedByLabel: null,
    paymentRef: null,
    paymentMethod: null,
    serviceActiveUntil: null,
    systemShareBdt: 3000,
    architectShareBdt: 1000,
    splitAt: null,
    payoutStatus: "pending",
    payoutAt: null,
    payoutRef: null,
    note: null,
  } as ServiceInvoice;
}

describe("service bill reminder stages", () => {
  const october = invoice("2026-10", "due");

  it("stays quiet early in the month", () => {
    expect(stageFor(october, new Date("2026-10-05T06:00:00Z"))).toBeNull();
  });

  it("warns three days before the due date", () => {
    expect(stageFor(october, new Date("2026-10-12T06:00:00Z"))).toBe("due_soon");
  });

  it("reports due on the due date", () => {
    expect(stageFor(october, new Date("2026-10-15T04:00:00Z"))).toBe("due");
  });

  it("reports overdue after the grace window", () => {
    expect(stageFor(october, new Date("2026-10-19T04:00:00Z"))).toBe("overdue");
  });

  it("never reminds about a paid invoice", () => {
    expect(stageFor(invoice("2026-10", "paid"), new Date("2026-10-25T04:00:00Z"))).toBeNull();
  });

  it("covers service through the next period's due date once paid", () => {
    expect(dueAtFor(nextPeriod("2026-09"))).toBe(dueAtFor("2026-10"));
  });
});
