import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export type PortalAgent = { profileId: string; name: string; employeeId: string | null; isActive: boolean };
export type PortalReport = {
  id: string;
  createdAt: string;
  status: string | null;
  connected: boolean | null;
  durationSeconds: number | null;
  category: string | null;
  temperature: string | null;
  summary: string | null;
  leadName: string | null;
};
export type PortalLead = {
  id: string;
  name: string | null;
  status: string | null;
  workState: string | null;
  workDate: string | null;
  lastCallAt: string | null;
  area: string | null;
};
export type PortalScore = {
  score: number;
  called: number;
  connected: number;
  reports: number;
  followUps: number;
  talkMinutes: number;
  assigned: number;
  completed: number;
  completionPercent: number;
} | null;

/**
 * HQ staff portal — read-only view of any agent's reports, today's score and
 * assigned leads. Requires the HQ/IT authority PIN; never writes anything.
 */
export const staffPortal = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({ adminToken: z.string().nullable().optional(), agentId: z.string().uuid().nullable().optional() })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { resolveCaller, requireAuthority } = await import("@/lib/access.server");
    requireAuthority(await resolveCaller(data.adminToken ?? null));
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: profiles, error } = await supabaseAdmin
      .from("profiles")
      .select("id, name, employee_id, role, is_active")
      .in("role", ["agent", "team_leader"])
      .order("employee_id", { ascending: true });
    if (error) throw new Error("এজেন্ট তালিকা লোড হয়নি");
    const agents: PortalAgent[] = (profiles ?? []).map((p) => ({
      profileId: p.id,
      name: p.name ?? "—",
      employeeId: p.employee_id ?? null,
      isActive: !!p.is_active,
    }));

    const agentId = data.agentId ?? null;
    if (!agentId) {
      const overview = await buildOverview(supabaseAdmin, agents);
      return { agents, reports: [] as PortalReport[], leads: [] as PortalLead[], score: null as PortalScore, overview };
    }

    const [reportsRes, leadsRes, board] = await Promise.all([
      supabaseAdmin
        .from("call_reports")
        .select("id, created_at, status, connected, duration_seconds, category, temperature, summary, leads(name)")
        .eq("agent_id", agentId)
        .order("created_at", { ascending: false })
        .limit(50),
      supabaseAdmin
        .from("leads")
        .select("id, name, status, work_state, work_date, last_call_at, area", { count: "exact" })
        .or(`assigned_agent_id.eq.${agentId},assigned_to.eq.${agentId}`)
        .order("work_date", { ascending: false, nullsFirst: false })
        .limit(200),
      import("@/lib/top-performer.server").then((m) => m.dailyTopPerformer()).catch(() => null),
    ]);

    const reports: PortalReport[] = (reportsRes.data ?? []).map((r) => {
      const lead = (r as { leads?: { name: string | null } | { name: string | null }[] | null }).leads;
      const leadName = Array.isArray(lead) ? (lead[0]?.name ?? null) : (lead?.name ?? null);
      return {
        id: r.id,
        createdAt: r.created_at,
        status: r.status ?? null,
        connected: r.connected ?? null,
        durationSeconds: r.duration_seconds ?? null,
        category: r.category ?? null,
        temperature: r.temperature ?? null,
        summary: r.summary ?? null,
        leadName,
      };
    });
    const leads: PortalLead[] = (leadsRes.data ?? []).map((l) => ({
      id: l.id,
      name: l.name ?? null,
      status: l.status ?? null,
      workState: l.work_state ?? null,
      workDate: l.work_date ?? null,
      lastCallAt: l.last_call_at ?? null,
      area: l.area ?? null,
    }));

    const line = board ? [...board.topThree, ...board.otherAgents].find((p) => p.agentId === agentId) : undefined;
    const score: PortalScore = line
      ? {
          score: line.score,
          called: line.called,
          connected: line.connected,
          reports: line.reports,
          followUps: line.followUps,
          talkMinutes: line.talkMinutes,
          assigned: line.assigned,
          completed: line.completed,
          completionPercent: line.completionPercent,
        }
      : null;

    return { agents, reports, leads, leadTotal: leadsRes.count ?? leads.length, score };
  });

export type OverviewRow = {
  profileId: string;
  name: string;
  employeeId: string | null;
  /** Reports per Dhaka day, oldest → newest, aligned with `days`. */
  daily: number[];
  reports: number;
  connected: number;
  pending: number;
  hot: number;
  assignedLeads: number;
  calledLeads: number;
};
export type Overview = {
  days: string[];
  rows: OverviewRow[];
  statusMix: { label: string; count: number }[];
  hourMix: number[];
};

const dhakaDay = (iso: string) => new Date(new Date(iso).getTime() + 6 * 3600_000).toISOString().slice(0, 10);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function buildOverview(db: any, agents: PortalAgent[]): Promise<Overview> {
  const days: string[] = [];
  for (let i = 6; i >= 0; i--) days.push(dhakaDay(new Date(Date.now() - i * 86400_000).toISOString()));
  const since = new Date(Date.now() - 7 * 86400_000).toISOString();
  const ids = agents.map((a) => a.profileId);
  // Paged reads: the database caps each response at 1000 rows.
  const pageAll = async (build: (from: number, to: number) => PromiseLike<{ data: unknown[] | null }>) => {
    const out: unknown[] = [];
    for (let from = 0; from < 50000; from += 1000) {
      const { data } = await build(from, from + 999);
      out.push(...(data ?? []));
      if (!data || data.length < 1000) break;
    }
    return { data: out };
  };
  const [rep, leads] = await Promise.all([
    pageAll((f, t) => db.from("call_reports").select("agent_id, created_at, status, connected, temperature").gte("created_at", since).in("agent_id", ids).order("id").range(f, t)),
    pageAll((f, t) => db.from("leads").select("assigned_agent_id, last_call_at").in("assigned_agent_id", ids).order("id").range(f, t)),
  ]);
  const by = new Map<string, OverviewRow>();
  for (const a of agents)
    by.set(a.profileId, { profileId: a.profileId, name: a.name, employeeId: a.employeeId, daily: days.map(() => 0), reports: 0, connected: 0, pending: 0, hot: 0, assignedLeads: 0, calledLeads: 0 });
  const status = new Map<string, number>();
  const hourMix = Array.from({ length: 24 }, () => 0);
  for (const r of (rep.data ?? []) as { agent_id: string; created_at: string; status: string | null; connected: boolean | null; temperature: string | null }[]) {
    const row = by.get(r.agent_id);
    if (!row) continue;
    const di = days.indexOf(dhakaDay(r.created_at));
    if (di >= 0) row.daily[di] = (row.daily[di] ?? 0) + 1;
    row.reports++;
    if (r.connected) row.connected++;
    if (r.status === "pending") row.pending++;
    if ((r.temperature ?? "").toLowerCase() === "hot") row.hot++;
    const k = r.status ?? "unknown";
    status.set(k, (status.get(k) ?? 0) + 1);
    { const h = (new Date(r.created_at).getUTCHours() + 6) % 24; hourMix[h] = (hourMix[h] ?? 0) + 1; }
  }
  for (const l of (leads.data ?? []) as { assigned_agent_id: string; last_call_at: string | null }[]) {
    const row = by.get(l.assigned_agent_id);
    if (!row) continue;
    row.assignedLeads++;
    if (l.last_call_at) row.calledLeads++;
  }
  return {
    days,
    rows: [...by.values()].sort((a, b) => b.reports - a.reports),
    statusMix: [...status.entries()].map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count),
    hourMix,
  };
}
