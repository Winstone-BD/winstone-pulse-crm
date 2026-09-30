import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/** HQ/IT-only Lead 360: search and full permanent history. Read-only. */
async function authority(adminToken: string | null | undefined) {
  const { resolveCaller } = await import("@/lib/access.server");
  const caller = await resolveCaller(adminToken ?? null);
  if (caller.scope !== "authority") throw new Error("HQ/IT PIN প্রয়োজন");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

const SearchInput = z.object({
  adminToken: z.string().nullable().optional(),
  q: z.string().trim().max(120).default(""),
  agentId: z.string().uuid().nullable().optional(),
  source: z.string().max(60).nullable().optional(),
  followUpStatus: z.enum(["any", "upcoming", "overdue", "none"]).default("any"),
  from: z.string().date().nullable().optional(),
  to: z.string().date().nullable().optional(),
});

export const searchLead360 = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => SearchInput.parse(i))
  .handler(async ({ data }) => {
    let db;
    try {
      db = await authority(data.adminToken);
    } catch {
      return { locked: true as const, rows: [] };
    }
    const { normalizeBangladeshPhone } = await import("@/lib/lead-phone");
    let q = db
      .from("leads")
      .select("id, name, phone_number, source, reference_by, assigned_to, status, created_at, serial_no")
      .order("updated_at", { ascending: false })
      .limit(40);
    const term = data.q.replace(/[%,()]/g, " ").trim();
    if (term) {
      const phone = normalizeBangladeshPhone(term);
      const digits = term.replace(/\D/g, "");
      const ors = [`name.ilike.%${term}%`, `reference_by.ilike.%${term}%`, `source.ilike.%${term}%`];
      if (digits.length >= 5) ors.push(`phone_number.ilike.%${(phone ?? digits).slice(-10)}%`);
      if (/^[0-9a-f-]{36}$/i.test(term)) ors.push(`id.eq.${term}`);
      q = q.or(ors.join(","));
    }
    if (data.agentId) q = q.eq("assigned_to", data.agentId);
    if (data.source) q = q.eq("source", data.source);
    if (data.from) q = q.gte("created_at", new Date(`${data.from}T00:00:00+06:00`).toISOString());
    if (data.to) q = q.lte("created_at", new Date(`${data.to}T23:59:59+06:00`).toISOString());
    const { data: leads, error } = await q;
    if (error) throw new Error(error.message);
    const ids = (leads ?? []).map((l) => l.id);
    if (!ids.length) return { locked: false as const, rows: [] };
    const [{ data: reps }, { data: fus }] = await Promise.all([
      db.from("call_reports").select("lead_id, connected").in("lead_id", ids).limit(5000),
      db.from("follow_up_events").select("lead_id, status, scheduled_at").in("lead_id", ids).limit(5000),
    ]);
    const now = Date.now();
    const rows = (leads ?? []).map((l) => {
      const r = (reps ?? []).filter((x) => x.lead_id === l.id);
      const f = (fus ?? []).filter((x) => x.lead_id === l.id);
      const open = f.filter((x) => x.status !== "done" && x.status !== "completed").sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at));
      const overdue = open.some((x) => new Date(x.scheduled_at).getTime() < now);
      return {
        id: l.id,
        name: l.name,
        phone: l.phone_number,
        source: l.source,
        referenceBy: l.reference_by,
        agentId: l.assigned_to,
        calls: r.length,
        connected: r.filter((x) => x.connected).length,
        followUps: f.length,
        nextFollowUpAt: open[0]?.scheduled_at ?? null,
        fuState: open.length === 0 ? ("none" as const) : overdue ? ("overdue" as const) : ("upcoming" as const),
      };
    });
    return {
      locked: false as const,
      rows: data.followUpStatus === "any" ? rows : rows.filter((r) => r.fuState === data.followUpStatus),
    };
  });

export const getLead360 = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z.object({ adminToken: z.string().nullable().optional(), leadId: z.string().uuid() }).parse(i),
  )
  .handler(async ({ data }) => {
    const db = await authority(data.adminToken);
    const { data: lead, error } = await db
      .from("leads")
      .select("id, name, phone_number, source, reference_by, address, assigned_to, status, temperature, grade, created_at")
      .eq("id", data.leadId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!lead) throw new Error("লিড পাওয়া যায়নি");
    const [reports, recs, fus, changes, events] = await Promise.all([
      db.from("call_reports")
        .select("id, agent_id, recording_id, call_started_at, call_ended_at, created_at, connected, duration_seconds, category, customer_response, next_action, summary, requirement, status")
        .eq("lead_id", lead.id).order("created_at").limit(1000),
      db.from("call_recordings")
        .select("id, agent_id, started_at, created_at, duration_seconds, call_status")
        .eq("lead_id", lead.id).limit(1000),
      db.from("follow_up_events")
        .select("id, agent_id, scheduled_at, status, reason_code, note, created_at, completed_at, reschedule_count")
        .eq("lead_id", lead.id).limit(1000),
      db.from("follow_up_changes")
        .select("id, follow_up_id, action, old_scheduled_at, new_scheduled_at, reason_code, note, changed_by, changed_at")
        .eq("lead_id", lead.id).limit(2000),
      db.from("lead_events").select("id, kind, detail, agent_id, created_at").eq("lead_id", lead.id).limit(2000),
    ]);
    const reported = new Set((reports.data ?? []).map((r) => r.recording_id).filter(Boolean));
    const calls = [
      ...(reports.data ?? []).map((r) => ({
        id: r.id,
        at: r.call_started_at ?? r.call_ended_at ?? r.created_at,
        agentId: r.agent_id,
        connected: Boolean(r.connected),
        durationSeconds: r.duration_seconds,
        category: r.category,
        customerResponse: r.customer_response,
        nextAction: r.next_action,
        summary: r.summary,
        requirement: r.requirement,
      })),
      ...(recs.data ?? [])
        .filter((r) => !reported.has(r.id))
        .map((r) => ({
          id: r.id,
          at: r.started_at ?? r.created_at,
          agentId: r.agent_id,
          connected: (r.duration_seconds ?? 0) > 0 && r.call_status !== "no_answer",
          durationSeconds: r.duration_seconds,
          category: r.call_status,
          customerResponse: null,
          nextAction: null,
          summary: null,
          requirement: null,
        })),
    ].sort((a, b) => a.at.localeCompare(b.at));
    const agentIds = [
      ...new Set([lead.assigned_to, ...calls.map((c) => c.agentId), ...(fus.data ?? []).map((f) => f.agent_id), ...(changes.data ?? []).map((c) => c.changed_by)].filter(Boolean) as string[]),
    ];
    const { data: people } = agentIds.length
      ? await db.from("profiles").select("id, user_id, name, employee_id").or(`id.in.(${agentIds.join(",")}),user_id.in.(${agentIds.join(",")})`)
      : { data: [] as { id: string; user_id: string | null; name: string; employee_id: string | null }[] };
    const agents: Record<string, string> = {};
    for (const p of people ?? []) {
      const label = p.employee_id ? `${p.name} — ${p.employee_id}` : p.name;
      agents[p.id] = label;
      if (p.user_id) agents[p.user_id] = label;
    }
    return {
      lead: {
        id: lead.id,
        name: lead.name,
        phone: lead.phone_number,
        source: lead.source,
        referenceBy: lead.reference_by,
        address: lead.address,
        assignedTo: lead.assigned_to,
        status: lead.status,
        temperature: lead.temperature,
        grade: lead.grade,
        createdAt: lead.created_at,
        requirement: [...calls].reverse().find((c) => c.requirement)?.requirement ?? null,
      },
      calls,
      followUps: (fus.data ?? []).map((f) => ({
        id: f.id,
        agentId: f.agent_id,
        scheduledAt: f.scheduled_at,
        status: f.status,
        reasonCode: f.reason_code,
        note: f.note,
        createdAt: f.created_at,
        completedAt: f.completed_at,
        rescheduleCount: f.reschedule_count ?? 0,
      })),
      changes: (changes.data ?? []).map((c) => ({
        id: c.id,
        followUpId: c.follow_up_id,
        action: c.action,
        oldScheduledAt: c.old_scheduled_at,
        newScheduledAt: c.new_scheduled_at,
        reasonCode: c.reason_code,
        note: c.note,
        changedBy: c.changed_by,
        changedAt: c.changed_at,
      })),
      events: (events.data ?? []).map((e) => ({ id: e.id, kind: e.kind, detail: e.detail, agentId: e.agent_id, at: e.created_at })),
      agents,
    };
  });
