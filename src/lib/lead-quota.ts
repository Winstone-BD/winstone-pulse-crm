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
export const DEFAULT_DAILY_QUOTA = 25;

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
