/**
 * Pure maintenance billing rules — no I/O, shared by server and tests.
 * Fee is USD only; no other currency is ever shown for this feature.
 */

export const MAINTENANCE_FEE_USD = 46.29;
export const VAT_RATE = 0.15;
/** Full operating-system unlock: $46.29 + 15% VAT ($6.94) = $53.23 USD. */
export const MAINTENANCE_FEE_VAT_USD = 6.94;
export const MAINTENANCE_FEE_TOTAL_USD = 53.23;
export const MAINTENANCE_FEE_LABEL = "$46.29 USD + 15% VAT ($6.94) = $53.23 USD";
/** CRM-only (installation files) unlock: $15.79 + 15% VAT ($2.37) = $18.16 USD. */
export const CRM_ONLY_FEE_LABEL = "$15.79 USD + 15% VAT ($2.37) = $18.16 USD";
/** Unpaid lock: 15th 00:00 Dhaka (grace period runs through the 14th 23:59). */
export const BILLING_DAY = 15;
/** Payment notice starts on the 9th 00:00 Dhaka. */
export const NOTICE_DAY = 9;
/** Red warning starts the 11th 17:00 Dhaka — 79h before the 15th 00:00 lock. */
export const RED_WARNING_HOURS = 79;
export const MAX_UNLOCK_MINUTES = 24 * 60;
export const UNLOCK_PRESET_HOURS = [1, 2, 4, 8, 12, 24] as const;
export const ARCHITECT_EMAIL = "zhemongrowth@gmail.com";

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

/** 12th of the period at 00:00 Asia/Dhaka — the renewal due instant, as UTC ISO. */
export function defaultDueAt(period: string): string {
  const [y, m] = period.split("-").map(Number);
  return new Date(Date.UTC(y!, m! - 1, RENEWAL_DAY, 0, 0, 0) - DHAKA_MS).toISOString();
}

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
  const msToLock = lockAt - now;
  if (msToLock <= 24 * 3_600_000) return { locked: false, stage: "due_today" };
  // Red starts the evening before renewal: 11th 17:00 Dhaka (79h before the lock).
  if (msToLock <= RED_WARNING_HOURS * 3_600_000) return { locked: false, stage: "soon" };
  if (msToLock <= (BILLING_DAY - NOTICE_DAY) * 86_400_000) return { locked: false, stage: "upcoming" };
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

/** CRM plan invoice in integer cents (decimal-safe): 1579 + round(1579 × 15%) = 1579 + 237 = 1816. */
export const CRM_PLAN_NAME = "WINSTONE PULSE : CRM";
export const CRM_BASE_CENTS = 1579;
export const VAT_RATE_BPS = 1500;
export const CRM_VAT_CENTS = Math.round((CRM_BASE_CENTS * VAT_RATE_BPS) / 10000);
export const CRM_TOTAL_CENTS = CRM_BASE_CENTS + CRM_VAT_CENTS;
export const usd = (cents: number) => `$${(cents / 100).toFixed(2)}`;

/** Amber window: 9th 00:00 through 11th 16:59 Dhaka. Display-only; never changes lock enforcement. */
export function isAmberWindow(now: Date = new Date()): boolean {
  const d = new Date(now.getTime() + 6 * 3600_000);
  const day = d.getUTCDate();
  const mins = d.getUTCHours() * 60 + d.getUTCMinutes();
  return day === 9 || day === 10 || (day === 11 && mins < 17 * 60);
}

export function dhakaMonthName(now: Date = new Date()): string {
  return new Date(now.getTime() + 6 * 3600_000).toLocaleString("en-GB", { month: "long", timeZone: "UTC" });
}

/** Red window: 11th 17:00 through 14th 23:59 Dhaka. Display-only. */
export function isRedWindow(now: Date = new Date()): boolean {
  const d = new Date(now.getTime() + 6 * 3600_000);
  const day = d.getUTCDate();
  const mins = d.getUTCHours() * 60 + d.getUTCMinutes();
  return (day === 11 && mins >= 17 * 60) || day === 12 || day === 13 || day === 14;
}

/** Accurate label: "Payment Overdue" only after the 12th (due date) has passed in Dhaka. */
export function paymentDueLabel(now: Date = new Date()): "Payment Due" | "Payment Overdue" {
  const day = new Date(now.getTime() + 6 * 3600_000).getUTCDate();
  return day > 12 && day < 15 ? "Payment Overdue" : "Payment Due";
}

export type SubscriptionNoticeState = "amber" | "blue" | "red" | null;

/**
 * One calm notice per billing state (display-only, never changes enforcement):
 * verified → no notice; receipt submitted → blue; unpaid on 9th–12th → amber;
 * unpaid after the 12th due date until the 15th 00:00 lock → red.
 */
export function subscriptionNoticeState(paymentStatus: string | null | undefined, locked: boolean, now: Date = new Date()): SubscriptionNoticeState {
  if (locked || paymentStatus === "verified") return null;
  const day = new Date(now.getTime() + 6 * 3600_000).getUTCDate();
  if (day < 9 || day > 14) return null;
  if (paymentStatus === "pending") return "blue";
  return day <= 12 ? "amber" : "red";
}

/** "15 Oct 2026" in Dhaka time — the date half of the notice deadline chip. */
export function dhakaDateLabel(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Dhaka",
  });
}

/** "00:00 (Asia/Dhaka)" in Dhaka time — the clock half of the notice deadline chip. */
export function dhakaClockLabel(iso: string | null | undefined): string {
  if (!iso) return "—";
  const t = new Date(iso).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Dhaka",
  });
  return `${t} (Asia/Dhaka)`;
}

/** Human countdown for the deadline chip: "6 days left" → "5 hours left" → "12 minutes left". */
export function deadlineLeftLabel(ms: number): string {
  if (ms <= 0) return "Deadline passed";
  const days = ms / 86_400_000;
  if (days >= 1) return `${Math.ceil(days)} ${Math.ceil(days) === 1 ? "day" : "days"} left`;
  const hours = ms / 3_600_000;
  if (hours >= 1) return `${Math.ceil(hours)} ${Math.ceil(hours) === 1 ? "hour" : "hours"} left`;
  const mins = Math.ceil(ms / 60_000);
  return `${mins} ${mins === 1 ? "minute" : "minutes"} left`;
}

export type NoticeCopy = { tone: "amber" | "blue" | "red"; title: string; body: string[]; cta: string | null };

/**
 * Wording for the subscription notice card. Display-only: it never decides access.
 * Red is used only after the 12th due date has genuinely passed and payment is unverified.
 */
export function subscriptionNoticeCopy(
  state: Exclude<SubscriptionNoticeState, null>,
  opts: { month: string; totalLabel: string; lockDate: string; lockClock: string },
): NoticeCopy {
  const { month, totalLabel, lockDate, lockClock } = opts;
  if (state === "blue") {
    return {
      tone: "blue",
      title: "Payment verification in progress",
      body: [
        `${CRM_PLAN_NAME} has received your payment. The System Architect is verifying it now — no further action is needed.`,
        `Verification normally completes before ${lockDate} ${lockClock}.`,
      ],
      cta: null,
    };
  }
  if (state === "amber") {
    return {
      tone: "amber",
      title: "Payment due soon",
      body: [
        `${CRM_PLAN_NAME} · ${totalLabel} including VAT · due ${RENEWAL_DAY} ${month}.`,
        `Pay before the due date so your pipelines and sales monitoring stay uninterrupted. Access only pauses on ${lockDate} ${lockClock} if payment is still unverified.`,
      ],
      cta: "Review invoice & pay",
    };
  }
  return {
    tone: "red",
    title: "Workspace suspension pending",
    body: [
      `The ${CRM_PLAN_NAME} invoice (${totalLabel} incl. VAT) passed its ${RENEWAL_DAY} ${month} due date and is not verified yet.`,
      `If payment stays unverified, the subscribed workspace is locked automatically on ${lockDate} ${lockClock}.`,
    ],
    cta: "Review invoice & pay",
  };
}
