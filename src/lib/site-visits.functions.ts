import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/**
 * Site visit records linked to canonical leads. Server-only table: every
 * read/write goes through the server-resolved caller. HQ/IT sees and edits
 * all; agents only visits on leads assigned to them. Never deleted.
 */
export const SITE_VISIT_STATUSES = ["scheduled", "completed", "cancelled", "no_show"] as const;
const Token = z.string().nullable().optional();

export const listSiteVisits = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ adminToken: Token }).parse(i ?? {}))
  .handler(async ({ data }) => {
    const { siCaller } = await import("@/lib/sales-intel.server");
    const c = await siCaller(data.adminToken);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const out: Array<{ id: string; lead_id: string; agent_id: string | null; project: string | null; visit_at: string; status: string; notes: string | null; created_by: string; updated_by: string | null }> = [];
    for (let a = 0; ; a += 1000) {
      let q = supabaseAdmin.from("site_visits").select("id, lead_id, agent_id, project, visit_at, status, notes, created_by, updated_by");
      if (c.scope === "agent") q = q.eq("agent_id", c.agentId!);
      const { data: rows, error } = await q.order("visit_at", { ascending: false }).order("id").range(a, a + 999);
      if (error) throw new Error("সাইট ভিজিট পড়া যায়নি");
      out.push(...(rows ?? []));
      if (!rows || rows.length < 1000) return out;
    }
  });

export const createSiteVisit = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z.object({
      adminToken: Token,
      leadId: z.string().uuid(),
      visitAt: z.string().datetime({ offset: true }),
      project: z.string().trim().max(120).optional().nullable(),
      notes: z.string().trim().max(500).optional().nullable(),
    }).parse(i),
  )
  .handler(async ({ data }) => {
    const { siCaller, leadForCaller } = await import("@/lib/sales-intel.server");
    const c = await siCaller(data.adminToken);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const lead = await leadForCaller(supabaseAdmin, c, data.leadId); // ownership check for agents
    const agentId = c.scope === "agent" ? c.agentId : ((lead as { assigned_agent_id?: string | null }).assigned_agent_id ?? null);
    const { error } = await supabaseAdmin.from("site_visits").insert({
      lead_id: data.leadId,
      agent_id: agentId,
      visit_at: data.visitAt,
      project: data.project || null,
      notes: data.notes || null,
      created_by: c.actor,
    });
    if (error) throw new Error("সাইট ভিজিট সংরক্ষণ হয়নি");
    return { ok: true };
  });

export const setSiteVisitStatus = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z.object({ adminToken: Token, id: z.string().uuid(), status: z.enum(SITE_VISIT_STATUSES) }).parse(i),
  )
  .handler(async ({ data }) => {
    const { siCaller } = await import("@/lib/sales-intel.server");
    const c = await siCaller(data.adminToken);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let q = supabaseAdmin.from("site_visits").update({ status: data.status, updated_by: c.actor }).eq("id", data.id);
    if (c.scope === "agent") q = q.eq("agent_id", c.agentId!);
    const { data: rows, error } = await q.select("id");
    if (error || !rows?.length) throw new Error("অবস্থা বদলানো যায়নি");
    return { ok: true };
  });
