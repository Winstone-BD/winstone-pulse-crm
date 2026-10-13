import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const input = z.object({ token: z.string().min(10).max(300) });

export const peekUnlockEmail = createServerFn({ method: "POST" })
  .inputValidator((d) => input.parse(d))
  .handler(async ({ data }) => {
    const { verifyUnlockEmailToken } = await import("@/lib/unlock-email.server");
    const v = verifyUnlockEmailToken(data.token);
    if (!v) return { ok: false as const, error: "This link is invalid or has expired." };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: r } = await supabaseAdmin.from("maintenance_unlock_requests")
      .select("status, requested_by, requested_hours, reason, billing_period, payment_status_at_request, plan_code")
      .eq("id", v.requestId).maybeSingle();
    if (!r || r.plan_code !== "crm") return { ok: false as const, error: "Request not found." };
    return { ok: true as const, status: r.status as string, requestedBy: r.requested_by as string, hours: r.requested_hours as number, reason: (r.reason as string | null) ?? null, period: r.billing_period as string, paymentStatus: r.payment_status_at_request as string, expiresAt: v.expiresAt };
  });

export const confirmUnlockEmail = createServerFn({ method: "POST" })
  .inputValidator((d) => input.extend({ approve: z.boolean(), reason: z.string().max(300).optional() }).parse(d))
  .handler(async ({ data }) => {
    const { verifyUnlockEmailToken, approverEmail } = await import("@/lib/unlock-email.server");
    const v = verifyUnlockEmailToken(data.token);
    if (!v) return { ok: false as const, error: "This link is invalid or has expired." };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: r } = await supabaseAdmin.from("maintenance_unlock_requests").select("requested_hours").eq("id", v.requestId).maybeSingle();
    const { architectDecide } = await import("@/lib/maintenance.server");
    try {
      const res = await architectDecide({
        actor: `${approverEmail()} (email link)`,
        requestId: v.requestId,
        approve: data.approve,
        minutes: ((r?.requested_hours as number | undefined) ?? 1) * 60,
        reason: data.approve ? "Approved via email link" : (data.reason ?? "Denied via email link"),
      });
      return { ok: true as const, status: res.status, expiresAt: "expiresAt" in res ? res.expiresAt : null };
    } catch (e) {
      return { ok: false as const, error: e instanceof Error ? e.message : "Could not decide" };
    }
  });
