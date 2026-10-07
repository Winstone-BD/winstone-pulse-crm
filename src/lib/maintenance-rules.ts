/**
 * Pure maintenance billing rules — no I/O, shared by server and tests.
 * Fee is USD only; no other currency is ever shown for this feature.
 */

export const MAINTENANCE_FEE_USD = 46.29;
export const MAINTENANCE_FEE_LABEL = "$46.29 USD";
/** Unpaid lock: 15th 00:00 Dhaka (grace period runs through the 14th 23:59). */
export const BILLING_DAY = 15;
/** Payment notice starts on the 9th 00:00 Dhaka. */
export const NOTICE_DAY = 9;
export const MAX_UNLOCK_MINUTES = 24 * 60;
export const UNLOCK_PRESET_HOURS = [1, 2, 4, 8, 12, 24] as const;
export const ARCHITECT_EMAIL = "zhemon.sm123@gmail.com";

export type PaymentStatus = "unpaid" | "pending" | "verified";
export type UnlockStatus = "none" | "requested" | "approved" | "denied" | "expired";
export type Stage =
  | "paid"
  | "unlocked"
  | "clear"
  | "upcoming"
  | "soon"
  | "due_today"
  | "locked";

const DHAKA_MS = 6 * 60 * 60 * 1000;

/** Billing period in Dhaka time, e.g. "2026-09". */
export function dhakaPeriod(now: Date = new Date()): string {
  const d = new Date(now.getTime() + DHAKA_MS);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** 15th of the period at 00:00 Asia/Dhaka, as a UTC ISO string. */
export function defaultLockAt(period: string): string {
  const [y, m] = period.split("-").map(Number);
  return new Date(Date.UTC(y!, m! - 1, BILLING_DAY, 0, 0, 0) - DHAKA_MS).toISOString();
}

/** Renewal due day (12th 00:00 Dhaka). */
export const RENEWAL_DAY = 12;

/** Next renewal due instant (12th 00:00 Dhaka) at or after `now`; skips the current month when already paid. */
export function nextRenewalDueAt(now: Date, paid: boolean): string {
  const d = new Date(now.getTime() + DHAKA_MS);
  let y = d.getUTCFullYear();
  let m = d.getUTCMonth();
  const at = (yy: number, mm: number) => Date.UTC(yy, mm, RENEWAL_DAY) - DHAKA_MS;
  if (paid || at(y, m) <= now.getTime()) {
    m += 1;
    if (m > 11) { m = 0; y += 1; }
  }
  return new Date(at(y, m)).toISOString();
}

export type RuleInput = {
  now: Date;
  lockAt: string;
  paymentStatus: PaymentStatus;
  unlockStatus: UnlockStatus;
  unlockExpiresAt: string | null;
};

/** The single lock decision. Everything else only displays its result. */
export function decide(input: RuleInput): { locked: boolean; stage: Stage } {
  const now = input.now.getTime();
  if (input.paymentStatus === "verified") return { locked: false, stage: "paid" };
  if (
    input.unlockStatus === "approved" &&
    input.unlockExpiresAt &&
    new Date(input.unlockExpiresAt).getTime() > now
  ) {
    return { locked: false, stage: "unlocked" };
  }
  const lockAt = new Date(input.lockAt).getTime();
  if (now >= lockAt) return { locked: true, stage: "locked" };
  const days = (lockAt - now) / 86_400_000;
  if (days <= 1) return { locked: false, stage: "due_today" };
  if (days <= 3) return { locked: false, stage: "soon" };
  if (days <= BILLING_DAY - NOTICE_DAY) return { locked: false, stage: "upcoming" };
  return { locked: false, stage: "clear" };
}

/** Clamp an architect-chosen duration: at least 15 minutes, never above 24 hours. */
export function clampUnlockMinutes(minutes: number): number {
  if (!Number.isFinite(minutes)) throw new Error("Invalid duration");
  const m = Math.round(minutes);
  if (m < 15) throw new Error("Minimum unlock is 15 minutes");
  if (m > MAX_UNLOCK_MINUTES) throw new Error("Maximum unlock is 24 hours");
  return m;
}

/** Server-side identity rule for the System Architect. */
export function isArchitectIdentity(user: {
  email?: string | null;
  emailConfirmed?: boolean;
  providers?: string[];
}): boolean {
  return (
    (user.email ?? "").trim().toLowerCase() === ARCHITECT_EMAIL &&
    user.emailConfirmed === true &&
    (user.providers ?? []).includes("google")
  );
}

export function dhakaTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-GB", {
    timeZone: "Asia/Dhaka",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}
