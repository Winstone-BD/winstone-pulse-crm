import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function requireReviewer(context: {
  userId: string;
  claims: Record<string, unknown>;
  supabase: {
    rpc: (
      name: "has_role",
      args: { _user_id: string; _role: "admin" },
    ) => PromiseLike<{ data: boolean | null }>;
  };
}) {
  const email =
    typeof context.claims["email"] === "string" ? context.claims["email"].trim().toLowerCase() : "";
  const { data: isAdmin } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (!email || !isAdmin) throw new Error("Authorized CRM admin access required");
  return { userId: context.userId, email };
}

export const getServiceBillAlert = createServerFn({ method: "GET" }).handler(async () => {
  const { currentServiceBill } = await import("@/lib/service-bill-review.server");
  const bill = await currentServiceBill("Authorized Winstone reviewer", null);
  return {
    bill_id: bill.bill_id,
    service_name: bill.service_name,
    amount: bill.amount,
    currency: bill.currency,
    status: bill.status,
    issuer: bill.issuer,
    created_at: bill.created_at,
    due_at: bill.due_at,
    review_status: bill.review_status,
  };
});

export const getServiceBillReviewAccess = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const reviewer = await requireReviewer(context);
    const service = await import("@/lib/service-bill-review.server");
    return {
      authorized: true as const,
      unlocked: await service.hasServiceBillReviewSession(reviewer),
    };
  });

export const unlockServiceBillDetails = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ pin: z.string().min(1).max(128) }).parse(input))
  .handler(async ({ data, context }) => {
    const reviewer = await requireReviewer(context);
    const { unlockServiceBillReview } = await import("@/lib/service-bill-review.server");
    return unlockServiceBillReview(reviewer, data.pin);
  });

export const getUnlockedServiceBill = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const reviewer = await requireReviewer(context);
    const service = await import("@/lib/service-bill-review.server");
    if (!(await service.hasServiceBillReviewSession(reviewer)))
      throw new Error("Review session expired");
    const recipient =
      process.env["SERVICE_BILL_APPROVER_EMAIL"]?.trim() || "CONFIGURATION REQUIRED";
    return {
      bill: await service.currentServiceBill(recipient, reviewer),
      email: { missing: service.serviceBillEmailConfiguration() },
    };
  });

export const sendServiceBillTestEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const reviewer = await requireReviewer(context);
    const service = await import("@/lib/service-bill-review.server");
    if (!(await service.hasServiceBillReviewSession(reviewer)))
      throw new Error("Review session expired");
    const missing = service.serviceBillEmailConfiguration();
    if (missing.length) return { sent: false as const, missing };
    const recipient = process.env["SERVICE_BILL_APPROVER_EMAIL"]?.trim();
    if (!recipient) return { sent: false as const, missing: ["SERVICE_BILL_APPROVER_EMAIL"] };
    const bill = await service.currentServiceBill(recipient, null);
    const { sendViaHostinger } = await import("@/lib/email-templates/hostinger-send.server");
    await sendViaHostinger(recipient, "Pending Review", `service-bill-review-test-${bill.bill_id}`);
    const { audit } = await import("@/lib/maintenance.server");
    await audit({
      actor: reviewer.email,
      actorRole: "admin_reviewer",
      action: "service_bill_test_email_sent",
      period: bill.created_at.slice(0, 7),
      metadata: { bill_id: bill.bill_id },
    });
    return { sent: true as const, missing: [] };
  });

export const lockServiceBillDetails = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireReviewer(context);
    const { clearServiceBillReviewSession } = await import("@/lib/service-bill-review.server");
    await clearServiceBillReviewSession();
    return { ok: true as const };
  });
