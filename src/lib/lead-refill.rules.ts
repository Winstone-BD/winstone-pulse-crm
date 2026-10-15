/**
 * Auto-refill rules for an empty agent desk.
 *
 * When an agent's queue runs dry, the desk asks the server for a small fresh
 * batch from the head database. The server decides — never the agent — and only
 * when the day's work is honestly done:
 *
 *   - the queue must be truly empty (nothing pending to work);
 *   - the agent must have logged at least one call report today (no skipping
 *     work to farm leads); a desk that was never given leads today is exempt;
 *   - at most AUTO_REFILL_DAILY_CAP batches per agent per day, so the pool
 *     cannot be drained by one desk.
 *
 * This is a system-driven assignment (like the daily automatic run), not the
 * retired self-claim: the agent never picks leads or amounts.
 */

/** Small fixed batch handed out per auto-refill. */
export const AUTO_REFILL_BATCH = 10;

/** Maximum auto-refill batches one agent can receive per working day. */
export const AUTO_REFILL_DAILY_CAP = 2;

export type AutoRefillInput = {
  /** Today's still-open leads on the desk (not closed, not snoozed/unresponsive). */
  activeLeads: number;
  /** Leads handed to this agent today, any state. */
  assignedToday: number;
  /** Call reports submitted by this agent today. */
  reportsToday: number;
  /** Auto-refill batches already given to this agent today. */
  refillsToday: number;
};

export type AutoRefillDecision =
  | { give: true; quantity: number }
  | { give: false; reason: "has_leads" | "work_not_logged" | "daily_cap" };

export function decideAutoRefill(input: AutoRefillInput): AutoRefillDecision {
  if (input.activeLeads > 0) return { give: false, reason: "has_leads" };
  // The check: an empty desk is refilled only after the day's work is logged.
  if (input.assignedToday > 0 && input.reportsToday === 0)
    return { give: false, reason: "work_not_logged" };
  if (input.refillsToday >= AUTO_REFILL_DAILY_CAP) return { give: false, reason: "daily_cap" };
  return { give: true, quantity: AUTO_REFILL_BATCH };
}
