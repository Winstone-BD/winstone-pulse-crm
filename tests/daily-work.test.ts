import { describe, it, expect } from "vitest";
import { callableLeads, followUpCounts } from "@/lib/daily-work";
import type { Lead } from "@/lib/crm-data";
const now = Date.parse("2026-10-18T14:22:00Z");
const lead = (id: string, patch: Partial<Lead> = {}) =>
  ({
    id,
    status: "pending",
    work_state: "pending",
    temperature: "cold",
    created_at: "2026-10-18T00:00:00Z",
    retry_after: null,
    ...patch,
  }) as Lead;
describe("daily work uses canonical facts", () => {
  it("keeps closed, unresponsive and future snoozed leads out of call queue", () => {
    expect(
      callableLeads(
        [
          lead("a"),
          lead("b", { status: "closed" }),
          lead("c", { work_state: "unresponsive" }),
          lead("d", { work_state: "snoozed", retry_after: "2026-10-19T00:00:00Z" }),
        ],
        now,
      ).map((l) => l.id),
    ).toEqual(["a"]);
  });
  it("prioritizes hot leads without changing records", () => {
    const rows = [lead("a"), lead("b", { temperature: "hot" })];
    expect(callableLeads(rows, now).map((l) => l.id)).toEqual(["b", "a"]);
    expect(rows[0]?.id).toBe("a");
  });
  it("counts Dhaka day and open overdue follow-ups, excluding done", () => {
    expect(
      followUpCounts(
        [
          { status: "upcoming", scheduled_at: "2026-10-18T17:00:00Z" },
          { status: "upcoming", scheduled_at: "2026-10-17T23:00:00Z" },
          { status: "done", scheduled_at: "2026-10-18T09:00:00Z" },
        ],
        now,
      ),
    ).toEqual({ today: 2, overdue: 1 });
  });
});
