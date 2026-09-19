/**
 * Per-person daily lead quota.
 *
 * Everybody on the floor gets the standard daily round (30 by default, set in
 * the IT Console). A few desks are deliberately lighter — the Sell Team Admin
 * carries admin duties alongside calling — so they receive a smaller quota.
 *
 * Because the quota differs, daily performance is compared as a RATIO of the
 * person's own quota, never as a raw total. A lighter desk is therefore neither
 * rewarded nor punished for the smaller list.
 */

/** Fallback round size when no plan is stored. */
export const DEFAULT_DAILY_QUOTA = 30;

/** Agent ID → fixed daily quota, regardless of the floor-wide round size. */
export const FIXED_DAILY_QUOTA: Record<string, number> = {
  // Abu Haidar — Sell Team Admin
  WIN2607: 15,
};

function key(employeeId: string | null | undefined): string {
  return (employeeId ?? "").toUpperCase().replace(/\s+/g, "");
}

/** Daily quota for one person: their fixed quota, else the floor-wide round. */
export function quotaFor(employeeId: string | null | undefined, floorQuota: number): number {
  const fixed = FIXED_DAILY_QUOTA[key(employeeId)];
  return fixed ?? floorQuota;
}

/** True when this desk runs on a lighter, fixed quota. */
export function hasFixedQuota(employeeId: string | null | undefined): boolean {
  return key(employeeId) in FIXED_DAILY_QUOTA;
}

/**
 * Fair, quota-normalised score: what the same effort would look like on a
 * standard round. Keeps the leaderboard honest across different quotas.
 */
export function ratioScore(score: number, quota: number): number {
  if (quota <= 0) return score;
  return Math.round((score / quota) * DEFAULT_DAILY_QUOTA);
}

/**
 * Effective quota for one day: the base round plus any extra leads granted
 * today. Extra leads count towards the target, so an extra batch cannot quietly
 * lower somebody's completion percentage.
 */
export function effectiveQuota(baseQuota: number, extraToday = 0): number {
  return Math.max(0, baseQuota) + Math.max(0, extraToday);
}

/**
 * Quota-normalised completion: 15 of 15 and 25 of 25 are both 100%.
 * Capped at 150% so an unusually big day cannot distort the leaderboard.
 */
export function completionPercent(completed: number, quota: number): number {
  if (quota <= 0) return 0;
  return Math.min(150, Math.round((Math.max(0, completed) / quota) * 100));
}
