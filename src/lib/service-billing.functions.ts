import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/**
 * Monthly ৳4,000 service bill endpoints. Reading is open to HQ (read-only) and
 * IT; verifying a payment or recording the architect payout needs a writing
 * identified IT Head session, and both are idempotent in service-billing.server.ts.
 */

const TokenInput = z.object({ adminToken: z.string().nullable().optional() });

async function reader(adminToken: string | null | undefined) {
  const { resolveCaller, requireDispatch } = await import("@/lib/access.server");
  const caller = await resolveCaller(adminToken ?? null);
  requireDispatch(caller);
  return caller;
}

async function writer(adminToken: string | null | undefined) {
  const caller = await reader(adminToken);
  const { requireWrite } = await import("@/lib/access.server");
  requireWrite(caller);
  if (!(await billingReviewer(caller.userId, adminToken))) throw new Error("Only the verified Head of IT account can approve billing");
  return caller;
}

async function billingReviewer(userId: string | null, adminToken: string | null | undefined) {
  if (!userId || !adminToken) return false;
  const { itAccountTokenUser } = await import("@/lib/admin-gate.server");
  if (itAccountTokenUser(adminToken) !== userId) return false;
  const { architectFromRequest } = await import("@/lib/maintenance.server");
  const identity = await architectFromRequest();
  return identity?.userId === userId;
}

/** Invoice history, current period and whether the service is covered today. */
export const serviceBillingOverview = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => TokenInput.parse(input))
  .handler(async ({ data }) => {
    const caller = await reader(data.adminToken);
    const { billingState, architectAccount } = await import("@/lib/service-billing.server");
    const [state, architect] = await Promise.all([billingState(), architectAccount()]);
    return { ...state, architect, canApproveBilling: !caller.readOnly && await billingReviewer(caller.userId, data.adminToken) };
  });

const VerifyInput = TokenInput.extend({
  period: z.string().regex(/^\d{4}-\d{2}$/),
  amountBdt: z.number().int().min(1).max(1_000_000).optional(),
  paymentRef: z.string().trim().min(3).max(120),
  paymentMethod: z.string().trim().max(60).nullable().optional(),
  note: z.string().trim().max(300).nullable().optional(),
});

/** Verify a received payment once: invoice paid → service active → share split. */
export const verifyServiceInvoice = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => VerifyInput.parse(input))
  .handler(async ({ data }) => {
    const caller = await writer(data.adminToken);
    const { verifyServicePayment } = await import("@/lib/service-billing.server");
    return verifyServicePayment({
      period: data.period,
      ...(data.amountBdt === undefined ? {} : { amountBdt: data.amountBdt }),
      paymentRef: data.paymentRef,
      paymentMethod: data.paymentMethod ?? null,
      note: data.note ?? null,
      actorProfileId: caller.profile?.id ?? null,
      actorLabel: caller.profile?.name ?? "IT Console",
    });
  });

const PayoutInput = TokenInput.extend({
  period: z.string().regex(/^\d{4}-\d{2}$/),
  payoutRef: z.string().trim().min(3).max(120),
});

/** Record the ৳1,000 architect payout once for a settled invoice. */
export const recordServicePayout = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => PayoutInput.parse(input))
  .handler(async ({ data }) => {
    const caller = await writer(data.adminToken);
    const { recordArchitectPayout } = await import("@/lib/service-billing.server");
    return recordArchitectPayout({
      period: data.period,
      payoutRef: data.payoutRef,
      actorProfileId: caller.profile?.id ?? null,
      actorLabel: caller.profile?.name ?? "IT Console",
    });
  });
