/**
 * Per-person daily lead quota.
 *
 * Everybody on the floor gets the same daily round (set in the IT Console).
 * FIXED_DAILY_QUOTA can hold deliberately lighter desks; it is empty now —
 * HQ asked for every agent to receive the same 50 per day (2026-09-27).
 *
 * Daily performance is compared as a RATIO of the person's own quota.
 */

/** Fallback round size when no plan is stored. */
export const DEFAULT_DAILY_QUOTA = 25;

/** Agent ID → fixed daily quota, regardless of the floor-wide round size. */
export const FIXED_DAILY_QUOTA: Record<string, number> = {};

function key(employeeId: string | null | undefined): string {
  return (employeeId ?? "").toUpperCase().replace(/\s+/g, "");
}

/** Daily quota for one person: their fixed quota, else the floor-wide round. */
export function quotaFor(employeeId: string | null | undefined, floorQuota: number): number {
  const fixed = FIXED_DAILY_QUOTA[key(employeeId)];
  return fixed ?? floorQuota;
}
