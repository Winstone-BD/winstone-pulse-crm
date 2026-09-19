/**
 * Lead rescue rules — no lead is ever wasted.
 *
 * Every lead sitting on a desk is in exactly one of these states, worked out
 * from stored facts only (never guessed):
 *
 *   working      — still inside the agent's normal working window
 *   retry_wait   — nobody answered; the lead waits for its next call slot
 *   retry_due    — the waiting time passed, it must be called again today
 *   stale        — days on the desk with not a single call attempt
 *   exhausted    — called the maximum number of times, still nobody answered
 *
 * `stale` and `exhausted` leads go back to the head database so the next daily
 * hand-out gives them to a desk that will actually work them. Deciding is pure
 * so the same rule runs in tests, on the web board and in the daily job.
 */

import { MAX_UNANSWERED_ATTEMPTS } from "@/lib/call-retry";

/** Days a lead may sit on a desk without a single call before it is pulled back. */
export const STALE_DESK_DAYS = 3;

export type RescueState = "working" | "retry_wait" | "retry_due" | "stale" | "exhausted";

export type RescueLead = {
  id: string;
  workState: string | null;
  workDate: string | null;
  callAttempts: number | null;
  lastCallAt: string | null;
  retryAfter: string | null;
  unansweredAttempts: number | null;
  assignedTo: string | null;
};

export type RescueDecision = {
  state: RescueState;
  /** Should the lead go back to the head database for redistribution? */
  returnToPool: boolean;
  /** Bengali reason, shown on the lead's own history. */
  reason: string;
};

function daysBetween(fromDay: string, toDay: string): number {
  const from = Date.parse(`${fromDay}T00:00:00Z`);
  const to = Date.parse(`${toDay}T00:00:00Z`);
  if (Number.isNaN(from) || Number.isNaN(to)) return 0;
  return Math.round((to - from) / 86_400_000);
}

export function rescueDecision(
  lead: RescueLead,
  options: { today: string; now?: Date },
): RescueDecision {
  const now = options.now ?? new Date();

  if (lead.workState === "completed") {
    return { state: "working", returnToPool: false, reason: "টাস্ক শেষ হয়েছে" };
  }

  const unanswered = lead.unansweredAttempts ?? 0;
  const attempts = lead.callAttempts ?? 0;

  if (unanswered >= MAX_UNANSWERED_ATTEMPTS) {
    return {
      state: "exhausted",
      returnToPool: true,
      reason: `${unanswered} বার কল করেও কেউ ধরেনি — লিড ডেটাবেজে ফিরে গেল, পরের বণ্টনে অন্য ডেস্কে যাবে`,
    };
  }

  const waitingDays = lead.workDate ? daysBetween(lead.workDate, options.today) : 0;
  if (attempts === 0 && !lead.lastCallAt && waitingDays >= STALE_DESK_DAYS) {
    return {
      state: "stale",
      returnToPool: true,
      reason: `${waitingDays} দিন ডেস্কে পড়ে ছিল, একবারও কল হয়নি — লিড ডেটাবেজে ফিরে গেল`,
    };
  }

  if (lead.retryAfter) {
    const at = Date.parse(lead.retryAfter);
    if (!Number.isNaN(at)) {
      return at > now.getTime()
        ? { state: "retry_wait", returnToPool: false, reason: "পরের কলের সময় হয়নি" }
        : { state: "retry_due", returnToPool: false, reason: "আবার কল করার সময় হয়েছে" };
    }
  }

  return { state: "working", returnToPool: false, reason: "কাজ চলছে" };
}

/** Bengali labels for the board. */
export const RESCUE_LABELS: Record<RescueState, string> = {
  working: "কাজ চলছে",
  retry_wait: "ধরেনি — অপেক্ষা",
  retry_due: "আবার কল করার সময়",
  stale: "পড়ে আছে — কল হয়নি",
  exhausted: "বারবার ধরেনি",
};

export type RescueSummary = {
  working: number;
  retryWait: number;
  retryDue: number;
  stale: number;
  exhausted: number;
  returnedToPool: string[];
};

/** Counts the whole floor in one pass and lists what must go back to the pool. */
export function summarizeRescue(
  leads: RescueLead[],
  options: { today: string; now?: Date },
): RescueSummary {
  const summary: RescueSummary = {
    working: 0,
    retryWait: 0,
    retryDue: 0,
    stale: 0,
    exhausted: 0,
    returnedToPool: [],
  };
  for (const lead of leads) {
    const decision = rescueDecision(lead, options);
    if (decision.state === "retry_wait") summary.retryWait += 1;
    else if (decision.state === "retry_due") summary.retryDue += 1;
    else if (decision.state === "stale") summary.stale += 1;
    else if (decision.state === "exhausted") summary.exhausted += 1;
    else summary.working += 1;
    if (decision.returnToPool) summary.returnedToPool.push(lead.id);
  }
  return summary;
}
