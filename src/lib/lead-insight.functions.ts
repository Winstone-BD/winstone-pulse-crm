import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/** Score breakdown for one lead; agents only for their own lead. */
export const getLeadInsightScore = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ token: z.string().nullable().optional(), leadId: z.string().uuid() }).parse(i))
  .handler(async ({ data }) => {
    const { resolveCaller } = await import("@/lib/access.server");
    const caller = await resolveCaller(data.token ?? null);
    if (caller.scope === "none") throw new Error("Sign in to see the score");
    if (caller.scope === "agent") {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: lead } = await supabaseAdmin.from("leads").select("assigned_to, assigned_agent_id").eq("id", data.leadId).maybeSingle();
      const me = caller.profile?.id;
      if (!lead || !me || (lead.assigned_to !== me && lead.assigned_agent_id !== me)) throw new Error("This lead is not on your list");
    }
    const { scoreLeads } = await import("@/lib/lead-insight.server");
    return (await scoreLeads([data.leadId])).get(data.leadId)!;
  });

export const listNeglectedHighPotential = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ adminToken: z.string().nullable().optional() }).parse(i))
  .handler(async ({ data }) => {
    const { requireLeadHub } = await import("@/lib/access.server");
    await requireLeadHub(data.adminToken);
    const s = await import("@/lib/lead-insight.server");
    const [leads, targets] = await Promise.all([s.neglectedHighPotential(), s.reassignTargets()]);
    return { leads, targets };
  });

export const listReassignmentAudit = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ adminToken: z.string().nullable().optional() }).parse(i))
  .handler(async ({ data }) => {
    const { requireLeadHub } = await import("@/lib/access.server");
    await requireLeadHub(data.adminToken);
    const { reassignmentAudit } = await import("@/lib/lead-insight.server");
    return { rows: await reassignmentAudit() };
  });

export const reassignNeglectedLead = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({
    adminToken: z.string().nullable().optional(),
    leadId: z.string().uuid(),
    toAgentId: z.string().uuid(),
    reason: z.string().max(500),
    bypassReason: z.string().max(500).nullable().optional(),
  }).parse(i))
  .handler(async ({ data }) => {
    const { requireLeadHub } = await import("@/lib/access.server");
    await requireLeadHub(data.adminToken);
    const { reassignLead } = await import("@/lib/lead-insight.server");
    return reassignLead({ ...data, actorLabel: "LeadHub Nexus PIN" });
  });
