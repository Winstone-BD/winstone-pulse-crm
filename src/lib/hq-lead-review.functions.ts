import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { leadOwner } from "@/lib/lead-owner";
import { requireHqLeadReview } from "@/lib/hq-lead-review.rules";

/** A review comment delivered through the existing recipient-scoped notice board. No lead state changes. */
export const sendHqLeadReview = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({
    adminToken: z.string().nullable().optional(),
    leadId: z.string().uuid(), agentId: z.string().uuid(),
    comment: z.string().trim().min(2).max(1000),
  }).parse(input))
  .handler(async ({ data }) => {
    const { resolveCaller } = await import("@/lib/access.server");
    const caller = await resolveCaller(data.adminToken ?? null);
    if (caller.scope !== "authority") throw new Error("HQ/IT access required");
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
    const [leadResult, agentResult] = await Promise.all([
      db.from("leads").select("id,name,assigned_to,assigned_agent_id").eq("id", data.leadId).maybeSingle(),
      db.from("profiles").select("id,is_active,approval_status,role").eq("id", data.agentId).maybeSingle(),
    ]);
    if (leadResult.error || agentResult.error) throw new Error(leadResult.error?.message ?? agentResult.error?.message);
    const agent = agentResult.data;
    requireHqLeadReview(caller.scope, leadResult.data ? leadOwner(leadResult.data) : null, data.agentId,
      Boolean(agent?.is_active && agent.approval_status === "approved" && ["agent", "team_leader"].includes(agent.role)));
    const { data: notice, error } = await db.from("it_notices").insert({
      title: `HQ review · ${leadResult.data?.name ?? "Lead"}`,
      body: data.comment, severity: "info", audience_type: "accounts",
      author_profile_id: caller.profile?.id ?? null, author_label: "Executive HQ review",
    }).select("id").single();
    if (error || !notice) throw new Error(error?.message ?? "Review could not be saved");
    const delivery = await db.from("it_notice_recipients").insert({ notice_id: notice.id, profile_id: data.agentId });
    if (delivery.error) throw new Error(`Review saved but recipient delivery failed: ${delivery.error.message}`);
    const event = await db.from("lead_events").insert({ lead_id: data.leadId, agent_id: data.agentId, kind: "hq_review_comment", detail: data.comment });
    if (event.error) throw new Error(`Review delivered but lead timeline failed: ${event.error.message}`);
    const { logAudit } = await import("@/lib/audit.server");
    await logAudit({ action: "hq_lead_review", entityType: "lead", entityId: data.leadId,
      actorProfileId: caller.profile?.id ?? null, actorLabel: caller.profile?.name ?? "Executive HQ",
      metadata: { recipientId: data.agentId, noticeId: notice.id } });
    return { noticeId: notice.id };
  });