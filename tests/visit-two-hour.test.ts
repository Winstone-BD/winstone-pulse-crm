import { describe, it, expect } from "vitest";
import { visitTwoHourReminderAt } from "@/lib/site-visit-rules";

describe("visitTwoHourReminderAt", () => {
  it("is exactly 2h before a booked visit", () => {
    expect(visitTwoHourReminderAt({ status: "confirmed", visit_at: "2026-10-20T10:00:00Z" })!.toISOString()).toBe("2026-10-20T08:00:00.000Z");
  });
  it("is null for cancelled/completed/bad dates", () => {
    for (const status of ["cancelled", "completed", "no_show", "offer_made"]) expect(visitTwoHourReminderAt({ status, visit_at: "2026-10-20T10:00:00Z" })).toBeNull();
    expect(visitTwoHourReminderAt({ status: "scheduled", visit_at: "x" })).toBeNull();
  });
});
