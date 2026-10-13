/**
 * Pure maintenance billing rules — no I/O, shared by server and tests.
 * Canonical recurring fee (periods raised from 2026-11 onward): $35.29 USD, due the 14th.
 * Historical invoices keep their own stored currency/amount snapshot and are displayed from it.
 */

export const MAINTENANCE_CURRENCY = "USD" as const;
export const MAINTENANCE_FEE_USD = 35.29;
/** Stored snapshot in integer cents (decimal-safe). */
export const MAINTENANCE_FEE_MINOR = 3529;
export const bdt = (amount: number) => `৳${Math.round(amount).toLocaleString("en-US")}`;
export const MAINTENANCE_FEE_LABEL = "$35.29 USD";
/** Formats a stored invoice snapshot in its own currency (historical USD rows stay USD). */
export function moneyLabel(minor: number | null | undefined, currency: string | null | undefined): string {
  if (minor == null) return "—";
  const cur = (currency ?? "BDT").toUpperCase();
  return cur === "BDT" ? `${bdt(minor / 100)} BDT` : `$${(minor / 100).toFixed(2)} ${cur}`;
}
/** Unpaid lock: 15th 00:00 Dhaka (grace period runs through the 14th 23:59). */
export const BILLING_DAY = 15;
/** Payment notice starts on the 9th 00:00 Dhaka. */
export const NOTICE_DAY = 9;
/** "soon" stage starts 79h before the 15th 00:00 lock (display stage only). */
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

/** Renewal due day (14th 00:00 Dhaka); unpaid lock stays the 15th 00:00. */
export const RENEWAL_DAY = 14;

/** 14th of the period at 00:00 Asia/Dhaka — the renewal due instant, as UTC ISO. */
export function defaultDueAt(period: string): string {
  const [y, m] = period.split("-").map(Number);
  return new Date(Date.UTC(y!, m! - 1, RENEWAL_DAY, 0, 0, 0) - DHAKA_MS).toISOString();
}

/** Next renewal due instant (14th 00:00 Dhaka) at or after `now`; skips the current month when already paid. */
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

export const CRM_PLAN_NAME = "WINSTONE PULSE : CRM";
/** Legacy USD formatter for historical snapshots only. */
export const usd = (cents: number) => `$${(cents / 100).toFixed(2)}`;

/** Amber window: 9th 00:00 through 13th 23:59 Dhaka. Display-only; never changes lock enforcement. */
export function isAmberWindow(now: Date = new Date()): boolean {
  const d = new Date(now.getTime() + 6 * 3600_000);
  const day = d.getUTCDate();
  const mins = d.getUTCHours() * 60 + d.getUTCMinutes();
  void mins;
  return day >= NOTICE_DAY && day < RENEWAL_DAY;
}

export function dhakaMonthName(now: Date = new Date()): string {
  return new Date(now.getTime() + 6 * 3600_000).toLocaleString("en-GB", { month: "long", timeZone: "UTC" });
}

/** Red window: the 14th due day, 00:00–23:59 Dhaka (lock at 15th 00:00). Display-only. */
export function isRedWindow(now: Date = new Date()): boolean {
  const d = new Date(now.getTime() + 6 * 3600_000);
  const day = d.getUTCDate();
  const mins = d.getUTCHours() * 60 + d.getUTCMinutes();
  void mins;
  return day === RENEWAL_DAY;
}

/** "Payment Overdue" only after the due day has passed and before the lock. With due 14th / lock 15th this never shows before lock. */
export function paymentDueLabel(now: Date = new Date()): "Payment Due" | "Payment Overdue" {
  const day = new Date(now.getTime() + 6 * 3600_000).getUTCDate();
  return day > RENEWAL_DAY && day < BILLING_DAY ? "Payment Overdue" : "Payment Due";
}

export type SubscriptionNoticeState = "amber" | "blue" | "red" | null;

/**
 * One calm notice per billing state (display-only, never changes enforcement):
 * verified → no notice; receipt submitted → blue; unpaid on 9th–13th → amber;
 * unpaid on the 14th due day until the 15th 00:00 lock → red.
 */
export function subscriptionNoticeState(paymentStatus: string | null | undefined, locked: boolean, now: Date = new Date()): SubscriptionNoticeState {
  if (locked || paymentStatus === "verified") return null;
  const day = new Date(now.getTime() + 6 * 3600_000).getUTCDate();
  if (day < 9 || day > 14) return null;
  if (paymentStatus === "pending") return "blue";
  return day < RENEWAL_DAY ? "amber" : "red";
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
 * Red is used only on the 14th due day while payment is still unverified.
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
        `${CRM_PLAN_NAME} · ${totalLabel} · due ${RENEWAL_DAY} ${month}.`,
        `Pay before the due date so your pipelines and sales monitoring stay uninterrupted. Access only pauses on ${lockDate} ${lockClock} if payment is still unverified.`,
      ],
      cta: "Review invoice & pay",
    };
  }
  return {
    tone: "red",
    title: "Workspace suspension pending",
    body: [
      `The ${CRM_PLAN_NAME} invoice (${totalLabel}) is due today, ${RENEWAL_DAY} ${month}, and is not verified yet.`,
      `If payment stays unverified, the subscribed workspace is locked automatically on ${lockDate} ${lockClock}.`,
    ],
    cta: "Review invoice & pay",
  };
}

/* ---------------- Distinct billing states (display + API; derived from the one rule) ---------------- */
export type InvoiceStatus = "OPEN" | "OVERDUE" | "PAID";
export type PaymentState = "UNPAID" | "PENDING_VERIFICATION" | "VERIFIED" | "FAILED";
export type AccessStatus = "ACTIVE" | "LOCKED";

/**
 * Splits the stored row into invoice / payment / access states. Pure: never changes enforcement,
 * which stays in decide(). A rejected reference is FAILED (not silently "unpaid"); a pending
 * reference is never shown as unpaid nor as paid.
 */
export function billingStates(input: RuleInput & { dueAt: string; rejectedAt?: string | null }): {
  invoice: InvoiceStatus; payment: PaymentState; access: AccessStatus; recoveryPending: boolean;
} {
  const { locked } = decide(input);
  const payment: PaymentState =
    input.paymentStatus === "verified" ? "VERIFIED"
      : input.paymentStatus === "pending" ? "PENDING_VERIFICATION"
        : input.rejectedAt ? "FAILED" : "UNPAID";
  const invoice: InvoiceStatus =
    payment === "VERIFIED" ? "PAID" : input.now.getTime() >= new Date(input.dueAt).getTime() + 86_400_000 ? "OVERDUE" : "OPEN";
  return { invoice, payment, access: locked ? "LOCKED" : "ACTIVE", recoveryPending: locked && payment === "PENDING_VERIFICATION" };
}

/** Plain CRM invoice label used in every server message (this app bills plan_code='crm' only). */
export const CRM_INVOICE_LABEL = MAINTENANCE_FEE_LABEL;

/**
 * Read-only preview of the invoice the server would raise for a future period.
 * Pure: computes from the canonical rule only — never inserts a row or touches payment/unlock state.
 */
export function futureInvoicePreview(period: string) {
  return {
    period,
    amountMinor: MAINTENANCE_FEE_MINOR,
    currency: MAINTENANCE_CURRENCY,
    amountLabel: moneyLabel(MAINTENANCE_FEE_MINOR, MAINTENANCE_CURRENCY),
    dueAt: defaultDueAt(period),
    lockAt: defaultLockAt(period),
  };
}

/** system_settings key holding the admin-configured maintenance VAT rate: { rate_bps: integer 0..10000 }. */
export const VAT_SETTING_KEY = "maintenance_vat_rate_bps";

/** Parse the stored VAT setting; null means "not configured" (never silently 0%). */
export function parseVatSetting(value: unknown): number | null {
  const bps = (value as { rate_bps?: unknown } | null)?.rate_bps;
  return typeof bps === "number" && Number.isInteger(bps) && bps >= 0 && bps <= 10000 ? bps : null;
}

/** Integer-minor-unit totals. VAT rounds half-up to the minor unit. */
export function invoiceTotals(subtotalMinor: number, vatRateBps: number | null) {
  if (vatRateBps == null) return { subtotalMinor, vatRateBps: null, vatMinor: null, totalMinor: null };
  const vatMinor = Math.floor((subtotalMinor * vatRateBps + 5000) / 10000);
  return { subtotalMinor, vatRateBps, vatMinor, totalMinor: subtotalMinor + vatMinor };
}

export function nextPeriod(period: string): string {
  const [y, m] = period.split("-").map(Number);
  return m === 12 ? `${y! + 1}-01` : `${y}-${String(m! + 1).padStart(2, "0")}`;
}

/** The next invoice that has not been generated yet: this Dhaka month if missing, else the following month. */
export function nextUngeneratedPeriod(now: Date, currentExists: boolean): string {
  const p = dhakaPeriod(now);
  return currentExists ? nextPeriod(p) : p;
}

/** Full preview of the next invoice from the same canonical rule used by generation. Pure. */
export function nextInvoicePreviewFor(period: string, vatRateBps: number | null) {
  const t = invoiceTotals(MAINTENANCE_FEE_MINOR, vatRateBps);
  const fmt = (n: number | null) => (n == null ? null : moneyLabel(n, MAINTENANCE_CURRENCY));
  return {
    period,
    currency: MAINTENANCE_CURRENCY,
    ...t,
    subtotalLabel: fmt(t.subtotalMinor)!,
    vatLabel: fmt(t.vatMinor),
    totalLabel: fmt(t.totalMinor),
    vatRateLabel: vatRateBps == null ? "VAT rate not configured" : `${(vatRateBps / 100).toFixed(2)}%`,
    dueAt: defaultDueAt(period),
    lockAt: defaultLockAt(period),
  };
}

/** "Billing complete / approved" only for a real verified-paid, unlocked state. */
export function billingStatusLine(s: { paymentStatus: string; locked: boolean; period: string } | null): string {
  if (!s) return "Status unavailable";
  if (s.paymentStatus === "verified" && !s.locked) return "Billing complete / approved";
  if (s.paymentStatus === "pending") return `${s.period}: payment reference awaiting Architect verification`;
  return `${s.period}: ${s.locked ? "unpaid — workspace locked" : "unpaid — awaiting payment"}`;
}

/* ---------------- Paid-invoice audit ---------------- */
export type PaidAuditRow = { period: string; markedBy: string; at: string | null; approvalSkipped: boolean; how: string };

/**
 * Who marked each verified invoice paid and whether the usual Architect review was used.
 * Usual path = an audit row "payment_verified" by actor_role "architect" for that period.
 * Anything else (e.g. owner-instruction entries) is shown as approval skipped.
 */
export function paidInvoiceAudit(
  periods: { billing_period: string; payment_status: string; payment_verified_by: string | null; payment_verified_at: string | null }[],
  audit: { billing_period: string | null; action: string; actor: string; actor_role: string | null; at: string }[],
): PaidAuditRow[] {
  return periods
    .filter((p) => p.payment_status === "verified")
    .map((p) => {
      const review = audit.find((a) => a.billing_period === p.billing_period && a.action === "payment_verified" && a.actor_role === "architect");
      return {
        period: p.billing_period,
        markedBy: p.payment_verified_by ?? review?.actor ?? "Unknown",
        at: p.payment_verified_at ?? review?.at ?? null,
        approvalSkipped: !review,
        how: review ? "Architect review (Google + PIN)" : "Marked paid outside the Architect review",
      };
    });
}
