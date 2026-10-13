import { createHmac, createHash, timingSafeEqual } from "node:crypto";
/** This app (CRM) only reads and changes its own subscription; the OS plan is independent. */
const PLAN_CODE = "crm" as const;

import {
  MAINTENANCE_CURRENCY,
  MAINTENANCE_FEE_USD,
  MAINTENANCE_FEE_MINOR,
  moneyLabel,
  clampUnlockMinutes,
  decide,
  defaultDueAt,
  defaultLockAt,
  dhakaTime,
  dhakaPeriod,
  isArchitectIdentity,
  billingStates,
  VAT_SETTING_KEY,
  parseVatSetting,
  invoiceTotals,
  nextUngeneratedPeriod,
  nextInvoicePreviewFor,
  type AccessStatus,
  type InvoiceStatus,
  type PaymentState,
  type PaymentStatus,
  type Stage,
  type UnlockStatus,
} from "@/lib/maintenance-rules";

export type MaintenanceState = {
  period: string;
  /** Amount label from this invoice's own stored snapshot (historical rows keep their currency). */
  amountLabel: string;
  currency: string;
  dueDate: string;
  lockAt: string;
  paymentStatus: PaymentStatus;
  paymentRef: string | null;
  paymentVerifiedAt: string | null;
  paymentVerifiedBy: string | null;
  unlockStatus: UnlockStatus;
  unlockStartedAt: string | null;
  unlockExpiresAt: string | null;
  approvedBy: string | null;
  approvalReason: string | null;
  openRequest: boolean;
  locked: boolean;
  stage: Stage;
  invoiceStatus: InvoiceStatus;
  paymentState: PaymentState;
  accessStatus: AccessStatus;
  /** Locked while a submitted reference awaits review: recovery state, never a second charge. */
  recoveryPending: boolean;
  rejectedReason: string | null;
};

async function db() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

export async function audit(entry: {
  actor: string;
  actorRole: string;
  action: string;
  period?: string | null;
  previous?: string | null;
  next?: string | null;
  reason?: string | null;
  requestId?: string | null;
  durationMinutes?: number | null;
  expiresAt?: string | null;
  metadata?: Record<string, unknown>;
}) {
  const client = await db();
  const { error } = await client.from("maintenance_audit").insert({
    actor: entry.actor,
    actor_role: entry.actorRole,
    action: entry.action,
    billing_period: entry.period ?? null,
    previous_state: entry.previous ?? null,
    new_state: entry.next ?? null,
    reason: entry.reason ?? null,
    request_id: entry.requestId ?? null,
    duration_minutes: entry.durationMinutes ?? null,
    expires_at: entry.expiresAt ?? null,
    metadata: (entry.metadata ?? {}) as never,
  });
  if (error) console.error("maintenance audit failed", error);
}

/** Label from the row's own immutable snapshot: each row shows its own stored currency. */
function rowAmountLabel(row: { total_cents?: number | null; currency?: string | null; fee_usd?: number | string | null }): string {
  if (row.total_cents != null) return moneyLabel(row.total_cents, row.currency);
  return moneyLabel(Math.round(Number(row.fee_usd ?? 0) * 100), row.currency ?? "USD");
}

let cache: { at: number; state: MaintenanceState } | null = null;
export function clearMaintenanceCache() {
  cache = null;
}

/** Admin-configured VAT rate (basis points) or null when not configured. Read-only. */
export async function readVatRateBps(): Promise<number | null> {
  const client = await db();
  const { data } = await client.from("system_settings").select("value").eq("key", VAT_SETTING_KEY).maybeSingle();
  return parseVatSetting(data?.value ?? null);
}

/** Read-only preview of the next not-yet-generated invoice. SELECTs only — never inserts or updates. */
export async function previewNextInvoice(now: Date = new Date()) {
  const client = await db();
  const { data } = await client
    .from("system_maintenance").select("billing_period, payment_status, unlock_status, unlock_expires_at, lock_at")
    .eq("plan_code", PLAN_CODE).eq("billing_period", dhakaPeriod(now)).maybeSingle();
  const period = nextUngeneratedPeriod(now, Boolean(data));
  const status = data
    ? {
        period: data.billing_period,
        paymentStatus: (data.payment_status ?? "unpaid") as string,
        locked: decide({
          now, lockAt: data.lock_at, paymentStatus: (data.payment_status ?? "unpaid") as PaymentStatus,
          unlockStatus: (data.unlock_status ?? "none") as UnlockStatus, unlockExpiresAt: data.unlock_expires_at,
        }).locked,
      }
    : null;
  return { preview: nextInvoicePreviewFor(period, await readVatRateBps()), status };
}

async function ensureRow(period: string) {
  const client = await db();
  const { data } = await client
    .from("system_maintenance")
    .select("*")
    .eq("plan_code", PLAN_CODE).eq("billing_period", period)
    .maybeSingle();
  if (data) return data;
  const lockAt = defaultLockAt(period);
  const vat = invoiceTotals(MAINTENANCE_FEE_MINOR, await readVatRateBps());
  await client.from("system_maintenance").upsert(
    {
      billing_period: period,
      plan_code: PLAN_CODE,
      fee_usd: MAINTENANCE_FEE_USD,
      base_cents: MAINTENANCE_FEE_MINOR,
      // Same canonical source as the preview; unconfigured VAT is stored as 0 VAT with the rate left null.
      vat_rate_bps: vat.vatRateBps,
      vat_cents: vat.vatMinor ?? 0,
      total_cents: vat.totalMinor ?? MAINTENANCE_FEE_MINOR,
      currency: MAINTENANCE_CURRENCY,
      due_date: defaultDueAt(period),
      lock_at: lockAt,
    },
    { onConflict: "billing_period,plan_code", ignoreDuplicates: true },
  );
  const { data: row, error } = await client
    .from("system_maintenance")
    .select("*")
    .eq("plan_code", PLAN_CODE).eq("billing_period", period)
    .single();
  if (error || !row) throw new Error("Maintenance state unavailable");
  await audit({ actor: "system", actorRole: "system", action: "maintenance_due", period, next: "unpaid" });
  return row;
}

/** Canonical maintenance state for the current Dhaka billing period. */
export async function maintenanceAccess(now: Date = new Date()): Promise<MaintenanceState> {
  if (cache && now.getTime() - cache.at < 15_000) return cache.state;
  const client = await db();
  const period = dhakaPeriod(now);
  let row = await ensureRow(period);
  const amountLabel = rowAmountLabel(row);
  const CRM_INVOICE_LABEL = amountLabel;

  // Server-side expiry: an approved unlock past its time is closed here, once.
  if (
    row.unlock_status === "approved" &&
    row.unlock_expires_at &&
    new Date(row.unlock_expires_at).getTime() <= now.getTime()
  ) {
    const { data: updated } = await client
      .from("system_maintenance")
      .update({ unlock_status: "expired" })
      .eq("id", row.id)
      .eq("unlock_status", "approved")
      .select("*")
      .maybeSingle();
    if (updated) {
      row = updated;
      await audit({ actor: "system", actorRole: "system", action: "unlock_expired", period, previous: "approved", next: "expired", expiresAt: row.unlock_expires_at });
      if (row.payment_status !== "verified" && now.getTime() >= new Date(row.lock_at).getTime()) {
        await audit({ actor: "system", actorRole: "system", action: "system_relocked", period, previous: "active", next: "locked" });
      }
    }
  }

  const result = decide({
    now,
    lockAt: row.lock_at,
    paymentStatus: row.payment_status,
    unlockStatus: row.unlock_status,
    unlockExpiresAt: row.unlock_expires_at,
  });

  if (result.locked && !row.locked_logged_at) {
    const { data: flagged } = await client
      .from("system_maintenance")
      .update({ locked_logged_at: now.toISOString(), lock_status: "locked" })
      .eq("id", row.id)
      .is("locked_logged_at", null)
      .select("id")
      .maybeSingle();
    if (flagged) {
      await audit({ actor: "system", actorRole: "system", action: "system_locked", period, previous: "active", next: "locked" });
      if (row.payment_status === "pending") {
        await notifyOnce(`maintenance_locked_${period}`, "critical", "Access paused — payment awaiting verification", `CRM access paused at ${dhakaTime(row.lock_at)} (Dhaka) while reference ${row.payment_ref ?? "—"} awaits review. Do not pay again — verify or reject it; verification restores access automatically.`);
      } else {
        await notifyOnce(`maintenance_locked_${period}`, "critical", "System locked — invoice unverified", `CRM locked at ${dhakaTime(row.lock_at)} (Dhaka). Invoice ${CRM_INVOICE_LABEL} has no verified payment. Submit the payment reference in IT Console.`);
      }
    }
  }
  // Invoice milestones for management — one alert per invoice event (deduped by code).
  if (row.payment_status !== "verified") {
    const { isAmberWindow, isRedWindow } = await import("@/lib/maintenance-rules");
    const day = new Date(now.getTime() + 6 * 3600_000).getUTCDate();
    if (day >= 9 && day < 15) {
      await notifyOnce(`billing_invoice_available_${period}`, "info", "New invoice available", `WINSTONE PULSE : CRM invoice for ${period}: ${amountLabel}. Due ${dhakaTime(row.due_date)}; lock deadline ${dhakaTime(row.lock_at)} (Dhaka).`);
    }
    if (isRedWindow(now) || (!isAmberWindow(now) && day === 13)) {
      await notifyOnce(`billing_due_approaching_${period}`, "warning", "Payment due date approaching", `Invoice ${period} (${amountLabel}) is due ${dhakaTime(row.due_date)}. Payment status: ${row.payment_status}.`);
    }
    if (now.getTime() >= new Date(row.due_date).getTime() + 86_400_000 && day < 15) {
      await notifyOnce(`billing_overdue_${period}`, "critical", "Invoice overdue", `Invoice ${period} (${amountLabel}) is past its due date ${dhakaTime(row.due_date)} and unverified. Lock at ${dhakaTime(row.lock_at)} (Dhaka).`);
    }
  }
  if (result.stage === "due_today") {
    await notifyOnce(`maintenance_lock_24h_${period}`, "warning", "Unpaid lock within 24 hours", `Lock at ${dhakaTime(row.lock_at)} (Dhaka). Payment status: ${row.payment_status}. Invoice ${CRM_INVOICE_LABEL}.`);
  }

  // Upcoming-invoice reminder: once the current month is verified, remind about the
  // next invoice in the 30 days before its due date (one alert per period, deduped).
  if (row.payment_status === "verified") {
    const next = nextPeriod(period);
    const msToDue = new Date(defaultDueAt(next)).getTime() - now.getTime();
    if (msToDue > 0 && msToDue <= 30 * 86_400_000) {
      const preview = nextInvoicePreviewFor(next, await readVatRateBps());
      await notifyOnce(
        `billing_upcoming_invoice_${next}`,
        "info",
        "Upcoming invoice reminder",
        `Next ${CRM_PLAN_NAME} invoice (${preview.totalLabel ?? preview.subtotalLabel}) is due ${dhakaTime(preview.dueAt)} (Dhaka). Pay before the due date to keep access uninterrupted.`,
      );
    }
  }

  const { count } = await client
    .from("maintenance_unlock_requests")
    .select("id", { count: "exact", head: true })
    .eq("plan_code", PLAN_CODE).eq("billing_period", period)
    .eq("status", "requested");

  const state: MaintenanceState = {
    period,
    amountLabel,
    currency: row.currency ?? "USD",
    dueDate: row.due_date,
    lockAt: row.lock_at,
    paymentStatus: row.payment_status,
    paymentRef: row.payment_ref,
    paymentVerifiedAt: row.payment_verified_at,
    paymentVerifiedBy: row.payment_verified_by,
    unlockStatus: row.unlock_status,
    unlockStartedAt: row.unlock_started_at,
    unlockExpiresAt: row.unlock_expires_at,
    approvedBy: row.approved_by,
    approvalReason: row.approval_reason,
    openRequest: (count ?? 0) > 0,
    locked: result.locked,
    stage: result.stage,
    ...(() => {
      const b = billingStates({ now, lockAt: row.lock_at, paymentStatus: row.payment_status, unlockStatus: row.unlock_status, unlockExpiresAt: row.unlock_expires_at, dueAt: row.due_date, rejectedAt: row.payment_rejected_at });
      return { invoiceStatus: b.invoice, paymentState: b.payment, accessStatus: b.access, recoveryPending: b.recoveryPending };
    })(),
    rejectedReason: row.payment_rejected_reason ?? null,
  };
  cache = { at: now.getTime(), state };
  return state;
}

export const LOCKED_MESSAGE =
  "SYSTEM MAINTENANCE LOCKED — the CRM maintenance invoice is not verified. Contact IT Console.";

/** Fail closed: an unexpected error counts as locked for ordinary callers. */
export async function isLockedForOrdinaryUsers(): Promise<boolean> {
  try {
    return (await maintenanceAccess()).locked;
  } catch (error) {
    console.error("maintenance check failed — failing closed for ordinary users", error);
    return true;
  }
}

/* ---------------- Notifications (system_alerts, deduped per code) ---------------- */

export async function notifyOnce(code: string, severity: "info" | "warning" | "critical", title: string, detail: string) {
  const client = await db();
  const { data } = await client.from("system_alerts").select("id").eq("code", code).limit(1).maybeSingle();
  if (data) return false;
  await client.from("system_alerts").insert({ code, severity, title, detail });
  return true;
}

async function notify(code: string, severity: "info" | "warning" | "critical", title: string, detail: string) {
  const client = await db();
  await client.from("system_alerts").insert({ code, severity, title, detail });
}

/* ---------------- IT Console actions (submit only — never verify) ---------------- */

/** IT records a real payment reference; the month becomes PENDING until the System Architect verifies it. */
export async function submitPayment(input: { actor: string; paymentRef: string; note?: string | null }) {
  const state = await maintenanceAccess();
  if (state.paymentStatus === "verified") return { ok: true, already: true };
  // Repeated submission of the same reference is a no-op; a different one while pending is refused (no double payment).
  if (state.paymentStatus === "pending") {
    if (state.paymentRef === input.paymentRef) return { ok: true, already: true };
    throw new Error("A payment reference is already awaiting verification — do not pay again. Withdraw it first to replace it.");
  }
  const client = await db();
  const { error } = await client
    .from("system_maintenance")
    .update({ payment_status: "pending", payment_ref: input.paymentRef, payment_verified_at: null, payment_verified_by: null, payment_rejected_at: null, payment_rejected_reason: null })
    .eq("plan_code", PLAN_CODE).eq("billing_period", state.period);
  if (error) throw new Error("Could not submit payment");
  clearMaintenanceCache();
  await audit({ actor: input.actor, actorRole: "it_console", action: "payment_submitted", period: state.period, previous: state.paymentStatus, next: "pending", reason: input.note ?? null, metadata: { payment_ref: input.paymentRef, amount: state.amountLabel, currency: state.currency } });
  await notifyOnce(`maintenance_payment_submitted_${state.period}_${input.paymentRef}`, "warning", "New payment submitted for verification", `${input.actor} submitted reference ${input.paymentRef} for ${state.period} (${state.amountLabel}). Awaiting System Architect verification.`);
  return { ok: true, already: false };
}

/** IT may withdraw a pending submission (back to unpaid). A verified month can only be changed by the Architect. */
export async function withdrawPayment(input: { actor: string; reason?: string | null }) {
  const state = await maintenanceAccess();
  if (state.paymentStatus === "verified") throw new Error("Verified payment can only be changed by the System Architect");
  const client = await db();
  const { error } = await client
    .from("system_maintenance")
    .update({ payment_status: "unpaid", payment_verified_at: null, payment_verified_by: null })
    .eq("plan_code", PLAN_CODE).eq("billing_period", state.period);
  if (error) throw new Error("Could not update payment status");
  clearMaintenanceCache();
  await audit({ actor: input.actor, actorRole: "it_console", action: "payment_withdrawn", period: state.period, previous: state.paymentStatus, next: "unpaid", reason: input.reason ?? null });
  return { ok: true };
}

/** System Architect (verified Google identity + session) verifies or rejects the pending reference. */
export async function architectReviewPayment(input: { actor: string; approve: boolean; reason: string; expectedRef?: string | null }) {
  const state = await maintenanceAccess();
  const client = await db();
  const { data: row } = await client.from("system_maintenance").select("payment_ref, payment_status, base_cents, vat_cents, total_cents, currency").eq("plan_code", PLAN_CODE).eq("billing_period", state.period).single();
  if (!row || row.payment_status !== "pending" || !row.payment_ref) throw new Error("Already decided — this payment is no longer awaiting review. Refresh to see the latest status.");
  // Stale-view guard: the reviewer must be deciding on the reference they actually saw.
  if (input.expectedRef && input.expectedRef !== row.payment_ref) throw new Error("The submitted reference changed since you opened it — refresh and review again.");
  const at = new Date().toISOString();
  const update = input.approve
    ? { payment_status: "verified" as const, payment_verified_at: at, payment_verified_by: input.actor, lock_status: "active", payment_rejected_at: null, payment_rejected_reason: null }
    : { payment_status: "unpaid" as const, payment_verified_at: null, payment_verified_by: null, payment_rejected_at: at, payment_rejected_reason: input.reason };
  // Compare-and-set: only one concurrent decision can move the row out of "pending".
  const { data: changed, error } = await client.from("system_maintenance").update(update).eq("plan_code", PLAN_CODE).eq("billing_period", state.period).eq("payment_status", "pending").eq("payment_ref", row.payment_ref).select("billing_period");
  if (error) throw new Error("Could not record decision");
  if (!changed || changed.length === 0) throw new Error("Already decided — another review finished first. Refresh to see the latest status.");
  clearMaintenanceCache();
  const { data: openReq } = await client.from("maintenance_unlock_requests").select("id").eq("plan_code", PLAN_CODE).eq("billing_period", state.period).eq("status", "requested").order("requested_at", { ascending: false }).limit(1).maybeSingle();
  await audit({ actor: input.actor, actorRole: "architect", action: input.approve ? "payment_verified" : "payment_rejected", period: state.period, previous: "pending", next: input.approve ? "verified" : "unpaid", reason: input.reason, requestId: openReq?.id ?? null, metadata: { payment_ref: row.payment_ref, amount: state.amountLabel, currency: state.currency, approving_account: input.actor, approved_at: at, unlock_request_id: openReq?.id ?? null } });
  if (input.approve && state.locked) await notifyOnce(`maintenance_restored_${state.period}_paid`, "info", "Workspace access restored", `${state.period} payment verified — access restored.`);
  // Save a permanent receipt for this approval so it can be reopened from payment history.
  let voucher: { no: string; period: string; ref: string; baseCents: number; vatCents: number; totalCents: number; currency: string; verifiedBy: string; at: string } | null = null;
  if (input.approve) {
    const no = `WP-CRM-${state.period.replace(/\D/g, "")}-${Date.now().toString(36).toUpperCase()}`;
    const baseCents = row.base_cents ?? 1579;
    const vatCents = row.vat_cents ?? 237;
    const totalCents = row.total_cents ?? baseCents + vatCents;
    const { error: vErr } = await client.from("payment_vouchers").upsert(
      { voucher_no: no, plan_code: PLAN_CODE, billing_period: state.period, payment_ref: row.payment_ref, base_cents: baseCents, vat_cents: vatCents, total_cents: totalCents, currency: row.currency ?? "USD", verified_by: input.actor, verified_at: at },
      { onConflict: "plan_code,billing_period" },
    );
    if (vErr) console.error("voucher save failed", vErr);
    voucher = { no, period: state.period, ref: row.payment_ref, baseCents, vatCents, totalCents, currency: row.currency ?? "USD", verifiedBy: input.actor, at: dhakaTime(at) };
  }
  await notifyOnce(
    `maintenance_payment_${input.approve ? "verified" : "rejected"}_${state.period}_${row.payment_ref}`,
    input.approve ? "info" : "critical",
    input.approve ? "Maintenance payment verified" : "Maintenance payment rejected",
    `${state.period} reference ${row.payment_ref}: ${input.approve ? "verified — no lock this month" : "rejected"}. Reason: ${input.reason}`,
  );
  return { ok: true, voucher };
}


export async function setLockAt(input: { actor: string; lockAt: string }) {
  const state = await maintenanceAccess();
  const client = await db();
  const { error } = await client
    .from("system_maintenance")
    .update({ lock_at: input.lockAt, locked_logged_at: null })
    .eq("plan_code", PLAN_CODE).eq("billing_period", state.period);
  if (error) throw new Error("Could not change lock time");
  clearMaintenanceCache();
  await audit({ actor: input.actor, actorRole: "it_console", action: "lock_time_changed", period: state.period, previous: state.lockAt, next: input.lockAt });
  return { ok: true };
}

export async function createUnlockRequest(input: { actor: string; hours: number; reason: string | null; paymentRef?: string | null }) {
  const state = await maintenanceAccess();
  const client = await db();
  const { data, error } = await client
    .from("maintenance_unlock_requests")
    .insert({
      billing_period: state.period,
      plan_code: PLAN_CODE,
      requested_by: input.actor,
      requested_hours: input.hours,
      reason: input.reason,
      payment_status_at_request: state.paymentStatus,
      payment_verified_at_request: state.paymentVerifiedAt,
    })
    .select("id")
    .single();
  if (error) {
    if (error.code === "23505") throw new Error("An unlock request is already waiting for the System Architect");
    throw new Error("Could not create unlock request");
  }
  await client.from("system_maintenance").update({ unlock_status: "requested" }).eq("plan_code", PLAN_CODE).eq("billing_period", state.period).neq("unlock_status", "approved");
  clearMaintenanceCache();
  await audit({ actor: input.actor, actorRole: "it_console", action: "unlock_requested", period: state.period, next: "requested", reason: input.reason, requestId: data.id, durationMinutes: input.hours * 60, metadata: { payment_status: state.paymentStatus } });
  const { sendUnlockApprovalEmail } = await import("@/lib/unlock-email.server");
  const mail = await sendUnlockApprovalEmail({ requestId: data.id, requestedBy: input.actor, hours: input.hours, reason: input.reason, paymentVerified: state.paymentStatus === "verified", paymentRef: input.paymentRef ?? state.paymentRef ?? null });
  return { ok: true, requestId: data.id, paymentVerified: state.paymentStatus === "verified", emailed: mail.emailed };
}

export async function maintenanceHistory() {
  const client = await db();
  const [{ data: periods }, { data: requests }, { data: log }, { data: vouchers }] = await Promise.all([
    client.from("system_maintenance").select("billing_period, fee_usd, fee_bdt, payment_status, payment_ref, payment_verified_at, payment_verified_by, payment_rejected_at, payment_rejected_reason, base_cents, vat_cents, total_cents, currency, due_date, lock_at, unlock_status, unlock_expires_at").eq("plan_code", PLAN_CODE).order("billing_period", { ascending: false }).limit(24),
    client.from("maintenance_unlock_requests").select("*").eq("plan_code", PLAN_CODE).order("requested_at", { ascending: false }).limit(50),
    client.from("maintenance_audit").select("id, at, actor, actor_role, action, billing_period, previous_state, new_state, reason, request_id, duration_minutes, expires_at, metadata").order("at", { ascending: false }).limit(200),
    client.from("payment_vouchers").select("voucher_no, billing_period, payment_ref, base_cents, vat_cents, total_cents, currency, verified_by, verified_at").eq("plan_code", PLAN_CODE).order("verified_at", { ascending: false }).limit(50),
  ]);
  return {
    periods: periods ?? [],
    requests: requests ?? [],
    audit: log ?? [],
    vouchers: (vouchers ?? []).map((v) => ({ no: v.voucher_no, period: v.billing_period, ref: v.payment_ref, baseCents: v.base_cents, vatCents: v.vat_cents, totalCents: v.total_cents, currency: v.currency, verifiedBy: v.verified_by, at: dhakaTime(v.verified_at) })),
  };
}

/* ---------------- System Architect ---------------- */

function sha(value: string) {
  return createHash("sha256").update(value, "utf8").digest();
}

/** Reads the Google identity of the current request from the auth server, never from input. */
export async function architectFromRequest(): Promise<{ userId: string; email: string } | null> {
  const { getRequest } = await import("@tanstack/react-start/server");
  const header = getRequest()?.headers?.get("authorization") ?? "";
  if (!header.startsWith("Bearer ")) return null;
  const token = header.slice(7).trim();
  if (token.split(".").length !== 3) return null;
  const client = await db();
  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user) return null;
  const user = data.user;
  const providers = [
    ...((user.app_metadata?.["providers"] as string[] | undefined) ?? []),
    ...(user.identities ?? []).map((identity) => identity.provider),
  ];
  const ok = isArchitectIdentity({
    email: user.email ?? null,
    emailConfirmed: Boolean(user.email_confirmed_at),
    providers,
  });
  return ok ? { userId: user.id, email: (user.email ?? "").toLowerCase() } : null;
}

export async function signedInEmail(): Promise<string | null> {
  const { getRequest } = await import("@tanstack/react-start/server");
  const header = getRequest()?.headers?.get("authorization") ?? "";
  if (!header.startsWith("Bearer ")) return null;
  const client = await db();
  const { data } = await client.auth.getUser(header.slice(7).trim());
  return data.user?.email ?? null;
}

const FAIL_LIMIT = 5;
const FAIL_WINDOW_MS = 15 * 60 * 1000;
const SESSION_MS = 30 * 60 * 1000;

export async function recentFailures(now = Date.now()): Promise<number> {
  const client = await db();
  const { count } = await client
    .from("architect_auth_attempts")
    .select("id", { count: "exact", head: true })
    .eq("success", false)
    .gte("at", new Date(now - FAIL_WINDOW_MS).toISOString());
  return count ?? 0;
}

export function credentialMatches(input: string): boolean {
  const expected = process.env["ARCHITECT_UNLOCK_CREDENTIAL"];
  if (!expected) throw new Error("Architect credential is not configured");
  return timingSafeEqual(sha(input), sha(expected));
}

function sessionSecret() {
  const secret = process.env["ADMIN_TOKEN_SECRET"];
  if (!secret) throw new Error("Session secret is not configured");
  return secret;
}

export function mintArchitectSession(userId: string, now = Date.now()): string {
  const exp = now + SESSION_MS;
  const sig = createHmac("sha256", sessionSecret()).update(`architect:v1:${userId}:${exp}`).digest("hex");
  return `${userId}.${exp}.${sig}`;
}

export function architectSessionValid(token: string | null | undefined, userId: string, now = Date.now()): boolean {
  if (!token) return false;
  const [id, expRaw, sig] = token.split(".");
  const exp = Number(expRaw);
  if (!id || !sig || id !== userId || !Number.isFinite(exp) || exp <= now) return false;
  const expected = createHmac("sha256", sessionSecret()).update(`architect:v1:${id}:${exp}`).digest("hex");
  return sig.length === expected.length && timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
}

export async function logAttempt(email: string | null, success: boolean, stage: string) {
  const client = await db();
  const { getRequest } = await import("@tanstack/react-start/server");
  const ip = getRequest()?.headers?.get("cf-connecting-ip") ?? null;
  await client.from("architect_auth_attempts").insert({ email, success, stage, ip });
  await audit({
    actor: email ?? "unknown",
    actorRole: "system_architect",
    action: success ? "architect_credential_success" : `architect_${stage}_failure`,
    metadata: { ip },
  });
}

export async function architectDecide(input: {
  actor: string;
  requestId: string;
  approve: boolean;
  minutes?: number;
  reason: string | null;
}) {
  const client = await db();
  const { data: request } = await client
    .from("maintenance_unlock_requests")
    .select("*")
    .eq("id", input.requestId)
    .maybeSingle();
  // Entitlements are independent: this app only decides its own plan's requests.
  if (!request || request.plan_code !== PLAN_CODE) throw new Error("Request not found");
  if (request.status !== "requested") throw new Error("This request has already been decided");
  const now = new Date();

  if (!input.approve) {
    if (!input.reason || input.reason.trim().length < 3) throw new Error("A denial reason is required");
    await client
      .from("maintenance_unlock_requests")
      .update({ status: "denied", decided_at: now.toISOString(), decided_by: input.actor, decision_reason: input.reason })
      .eq("id", request.id)
      .eq("status", "requested");
    await client.from("system_maintenance").update({ unlock_status: "denied" }).eq("plan_code", PLAN_CODE).eq("billing_period", request.billing_period).neq("unlock_status", "approved");
    clearMaintenanceCache();
    await audit({ actor: input.actor, actorRole: "system_architect", action: "unlock_denied", period: request.billing_period, previous: "requested", next: "denied", reason: input.reason, requestId: request.id });
    return { ok: true, status: "denied" as const };
  }

  const minutes = clampUnlockMinutes(input.minutes ?? 0);
  const expires = new Date(now.getTime() + minutes * 60_000).toISOString();
  const { data: done } = await client
    .from("maintenance_unlock_requests")
    .update({
      status: "approved",
      decided_at: now.toISOString(),
      decided_by: input.actor,
      decision_reason: input.reason,
      duration_minutes: minutes,
      unlock_started_at: now.toISOString(),
      unlock_expires_at: expires,
    })
    .eq("id", request.id)
    .eq("status", "requested")
    .select("id")
    .maybeSingle();
  if (!done) throw new Error("This request has already been decided");
  await client
    .from("system_maintenance")
    .update({
      unlock_status: "approved",
      unlock_started_at: now.toISOString(),
      unlock_expires_at: expires,
      approved_by: "System Architect",
      approval_reason: input.reason,
      lock_status: "active",
    })
    .eq("plan_code", PLAN_CODE).eq("billing_period", request.billing_period);
  clearMaintenanceCache();
  const { data: payRow } = await client.from("system_maintenance").select("payment_ref, payment_status").eq("plan_code", PLAN_CODE).eq("billing_period", request.billing_period).maybeSingle();
  await audit({ actor: input.actor, actorRole: "system_architect", action: "unlock_approved", period: request.billing_period, previous: "locked", next: "active", reason: input.reason, requestId: request.id, durationMinutes: minutes, expiresAt: expires, metadata: { approving_account: input.actor, approved_at: now.toISOString(), unlock_request_id: request.id, payment_ref: payRow?.payment_ref ?? null, payment_status: payRow?.payment_status ?? null } });
  await notifyOnce(`maintenance_restored_${request.billing_period}_${request.id}`, "info", "Workspace access restored", `Access restored for ${request.billing_period} by System Architect until ${dhakaTime(expires)} (Dhaka).`);
  return { ok: true, status: "approved" as const, expiresAt: expires };
}
