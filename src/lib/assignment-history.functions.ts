import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const Query = z.object({
  adminToken: z.string().max(4096).nullable().optional(),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  lead: z.string().max(120).nullable().optional(),
  page: z.number().int().min(0).max(1000).default(0),
});

export interface AssignmentHistoryRow {
  id: string;
  at: string;
  leadId: string;
  leadName: string;
  leadPhone: string;
  fromAgent: string;
  toAgent: string;
  changedBy: string;
  source: string;
  note: string | null;
}

/** HQ/IT (authority scope) only — everyone else is refused server-side. */
export const listAssignmentHistory = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => Query.parse(i))
  .handler(async ({ data }) => {
    const { resolveCaller } = await import("@/lib/access.server");
    const c = await resolveCaller(data.adminToken ?? null);
    if (c.scope !== "authority") throw new Error("Only HQ / IT admins can view the assignment history");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    let leadIds: string[] | null = null;
    const term = (data.lead ?? "").trim();
    if (term) {
      const like = `%${term.replace(/[%_,]/g, " ")}%`;
      const { data: hits, error: le } = await supabaseAdmin
        .from("leads").select("id").or(`name.ilike.${like},phone.ilike.${like}`).limit(200);
      if (le) throw new Error(le.message);
      leadIds = (hits ?? []).map((h) => h.id);
      if (!leadIds.length) return { rows: [] as AssignmentHistoryRow[] };
    }

    let q = supabaseAdmin
      .from("lead_assignments")
      .select("id,lead_id,from_agent_id,to_agent_id,changed_by,source,note,created_at")
      .gte("created_at", `${data.from}T00:00:00+06:00`)
      .lte("created_at", `${data.to}T23:59:59.999+06:00`)
      .order("created_at", { ascending: false })
      .range(data.page * 100, data.page * 100 + 99);
    if (leadIds) q = q.in("lead_id", leadIds);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    if (!rows?.length) return { rows: [] as AssignmentHistoryRow[] };

    const ids = new Set<string>();
    const agentIds = new Set<string>();
    for (const r of rows) {
      ids.add(r.lead_id);
      for (const a of [r.from_agent_id, r.to_agent_id, r.changed_by]) if (a) agentIds.add(a);
    }
    const [{ data: leads }, { data: people }] = await Promise.all([
      supabaseAdmin.from("leads").select("id,name,phone").in("id", [...ids]),
      supabaseAdmin.from("profiles").select("id,full_name").in("id", [...agentIds]),
    ]);
    const leadMap = new Map((leads ?? []).map((l) => [l.id, l]));
    const nameMap = new Map((people ?? []).map((p) => [p.id, p.full_name]));
    const who = (id: string | null) => (id ? nameMap.get(id) ?? "Staff" : "System");

    return {
      rows: rows.map((r): AssignmentHistoryRow => ({
        id: r.id,
        at: r.created_at,
        leadId: r.lead_id,
        leadName: leadMap.get(r.lead_id)?.name ?? "Lead",
        leadPhone: leadMap.get(r.lead_id)?.phone ?? "",
        fromAgent: r.from_agent_id ? who(r.from_agent_id) : "Unassigned",
        toAgent: who(r.to_agent_id),
        changedBy: who(r.changed_by),
        source: r.source,
        note: r.note,
      })),
    };
  });
