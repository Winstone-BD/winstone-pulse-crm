/**
 * Monthly service bill for the Winstone Pulse (৳4,000 per period).
 *
 * One row per calendar period in public.service_invoices. The whole chain —
 * invoice raised, payment verified, service activated, ৳3,000 / ৳1,000 split,
 * ৳1,000 architect payout — is idempotent: every step checks the stored state
 * first, so a repeated verification or payout call can never double-charge,
 * double-activate or double-pay. Each step appends one audit row.
 *
 * No card numbers, CVV, OTP or passwords are stored anywhere. The architect
 * bank account number lives in system_settings (service-role only) and is
 * exposed to any UI as the last four digits only.
 */

import { logAudit } from "@/lib/audit.server";

export const MONTHLY_AMOUNT_BDT = 4000;
export const SYSTEM_SHARE_BDT = 3000;
export const ARCHITECT_SHARE_BDT = 1000;
/** Days after the due date before an unpaid invoice becomes overdue. */
export const GRACE_DAYS = 3;

export type InvoiceStatus = "due" | "verifying" | "paid" | "overdue" | "failed";

export type ServiceInvoice = {
  period: string;
  amountBdt: number;
  status: InvoiceStatus;
  dueAt: string;
  graceUntil: string;
  paidAt: string | null;
  verifiedAt: string | null;
  verifiedByLabel: string | null;
  paymentRef: string | null;
  paymentMethod: string | null;
  serviceActiveUntil: string | null;
  systemShareBdt: number;
  architectShareBdt: number;
  splitAt: string | null;
  payoutStatus: string;
  payoutAt: string | null;
  payoutRef: string | null;
  note: string | null;
};

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

/** Current period in Dhaka time, e.g. "2026-09". */
export function dhakaPeriod(now = new Date()): string {
  const dhaka = new Date(now.getTime() + 6 * 60 * 60 * 1000);
  return `${dhaka.getUTCFullYear()}-${String(dhaka.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** The 15th of the period at 00:00 Dhaka, stored in UTC. */
export function dueAtFor(period: string): string {
  return `${period}-14T18:00:00.000Z`;
}

export function graceUntilFor(period: string): string {
  const due = new Date(dueAtFor(period));
  due.setUTCDate(due.getUTCDate() + GRACE_DAYS);
  return due.toISOString();
}

export function nextPeriod(period: string): string {
  const [year, month] = period.split("-").map((part) => Number(part));
  if (!year || !month) return period;
  return month === 12
    ? `${year + 1}-01`
    : `${year}-${String(month + 1).padStart(2, "0")}`;
}

type Row = Record<string, unknown>;

function shape(row: Row): ServiceInvoice {
  return {
    period: String(row["period"]),
    amountBdt: Number(row["amount_bdt"] ?? 0),
    status: String(row["status"] ?? "due") as InvoiceStatus,
    dueAt: String(row["due_at"]),
    graceUntil: String(row["grace_until"]),
    paidAt: (row["paid_at"] as string | null) ?? null,
    verifiedAt: (row["verified_at"] as string | null) ?? null,
    verifiedByLabel: (row["verified_by_label"] as string | null) ?? null,
    paymentRef: (row["payment_ref"] as string | null) ?? null,
    paymentMethod: (row["payment_method"] as string | null) ?? null,
    serviceActiveUntil: (row["service_active_until"] as string | null) ?? null,
    systemShareBdt: Number(row["system_share_bdt"] ?? SYSTEM_SHARE_BDT),
    architectShareBdt: Number(row["architect_share_bdt"] ?? ARCHITECT_SHARE_BDT),
    splitAt: (row["split_at"] as string | null) ?? null,
    payoutStatus: String(row["payout_status"] ?? "pending"),
    payoutAt: (row["payout_at"] as string | null) ?? null,
    payoutRef: (row["payout_ref"] as string | null) ?? null,
    note: (row["note"] as string | null) ?? null,
  };
}

/** Raises the invoice for a period once; returns the stored row either way. */
export async function ensureInvoice(period: string): Promise<ServiceInvoice> {
  const supabaseAdmin = await admin();
  const existing = await supabaseAdmin
    .from("service_invoices")
    .select("*")
    .eq("period", period)
    .maybeSingle();
  if (existing.data) return shape(existing.data as Row);

  const { data, error } = await supabaseAdmin
    .from("service_invoices")
    .insert({
      period,
      amount_bdt: MONTHLY_AMOUNT_BDT,
      status: "due",
      due_at: dueAtFor(period),
      grace_until: graceUntilFor(period),
      system_share_bdt: SYSTEM_SHARE_BDT,
      architect_share_bdt: ARCHITECT_SHARE_BDT,
    })
    .select("*")
    .single();
  if (error || !data) {
    const retry = await supabaseAdmin
      .from("service_invoices")
      .select("*")
      .eq("period", period)
      .maybeSingle();
    if (retry.data) return shape(retry.data as Row);
    throw new Error(error?.message ?? "could not raise the service invoice");
  }
  await logAudit({
    action: "service_invoice_raised",
    entityType: "service_invoice",
    entityId: period,
    metadata: { amountBdt: MONTHLY_AMOUNT_BDT, dueAt: dueAtFor(period) },
  });
  return shape(data as Row);
}

/** Flips still-unpaid invoices to overdue once their grace window has closed. */
export async function refreshOverdue(): Promise<number> {
  const supabaseAdmin = await admin();
  const { data } = await supabaseAdmin
    .from("service_invoices")
    .update({ status: "overdue" })
    .in("status", ["due", "verifying"])
    .lt("grace_until", new Date().toISOString())
    .select("period");
  return (data ?? []).length;
}

/** Invoice history, newest period first, with the current period always present. */
export async function invoiceHistory(): Promise<ServiceInvoice[]> {
  await ensureInvoice(dhakaPeriod());
  await refreshOverdue();
  const supabaseAdmin = await admin();
  const { data } = await supabaseAdmin
    .from("service_invoices")
    .select("*")
    .order("period", { ascending: false })
    .limit(36);
  return (data ?? []).map((row) => shape(row as Row));
}

export type BillingState = {
  invoices: ServiceInvoice[];
  current: ServiceInvoice | null;
  /** True while a paid invoice still covers today. */
  serviceActive: boolean;
  serviceActiveUntil: string | null;
  monthlyAmountBdt: number;
};

export async function billingState(): Promise<BillingState> {
  const invoices = await invoiceHistory();
  const current = invoices.find((row) => row.period === dhakaPeriod()) ?? invoices[0] ?? null;
  const covered = invoices
    .filter((row) => row.status === "paid" && row.serviceActiveUntil)
    .map((row) => row.serviceActiveUntil as string)
    .sort()
    .at(-1) ?? null;
  return {
    invoices,
    current,
    serviceActive: Boolean(covered && new Date(covered).getTime() > Date.now()),
    serviceActiveUntil: covered,
    monthlyAmountBdt: MONTHLY_AMOUNT_BDT,
  };
}

/** Architect payout destination — account number is never returned in full. */
export async function architectAccount(): Promise<{
  name: string;
  bank: string;
  branch: string;
  currency: string;
  accountLast4: string | null;
}> {
  const supabaseAdmin = await admin();
  const { data } = await supabaseAdmin
    .from("system_settings")
    .select("value")
    .eq("key", "architect_payout")
    .maybeSingle();
  const stored = (data?.value ?? {}) as Record<string, unknown>;
  const account = typeof stored["account_number"] === "string" ? stored["account_number"] : "";
  return {
    name: String(stored["name"] ?? "ZAHID HASAN EMON"),
    bank: String(stored["bank"] ?? "IFIC Bank"),
    branch: String(stored["branch"] ?? "Savar Bazar Branch"),
    currency: String(stored["currency"] ?? "BDT"),
    accountLast4: account ? account.slice(-4) : null,
  };
}

export type VerifyResult = {
  invoice: ServiceInvoice;
  alreadyVerified: boolean;
};

/**
 * Verifies a received payment once. Verification, activation and the share
 * split all happen in this single transition, so calling it twice for the same
 * period returns the stored invoice with alreadyVerified = true and changes
 * nothing.
 */
export async function verifyServicePayment(input: {
  period: string;
  amountBdt?: number;
  paymentRef: string;
  paymentMethod?: string | null;
  note?: string | null;
  actorProfileId?: string | null;
  actorLabel?: string | null;
}): Promise<VerifyResult> {
  const invoice = await ensureInvoice(input.period);
  if (invoice.status === "paid") return { invoice, alreadyVerified: true };

  const now = new Date().toISOString();
  const activeUntil = dueAtFor(nextPeriod(input.period));
  const supabaseAdmin = await admin();
  const { data, error } = await supabaseAdmin
    .from("service_invoices")
    .update({
      status: "paid",
      amount_bdt: input.amountBdt ?? invoice.amountBdt,
      paid_at: now,
      verified_at: now,
      verified_by: input.actorProfileId ?? null,
      verified_by_label: input.actorLabel ?? "IT Console",
      payment_ref: input.paymentRef,
      payment_method: input.paymentMethod ?? null,
      service_active_until: activeUntil,
      system_share_bdt: SYSTEM_SHARE_BDT,
      architect_share_bdt: ARCHITECT_SHARE_BDT,
      split_at: now,
      note: input.note ?? invoice.note,
    })
    .eq("period", input.period)
    .neq("status", "paid")
    .select("*")
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) {
    // Another verification landed first — read it back, never pay twice.
    const stored = await ensureInvoice(input.period);
    return { invoice: stored, alreadyVerified: true };
  }

  await logAudit({
    action: "service_payment_verified",
    entityType: "service_invoice",
    entityId: input.period,
    actorProfileId: input.actorProfileId ?? null,
    actorLabel: input.actorLabel ?? "IT Console",
    metadata: {
      amountBdt: input.amountBdt ?? invoice.amountBdt,
      paymentRef: input.paymentRef,
      systemShareBdt: SYSTEM_SHARE_BDT,
      architectShareBdt: ARCHITECT_SHARE_BDT,
      serviceActiveUntil: activeUntil,
    },
  });
  // The next period's invoice is raised as soon as this one is settled.
  await ensureInvoice(nextPeriod(input.period));
  return { invoice: shape(data as Row), alreadyVerified: false };
}

/** Records the ৳1,000 architect payout once for a paid invoice. */
export async function recordArchitectPayout(input: {
  period: string;
  payoutRef: string;
  actorProfileId?: string | null;
  actorLabel?: string | null;
}): Promise<{ invoice: ServiceInvoice; alreadyPaid: boolean }> {
  const invoice = await ensureInvoice(input.period);
  if (invoice.status !== "paid") {
    throw new Error("এই মাসের পেমেন্ট যাচাই হওয়ার আগে পেআউট নথিভুক্ত করা যাবে না");
  }
  if (invoice.payoutStatus === "paid") return { invoice, alreadyPaid: true };

  const supabaseAdmin = await admin();
  const { data, error } = await supabaseAdmin
    .from("service_invoices")
    .update({
      payout_status: "paid",
      payout_at: new Date().toISOString(),
      payout_ref: input.payoutRef,
    })
    .eq("period", input.period)
    .neq("payout_status", "paid")
    .select("*")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return { invoice: await ensureInvoice(input.period), alreadyPaid: true };

  await logAudit({
    action: "service_payout_recorded",
    entityType: "service_invoice",
    entityId: input.period,
    actorProfileId: input.actorProfileId ?? null,
    actorLabel: input.actorLabel ?? "IT Console",
    metadata: { architectShareBdt: ARCHITECT_SHARE_BDT, payoutRef: input.payoutRef },
  });
  return { invoice: shape(data as Row), alreadyPaid: false };
}
