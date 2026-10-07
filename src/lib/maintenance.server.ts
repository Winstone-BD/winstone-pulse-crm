import { createHmac, createHash, timingSafeEqual } from "node:crypto";

import {
  MAINTENANCE_FEE_USD,
  clampUnlockMinutes,
  decide,
  defaultLockAt,
  dhakaTime,
  dhakaPeriod,
  isArchitectIdentity,
  type PaymentStatus,
  type Stage,
  type UnlockStatus,
} from "@/lib/maintenance-rules";

export type MaintenanceState = {
  period: string;
  feeUsd: number;
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

let cache: { at: number; state: MaintenanceState } | null = null;
export function clearMaintenanceCache() {
  cache = null;
}

async function ensureRow(period: string) {
  const client = await db();
  const { data } = await client
    .from("system_maintenance")
    .select("*")
    .eq("billing_period", period)
    .maybeSingle();
  if (data) return data;
  const lockAt = defaultLockAt(period);
  await client.from("system_maintenance").upsert(
    { billing_period: period, fee_usd: MAINTENANCE_FEE_USD, due_date: lockAt, lock_at: lockAt },
    { onConflict: "billing_period", ignoreDuplicates: true },
  );
  const { data: row, error } = await client
    .from("system_maintenance")
    .select("*")
    .eq("billing_period", period)
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
      await notifyOnce(`maintenance_locked_${period}`, "critical", "System locked — maintenance unpaid", `CRM locked at ${dhakaTime(row.lock_at)} (Dhaka). Payment status: ${row.payment_status}. Submit the payment reference in IT Console.`);
    }
  }
  if (result.stage === "due_today") {
    await notifyOnce(`maintenance_lock_24h_${period}`, "warning", "Unpaid lock within 24 hours", `Lock at ${dhakaTime(row.lock_at)} (Dhaka). Payment status: ${row.payment_status}. Fee $46.29 USD.`);
  }

  const { count } = await client
    .from("maintenance_unlock_requests")
    .select("id", { count: "exact", head: true })
    .eq("billing_period", period)
    .eq("status", "requested");

  const state: MaintenanceState = {
    period,
    feeUsd: Number(row.fee_usd),
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
  };
  cache = { at: now.getTime(), state };
  return state;
}

export const LOCKED_MESSAGE =
  "SYSTEM MAINTENANCE LOCKED — monthly maintenance payment ($46.29 USD) is pending. Contact IT Console.";

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
  const client = await db();
  const { error } = await client
    .from("system_maintenance")
    .update({ payment_status: "pending", payment_ref: input.paymentRef, payment_verified_at: null, payment_verified_by: null })
    .eq("billing_period", state.period);
  if (error) throw new Error("Could not submit payment");
  clearMaintenanceCache();
  await audit({ actor: input.actor, actorRole: "it_console", action: "payment_submitted", period: state.period, previous: state.paymentStatus, next: "pending", reason: input.note ?? null, metadata: { payment_ref: input.paymentRef, fee_usd: state.feeUsd } });
  await notify(`maintenance_payment_submitted_${state.period}_${Date.now()}`, "warning", "New payment submitted for verification", `${input.actor} submitted reference ${input.paymentRef} for ${state.period} ($46.29 USD). Awaiting System Architect verification.`);
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
    .eq("billing_period", state.period);
  if (error) throw new Error("Could not update payment status");
  clearMaintenanceCache();
  await audit({ actor: input.actor, actorRole: "it_console", action: "payment_withdrawn", period: state.period, previous: state.paymentStatus, next: "unpaid", reason: input.reason ?? null });
  return { ok: true };
}

/** System Architect (verified Google identity + session) verifies or rejects the pending reference. */
export async function architectReviewPayment(input: { actor: string; approve: boolean; reason: string }) {
  const state = await maintenanceAccess();
  const client = await db();
  const { data: row } = await client.from("system_maintenance").select("payment_ref, payment_status").eq("billing_period", state.period).single();
  if (!row || row.payment_status !== "pending" || !row.payment_ref) throw new Error("No submitted payment to review");
  const at = new Date().toISOString();
  const update = input.approve
    ? { payment_status: "verified" as const, payment_verified_at: at, payment_verified_by: input.actor, lock_status: "active" }
    : { payment_status: "unpaid" as const, payment_verified_at: null, payment_verified_by: null };
  const { error } = await client.from("system_maintenance").update(update).eq("billing_period", state.period).eq("payment_status", "pending");
  if (error) throw new Error("Could not record decision");
  clearMaintenanceCache();
  await audit({ actor: input.actor, actorRole: "architect", action: input.approve ? "payment_verified" : "payment_rejected", period: state.period, previous: "pending", next: input.approve ? "verified" : "unpaid", reason: input.reason, metadata: { payment_ref: row.payment_ref, fee_usd: state.feeUsd } });
  await notify(
    `maintenance_payment_${input.approve ? "verified" : "rejected"}_${state.period}_${Date.now()}`,
    input.approve ? "info" : "critical",
    input.approve ? "Maintenance payment verified" : "Maintenance payment rejected",
    `${state.period} reference ${row.payment_ref}: ${input.approve ? "verified — no lock this month" : "rejected"}. Reason: ${input.reason}`,
  );
  return { ok: true };
}


export async function setLockAt(input: { actor: string; lockAt: string }) {
  const state = await maintenanceAccess();
  const client = await db();
  const { error } = await client
    .from("system_maintenance")
    .update({ lock_at: input.lockAt, locked_logged_at: null })
    .eq("billing_period", state.period);
  if (error) throw new Error("Could not change lock time");
  clearMaintenanceCache();
  await audit({ actor: input.actor, actorRole: "it_console", action: "lock_time_changed", period: state.period, previous: state.lockAt, next: input.lockAt });
  return { ok: true };
}

export async function createUnlockRequest(input: { actor: string; hours: number; reason: string | null }) {
  const state = await maintenanceAccess();
  const client = await db();
  const { data, error } = await client
    .from("maintenance_unlock_requests")
    .insert({
      billing_period: state.period,
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
  await client.from("system_maintenance").update({ unlock_status: "requested" }).eq("billing_period", state.period).neq("unlock_status", "approved");
  clearMaintenanceCache();
  await audit({ actor: input.actor, actorRole: "it_console", action: "unlock_requested", period: state.period, next: "requested", reason: input.reason, requestId: data.id, durationMinutes: input.hours * 60, metadata: { payment_status: state.paymentStatus } });
  return { ok: true, requestId: data.id, paymentVerified: state.paymentStatus === "verified" };
}

export async function maintenanceHistory() {
  const client = await db();
  const [{ data: periods }, { data: requests }, { data: log }] = await Promise.all([
    client.from("system_maintenance").select("billing_period, fee_usd, payment_status, payment_ref, payment_verified_at, payment_verified_by, lock_at, unlock_status, unlock_expires_at").order("billing_period", { ascending: false }).limit(24),
    client.from("maintenance_unlock_requests").select("*").order("requested_at", { ascending: false }).limit(50),
    client.from("maintenance_audit").select("id, at, actor, actor_role, action, billing_period, previous_state, new_state, reason, request_id, duration_minutes, expires_at, metadata").order("at", { ascending: false }).limit(200),
  ]);
  return { periods: periods ?? [], requests: requests ?? [], audit: log ?? [] };
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
  if (!request) throw new Error("Request not found");
  if (request.status !== "requested") throw new Error("This request has already been decided");
  const now = new Date();

  if (!input.approve) {
    if (!input.reason || input.reason.trim().length < 3) throw new Error("A denial reason is required");
    await client
      .from("maintenance_unlock_requests")
      .update({ status: "denied", decided_at: now.toISOString(), decided_by: input.actor, decision_reason: input.reason })
      .eq("id", request.id)
      .eq("status", "requested");
    await client.from("system_maintenance").update({ unlock_status: "denied" }).eq("billing_period", request.billing_period).neq("unlock_status", "approved");
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
    .eq("billing_period", request.billing_period);
  clearMaintenanceCache();
  await audit({ actor: input.actor, actorRole: "system_architect", action: "unlock_approved", period: request.billing_period, previous: "locked", next: "active", reason: input.reason, requestId: request.id, durationMinutes: minutes, expiresAt: expires });
  return { ok: true, status: "approved" as const, expiresAt: expires };
}
