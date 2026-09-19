import { describe, expect, it } from "vitest";

import { MAX_UNANSWERED_ATTEMPTS } from "@/lib/call-retry";
import {
  rescueDecision,
  STALE_DESK_DAYS,
  summarizeRescue,
  type RescueLead,
} from "@/lib/lead-rescue";

const TODAY = "2026-09-20";
const NOW = new Date("2026-09-20T05:00:00Z");

function lead(over: Partial<RescueLead>): RescueLead {
  return {
    id: "l1",
    workState: "pending",
    workDate: TODAY,
    callAttempts: 0,
    lastCallAt: null,
    retryAfter: null,
    unansweredAttempts: 0,
    assignedTo: "a1",
    ...over,
  };
}

describe("no lead is left to rot", () => {
  it("keeps a lead handed out today on the desk", () => {
    const decision = rescueDecision(lead({}), { today: TODAY, now: NOW });
    expect(decision.state).toBe("working");
    expect(decision.returnToPool).toBe(false);
  });

  it("leaves a finished task alone", () => {
    expect(
      rescueDecision(lead({ workState: "completed", unansweredAttempts: 9 }), {
        today: TODAY,
        now: NOW,
      }).returnToPool,
    ).toBe(false);
  });

  it("waits for the next call slot, then marks it due", () => {
    const waiting = rescueDecision(lead({ retryAfter: "2026-09-20T09:00:00Z" }), {
      today: TODAY,
      now: NOW,
    });
    expect(waiting.state).toBe("retry_wait");
    const due = rescueDecision(lead({ retryAfter: "2026-09-20T04:00:00Z" }), {
      today: TODAY,
      now: NOW,
    });
    expect(due.state).toBe("retry_due");
    expect(due.returnToPool).toBe(false);
  });

  it("pulls back a lead nobody ever answered", () => {
    const decision = rescueDecision(
      lead({ unansweredAttempts: MAX_UNANSWERED_ATTEMPTS, callAttempts: 6 }),
      { today: TODAY, now: NOW },
    );
    expect(decision.state).toBe("exhausted");
    expect(decision.returnToPool).toBe(true);
    expect(decision.reason).toContain("ডেটাবেজে ফিরে");
  });

  it("pulls back a lead that sat on a desk without a single call", () => {
    const decision = rescueDecision(lead({ workDate: "2026-09-17" }), {
      today: TODAY,
      now: NOW,
    });
    expect(decision.state).toBe("stale");
    expect(decision.returnToPool).toBe(true);
  });

  it("does not pull back a lead that was actually called", () => {
    const decision = rescueDecision(
      lead({ workDate: "2026-09-10", callAttempts: 2, lastCallAt: "2026-09-19T05:00:00Z" }),
      { today: TODAY, now: NOW },
    );
    expect(decision.returnToPool).toBe(false);
  });

  it("holds a lead exactly at the edge of the stale window", () => {
    const edge = new Date(Date.parse(`${TODAY}T00:00:00Z`) - (STALE_DESK_DAYS - 1) * 86_400_000)
      .toISOString()
      .slice(0, 10);
    expect(rescueDecision(lead({ workDate: edge }), { today: TODAY, now: NOW }).returnToPool).toBe(
      false,
    );
  });

  it("counts the whole floor in one pass", () => {
    const summary = summarizeRescue(
      [
        lead({ id: "a" }),
        lead({ id: "b", retryAfter: "2026-09-20T09:00:00Z" }),
        lead({ id: "c", retryAfter: "2026-09-20T01:00:00Z" }),
        lead({ id: "d", workDate: "2026-09-01" }),
        lead({ id: "e", unansweredAttempts: MAX_UNANSWERED_ATTEMPTS }),
      ],
      { today: TODAY, now: NOW },
    );
    expect(summary).toMatchObject({
      working: 1,
      retryWait: 1,
      retryDue: 1,
      stale: 1,
      exhausted: 1,
    });
    expect(summary.returnedToPool).toEqual(["d", "e"]);
  });
});
