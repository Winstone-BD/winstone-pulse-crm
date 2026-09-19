/**
 * Workday allocation arithmetic — the one place the daily numbers are decided.
 *
 * These functions are pure: the same agent loads always produce the same plan,
 * on the server, in the web dashboard, in the Android app and in tests. The
 * server engine uses them to move leads, and every screen shows the numbers
 * that come back from the server — no client ever recalculates an allocation.
 *
 * The rules, in order:
 *   1. pending work counts FIRST towards the day's target;
 *   2. a desk over its target keeps every lead (nothing is dropped), but the
 *      part above the target is named as excess so it is never hidden;
 *   3. only genuinely movable excess (never called, no active call, not a
 *      manually protected hand-out) may travel to a desk below its target, and
 *      only up to that desk's free capacity;
 *   4. whatever gap is left is topped up from the head database — never more
 *      than the gap, so nobody is pushed above the target;
 *   5. when the database cannot cover the remaining gap, the shortage is
 *      reported truthfully instead of being filled with invented leads.
 */

/** The one working day this request's carried-over/excess reporting applies to. */
export const SPECIAL_WORKDAY = "2026-09-20";

/** True for the single workday whose detailed carry-over breakdown was ordered. */
export function isSpecialWorkday(workDate: string): boolean {
  return workDate === SPECIAL_WORKDAY;
}

export type AgentLoad = {
  id: string;
  /** Target number of open leads for this desk today. */
  quota: number;
  /** Open (pending) leads the desk holds right now, from the database. */
  pending: number;
  /**
   * How many of the excess leads are safe to hand over: pending, never called,
   * no call in flight, not a protected manual hand-out. Defaults to 0 — a lead
   * is only movable when the server has proven it is.
   */
  movableExcess?: number;
};

export type AllocationPlan = {
  /** Excess hand-overs: `count` leads from one desk to another. */
  transfers: { from: string; to: string; count: number }[];
  /** Leads to take from the head database, per desk. Never more than the gap. */
  topUp: Record<string, number>;
  /** Excess still sitting above target after transfers — shown as dispute. */
  unresolvedExcess: Record<string, number>;
  /** Gap left unfilled because the database ran out. */
  shortage: number;
  /** Total leads the floor needs from the database after transfers. */
  requested: number;
};

/**
 * Turns today's real loads into the exact moves to make. Idempotent by nature:
 * run it again on the resulting loads and it asks for nothing more.
 */
export function planAllocation(agents: AgentLoad[], poolAvailable: number): AllocationPlan {
  const state = agents.map((agent) => ({
    id: agent.id,
    quota: Math.max(0, agent.quota),
    pending: Math.max(0, agent.pending),
    movable: Math.max(0, Math.min(agent.movableExcess ?? 0, Math.max(0, agent.pending - agent.quota))),
  }));

  const transfers: AllocationPlan["transfers"] = [];
  const gapOf = (row: (typeof state)[number]) => Math.max(0, row.quota - row.pending);

  // Excess first: the floor uses what it already holds before touching the database.
  const donors = state.filter((row) => row.movable > 0).sort((a, b) => b.movable - a.movable);
  for (const donor of donors) {
    const receivers = state
      .filter((row) => row.id !== donor.id && gapOf(row) > 0)
      .sort((a, b) => gapOf(b) - gapOf(a));
    for (const receiver of receivers) {
      if (donor.movable <= 0) break;
      const count = Math.min(donor.movable, gapOf(receiver));
      if (count <= 0) continue;
      transfers.push({ from: donor.id, to: receiver.id, count });
      donor.movable -= count;
      donor.pending -= count;
      receiver.pending += count;
    }
  }

  // Remaining gaps are filled from the database, largest gap first, and the
  // pool is never over-drawn.
  const topUp: Record<string, number> = {};
  let left = Math.max(0, poolAvailable);
  const requested = state.reduce((sum, row) => sum + gapOf(row), 0);
  for (const row of [...state].sort((a, b) => gapOf(b) - gapOf(a))) {
    const want = gapOf(row);
    if (want <= 0) continue;
    const give = Math.min(want, left);
    if (give > 0) {
      topUp[row.id] = give;
      row.pending += give;
      left -= give;
    }
  }

  const unresolvedExcess: Record<string, number> = {};
  for (const row of state) {
    const excess = row.pending - row.quota;
    if (excess > 0) unresolvedExcess[row.id] = excess;
  }

  return {
    transfers,
    topUp,
    unresolvedExcess,
    shortage: Math.max(0, requested - Math.max(0, poolAvailable)),
    requested,
  };
}

export type AgentAllocationStatus = {
  agentId: string;
  name: string;
  employeeId: string | null;
  quota: number;
  /** Open leads on today's board — the authoritative count. */
  pending: number;
  /** Of those, leads carried over from an earlier workday. */
  carriedOver: number;
  /** Earliest workday the carried-over leads came from. */
  carriedFrom: string | null;
  /** Leads handed out from the head database today. */
  newFromDatabase: number;
  /** Excess leads received from another desk today. */
  receivedFromOthers: number;
  /** Excess leads handed to other desks today. */
  movedToOthers: number;
  /** Leads finished today. */
  completed: number;
  /** Open leads above the target — shown as excess/dispute, never deleted. */
  excess: number;
  /** How many more open leads the desk needs to reach the target. */
  gap: number;
};

/** Plain-language state for one desk, used for the banner/warning wording. */
export type AllocationState = "on_target" | "short" | "excess";

export function allocationState(row: { pending: number; quota: number }): AllocationState {
  if (row.pending > row.quota) return "excess";
  if (row.pending < row.quota) return "short";
  return "on_target";
}
