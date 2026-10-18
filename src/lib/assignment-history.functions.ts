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
        .from("leads").select("id").or(`name.ilike.${like},phone_number.ilike.${like}`).limit(200);
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
      supabaseAdmin.from("leads").select("id,name,phone_number").in("id", [...ids]),
      supabaseAdmin.from("profiles").select("id,name").in("id", [...agentIds]),
    ]);
    const leadMap = new Map((leads ?? []).map((l) => [l.id, l]));
    const nameMap = new Map((people ?? []).map((p) => [p.id, p.name]));
    const who = (id: string | null) => (id ? nameMap.get(id) ?? "Staff" : "System");

    return {
      rows: rows.map((r): AssignmentHistoryRow => ({
        id: r.id,
        at: r.created_at,
        leadId: r.lead_id,
        leadName: leadMap.get(r.lead_id)?.name ?? "Lead",
        leadPhone: leadMap.get(r.lead_id)?.phone_number ?? "",
        fromAgent: r.from_agent_id ? who(r.from_agent_id) : "Unassigned",
        toAgent: who(r.to_agent_id),
        changedBy: who(r.changed_by),
        source: r.source,
        note: r.note,
      })),
    };
  });

export interface DailyNewLeadRow {
  agentId: string;
  name: string;
  employeeId: string | null;
  newLeads: number;
  expected: number;
  ok: boolean;
}

/**
 * HQ/IT only: for each active approved agent, how many NEW leads (handed out
 * from the unassigned pool, i.e. no previous owner) they received on the given
 * Dhaka day. Anyone not at exactly `expected` is flagged.
 */
export const dailyNewLeadCheck = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z.object({
      adminToken: z.string().max(4096).nullable().optional(),
      day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      expected: z.number().int().min(1).max(500).default(50),
    }).parse(i),
  )
  .handler(async ({ data }) => {
    const { resolveCaller } = await import("@/lib/access.server");
    const c = await resolveCaller(data.adminToken ?? null);
    if (c.scope !== "authority") throw new Error("Only HQ / IT admins can view this check");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: agents, error: ae } = await supabaseAdmin
      .from("profiles").select("id,name,employee_id")
      .eq("role", "agent").eq("is_active", true).eq("approval_status", "approved");
    if (ae) throw new Error(ae.message);
    const counts = new Map<string, number>();
    for (let page = 0; page < 50; page++) {
      const { data: rows, error } = await supabaseAdmin
        .from("lead_assignments").select("to_agent_id")
        .is("from_agent_id", null)
        .gte("created_at", `${data.day}T00:00:00+06:00`)
        .lte("created_at", `${data.day}T23:59:59.999+06:00`)
        .range(page * 1000, page * 1000 + 999);
      if (error) throw new Error(error.message);
      for (const r of rows ?? []) if (r.to_agent_id) counts.set(r.to_agent_id, (counts.get(r.to_agent_id) ?? 0) + 1);
      if ((rows ?? []).length < 1000) break;
    }
    const rows: DailyNewLeadRow[] = (agents ?? []).map((a) => {
      const n = counts.get(a.id) ?? 0;
      return { agentId: a.id, name: a.name, employeeId: a.employee_id, newLeads: n, expected: data.expected, ok: n === data.expected };
    }).sort((x, y) => Number(x.ok) - Number(y.ok) || x.name.localeCompare(y.name));
    return { day: data.day, rows, flagged: rows.filter((r) => !r.ok).length };
  });
