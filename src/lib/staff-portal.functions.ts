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
        .select("id, name, status, work_state, work_date, last_call_at, area")
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

    return { agents, reports, leads, score };
  });
