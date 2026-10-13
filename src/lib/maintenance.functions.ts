import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/**
 * CRM maintenance invoice endpoints ($35.29 USD from 2026-11; older invoices keep their stored amount). The lock itself is decided in
 * maintenance.server.ts; these functions only read it or move it through the
 * IT Console → System Architect workflow.
 */

const Token = z.object({ adminToken: z.string().nullable().optional() });

async function itCaller(adminToken: string | null | undefined) {
  const { resolveCaller } = await import("@/lib/access.server");
  const caller = await resolveCaller(adminToken ?? null, { skipMaintenance: true });
  if (caller.scope !== "authority" || caller.readOnly) throw new Error("IT Console access required");
  return { caller, label: caller.profile?.name ?? "IT Console" };
}

/** Public-safe status for badges, banners and the lock screen. */
export const getMaintenanceStatus = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => Token.parse(input ?? {}))
  .handler(async ({ data }) => {
    const { maintenanceAccess } = await import("@/lib/maintenance.server");
    const { adminTokenScope } = await import("@/lib/admin-gate.server");
    let exempt = adminTokenScope(data.adminToken ?? null) === "full";
    try {
      const s = await maintenanceAccess();
      if (!exempt) {
        const { resolveCaller } = await import("@/lib/access.server");
        const c = await resolveCaller(data.adminToken ?? null, { skipMaintenance: true });
        exempt = c.scope === "authority" && !c.readOnly;
      }
      return {
        ok: true as const,
        period: s.period,
        amountLabel: s.amountLabel,
        currency: s.currency,
        dueDate: s.dueDate,
        lockAt: s.lockAt,
        paymentStatus: s.paymentStatus,
        unlockStatus: s.unlockStatus,
        unlockExpiresAt: s.unlockExpiresAt,
        openRequest: s.openRequest,
        locked: s.locked,
        stage: s.stage,
        invoiceStatus: s.invoiceStatus,
        paymentState: s.paymentState,
        accessStatus: s.accessStatus,
        recoveryPending: s.recoveryPending,
        rejectedReason: s.rejectedReason,
        exempt,
      };
    } catch (error) {
      console.error("maintenance status failed", error);
      return { ok: false as const, locked: true, stage: "locked" as const, exempt, amountLabel: "—", currency: "USD", paymentStatus: "unpaid" as const, invoiceStatus: "OPEN" as const, paymentState: "UNPAID" as const, accessStatus: "LOCKED" as const, recoveryPending: false, rejectedReason: null as string | null, unlockStatus: "none" as const, openRequest: false, period: "", dueDate: "", lockAt: "", unlockExpiresAt: null };
    }
  });

/** Agent / Executive "Payment / Unlock request": only notifies IT Console. */
export const requestPaymentHelp = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => Token.extend({ note: z.string().trim().max(300).optional() }).parse(input))
  .handler(async ({ data }) => {
    const { resolveCaller } = await import("@/lib/access.server");
    const caller = await resolveCaller(data.adminToken ?? null, { skipMaintenance: true });
    const { adminTokenScope } = await import("@/lib/admin-gate.server");
    const hq = adminTokenScope(data.adminToken ?? null) === "hq";
    if (!caller.profile && !hq) throw new Error("Please sign in first");
    const { audit, maintenanceAccess } = await import("@/lib/maintenance.server");
    const state = await maintenanceAccess();
    await audit({
      actor: caller.profile?.name ?? "Executive HQ",
      actorRole: hq ? "executive" : caller.profile?.role ?? "agent",
      action: "payment_help_requested",
      period: state.period,
      reason: data.note ?? null,
    });
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("system_alerts").insert({
      code: "maintenance_payment_help",
      severity: "critical",
      title: "Maintenance payment / unlock requested",
      detail: `${caller.profile?.name ?? "Executive HQ"} asked IT Console to settle the ${state.period} CRM invoice (${state.amountLabel}).`,
    });
    return { ok: true };
  });

export const itMaintenance = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => Token.parse(input))
  .handler(async ({ data }) => {
    await itCaller(data.adminToken);
    const { maintenanceAccess, maintenanceHistory } = await import("@/lib/maintenance.server");
    const [state, history] = await Promise.all([maintenanceAccess(), maintenanceHistory()]);
    return { state, ...history };
  });

/** IT Console only: read-only preview of the next invoice before it is generated. No writes. */
export const nextMaintenanceInvoicePreview = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => Token.parse(input))
  .handler(async ({ data }) => {
    await itCaller(data.adminToken);
    const { previewNextInvoice } = await import("@/lib/maintenance.server");
    return previewNextInvoice();
  });

/**
 * Read-only "Billing & Approvals" summary for the IT Console. canApprove is
 * derived on the server from the confirmed Google architect identity — it only
 * decides what to show; every decision still needs the /tech PIN session.
 */
export const billingApprovalSummary = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => Token.parse(input ?? {}))
  .handler(async ({ data }) => {
    await itCaller(data.adminToken);
    const m = await import("@/lib/maintenance.server");
    const [state, history, who] = await Promise.all([m.maintenanceAccess(), m.maintenanceHistory(), m.architectFromRequest()]);
    const openRequests = history.requests
      .filter((r) => r.status === "requested" && r.billing_period === state.period)
      .map((r) => ({ id: r.id as string, hours: r.requested_hours as number, reason: (r.reason as string | null) ?? null, requestedBy: r.requested_by as string, requestedAt: r.requested_at as string }));
    return {
      period: state.period,
      amountLabel: state.amountLabel,
      currency: state.currency,
      dueDate: state.dueDate,
      lockAt: state.lockAt,
      paymentStatus: state.paymentStatus,
      paymentRef: state.paymentRef,
      unlockStatus: state.unlockStatus,
      unlockExpiresAt: state.unlockExpiresAt,
      locked: state.locked,
      rejectedReason: state.rejectedReason,
      openRequests,
      canApprove: who !== null,
    };
  });

/** IT submits a real reference only; verification belongs to the System Architect. */
export const submitMaintenancePayment = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    Token.extend({ paymentRef: z.string().trim().min(3).max(120), note: z.string().trim().max(300).optional() }).parse(input),
  )
  .handler(async ({ data }) => {
    const { label } = await itCaller(data.adminToken);
    const { submitPayment } = await import("@/lib/maintenance.server");
    return submitPayment({ actor: label, paymentRef: data.paymentRef, note: data.note ?? null });
  });

export const withdrawMaintenancePayment = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => Token.extend({ reason: z.string().trim().max(300).optional() }).parse(input))
  .handler(async ({ data }) => {
    const { label } = await itCaller(data.adminToken);
    const { withdrawPayment } = await import("@/lib/maintenance.server");
    return withdrawPayment({ actor: label, reason: data.reason ?? null });
  });

export const setMaintenanceLockAt = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => Token.extend({ lockAt: z.string().datetime() }).parse(input))
  .handler(async ({ data }) => {
    const { label } = await itCaller(data.adminToken);
    const { setLockAt } = await import("@/lib/maintenance.server");
    return setLockAt({ actor: label, lockAt: new Date(data.lockAt).toISOString() });
  });

export const requestSystemUnlock = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    Token.extend({ hours: z.number().int().min(1).max(24), reason: z.string().trim().max(300).optional() }).parse(input),
  )
  .handler(async ({ data }) => {
    const { label } = await itCaller(data.adminToken);
    const { createUnlockRequest } = await import("@/lib/maintenance.server");
    return createUnlockRequest({ actor: label, hours: data.hours, reason: data.reason ?? null });
  });

/** One form: record the real payment reference, then open an unlock request that emails the approver. */
export const submitReferenceAndRequestUnlock = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    Token.extend({
      paymentRef: z.string().trim().min(3).max(120),
      hours: z.number().int().min(1).max(24),
      reason: z.string().trim().max(300).optional(),
    }).parse(input),
  )
  .handler(async ({ data }) => {
    const { label } = await itCaller(data.adminToken);
    const { submitPayment, createUnlockRequest } = await import("@/lib/maintenance.server");
    await submitPayment({ actor: label, paymentRef: data.paymentRef, note: data.reason ?? null });
    return createUnlockRequest({ actor: label, hours: data.hours, reason: data.reason ?? null, paymentRef: data.paymentRef });
  });

/* ---------------- System Architect ---------------- */

/** Step 1: is the signed-in Google account the authorised architect? */
export const architectIdentity = createServerFn({ method: "POST" }).handler(async () => {
  const { architectFromRequest, signedInEmail, logAttempt } = await import("@/lib/maintenance.server");
  const who = await architectFromRequest();
  if (who) return { authorized: true as const, email: who.email };
  const email = await signedInEmail();
  if (email) await logAttempt(email, false, "identity");
  return { authorized: false as const, signedIn: Boolean(email) };
});

/** Step 2: server-side credential check with rate limiting. */
export const architectLogin = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ credential: z.string().min(1).max(200) }).parse(input))
  .handler(async ({ data }) => {
    const m = await import("@/lib/maintenance.server");
    const who = await m.architectFromRequest();
    if (!who) throw new Error("ACCESS DENIED — this Google account is not authorized as System Architect.");
    if ((await m.recentFailures()) >= 5) {
      await m.logAttempt(who.email, false, "rate_limited");
      throw new Error("Too many failed attempts. Try again in 15 minutes.");
    }
    if (!m.credentialMatches(data.credential)) {
      await m.logAttempt(who.email, false, "credential");
      throw new Error("Invalid architect credential");
    }
    await m.logAttempt(who.email, true, "credential");
    return { session: m.mintArchitectSession(who.userId) };
  });

async function architect(session: string) {
  const m = await import("@/lib/maintenance.server");
  const who = await m.architectFromRequest();
  if (!who || !m.architectSessionValid(session, who.userId)) {
    throw new Error("Architect session expired — sign in again");
  }
  return who;
}

export const architectOverview = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ session: z.string().min(10) }).parse(input))
  .handler(async ({ data }) => {
    await architect(data.session);
    const { maintenanceAccess, maintenanceHistory } = await import("@/lib/maintenance.server");
    const [state, history] = await Promise.all([maintenanceAccess(), maintenanceHistory()]);
    return { state, requests: history.requests, periods: history.periods, audit: history.audit.slice(0, 60) };
  });

export const architectDecision = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        session: z.string().min(10),
        requestId: z.string().uuid(),
        approve: z.boolean(),
        minutes: z.number().int().optional(),
        reason: z.string().trim().max(300).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const who = await architect(data.session);
    const { architectDecide } = await import("@/lib/maintenance.server");
    return architectDecide({
      actor: `System Architect (${who.email})`,
      requestId: data.requestId,
      approve: data.approve,
      ...(data.minutes === undefined ? {} : { minutes: data.minutes }),
      reason: data.reason ?? null,
    });
  });

/** Architect-only: verify or reject the submitted payment reference (audit reason required). */
export const architectPaymentDecision = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ session: z.string().min(10), approve: z.boolean(), reason: z.string().trim().min(3).max(300), expectedRef: z.string().trim().min(1).max(120).optional() }).parse(input),
  )
  .handler(async ({ data }) => {
    const who = await architect(data.session);
    const { architectReviewPayment } = await import("@/lib/maintenance.server");
    return architectReviewPayment({ actor: `System Architect (${who.email})`, approve: data.approve, reason: data.reason, expectedRef: data.expectedRef ?? null });
  });
