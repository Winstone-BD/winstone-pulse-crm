/**
 * CRM Insights: follow-up priorities, overdue items and 14-day trends computed
 * from real rows, plus an optional Winstone AI read-out of those numbers.
 * Read-only — nothing here writes to the database. Agents get their own
 * records only; HQ/IT (authority) sees the whole floor.
 */
import { aiChatJson } from "@/lib/ai-model.server";

export type InsightItem = {
  leadId: string | null;
  name: string;
  detail: string;
  at: string | null;
  priority?: string | null;
};
export type TrendDay = { day: string; calls: number; connected: number };
export type CrmInsights = {
  scope: "floor" | "agent";
  generatedAt: string;
  counts: { overdueFollowUps: number; dueToday: number; staleLeads: number; hotOpen: number; neverCalled: number };
  overdue: InsightItem[];
  dueToday: InsightItem[];
  priorities: InsightItem[];
  stale: InsightItem[];
  trend: TrendDay[];
  week: { calls: number; connected: number; prevCalls: number; prevConnected: number };
  topCategories: { label: string; count: number }[];
  ai: { headline: string; insights: string[]; actions: string[] } | null;
  aiError: string | null;
};

const DAY = 86_400_000;
const dhakaDay = (d: Date) => new Date(d.getTime() + 6 * 3600_000).toISOString().slice(0, 10);

export async function buildCrmInsights(agentId: string | null, lang: "bn" | "en", withAi: boolean): Promise<CrmInsights> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const now = new Date();
  const today = dhakaDay(now);
  const endToday = `${today}T23:59:59+06:00`;
  const since14 = new Date(now.getTime() - 14 * DAY).toISOString();
  const stale3 = new Date(now.getTime() - 3 * DAY).toISOString();

  let fu = supabaseAdmin
    .from("follow_up_events")
    .select("lead_id, customer_name, priority, scheduled_at, next_action, category")
    .eq("status", "upcoming")
    .lte("scheduled_at", endToday)
    .order("scheduled_at", { ascending: true })
    .limit(1000);
  if (agentId) fu = fu.eq("agent_id", agentId);

  let leadsQ = supabaseAdmin
    .from("leads")
    .select("id, name, status, temperature, last_call_at, call_count, retry_after")
    .neq("status", "closed")
    .not("assigned_to", "is", null)
    .order("last_call_at", { ascending: true, nullsFirst: true })
    .limit(1000);
  if (agentId) leadsQ = leadsQ.eq("assigned_to", agentId);

  let rq = supabaseAdmin
    .from("call_reports")
    .select("created_at, connected, category")
    .gte("created_at", since14)
    .limit(5000);
  if (agentId) rq = rq.eq("agent_id", agentId);

  const [fuRes, leadRes, repRes] = await Promise.all([fu, leadsQ, rq]);
  if (fuRes.error) throw new Error(fuRes.error.message);
  if (leadRes.error) throw new Error(leadRes.error.message);
  if (repRes.error) throw new Error(repRes.error.message);

  const startToday = new Date(`${today}T00:00:00+06:00`).getTime();
  const fuRows = fuRes.data ?? [];
  const toItem = (f: (typeof fuRows)[number]): InsightItem => ({
    leadId: f.lead_id,
    name: f.customer_name || "—",
    detail: (f.next_action || f.category || "").slice(0, 140),
    at: f.scheduled_at,
    priority: f.priority,
  });
  const overdueRows = fuRows.filter((f) => new Date(f.scheduled_at).getTime() < startToday);
  const todayRows = fuRows.filter((f) => new Date(f.scheduled_at).getTime() >= startToday);

  const leads = leadRes.data ?? [];
  const parked = (l: (typeof leads)[number]) => l.retry_after && new Date(l.retry_after) > now;
  const active = leads.filter((l) => !parked(l));
  const neverCalled = active.filter((l) => (l.call_count ?? 0) === 0);
  const stale = active.filter((l) => l.last_call_at && l.last_call_at < stale3);
  const hotWarm = active
    .filter((l) => l.temperature === "hot" || l.temperature === "warm")
    .sort((a, b) => (a.temperature === b.temperature ? (a.last_call_at ?? "").localeCompare(b.last_call_at ?? "") : a.temperature === "hot" ? -1 : 1));

  const days = (iso: string | null) => (iso ? Math.floor((now.getTime() - new Date(iso).getTime()) / DAY) : null);
  const priorities: InsightItem[] = hotWarm.slice(0, 8).map((l) => {
    const d = days(l.last_call_at);
    return {
      leadId: l.id,
      name: l.name || "—",
      priority: l.temperature,
      at: l.last_call_at,
      detail: d === null ? "Never called" : `Last call ${d} day${d === 1 ? "" : "s"} ago`,
    };
  });
  const staleItems: InsightItem[] = stale.slice(0, 8).map((l) => ({
    leadId: l.id,
    name: l.name || "—",
    at: l.last_call_at,
    priority: l.temperature,
    detail: `No call for ${days(l.last_call_at)} days · ${l.status}`,
  }));

  const trendMap = new Map<string, TrendDay>();
  for (let i = 13; i >= 0; i--) {
    const d = dhakaDay(new Date(now.getTime() - i * DAY));
    trendMap.set(d, { day: d, calls: 0, connected: 0 });
  }
  const cats = new Map<string, number>();
  for (const r of repRes.data ?? []) {
    const t = trendMap.get(dhakaDay(new Date(r.created_at)));
    if (t) {
      t.calls += 1;
      if (r.connected) t.connected += 1;
    }
    if (r.category) cats.set(r.category, (cats.get(r.category) ?? 0) + 1);
  }
  const trend = [...trendMap.values()];
  const sum = (rows: TrendDay[], k: "calls" | "connected") => rows.reduce((a, r) => a + r[k], 0);
  const week = {
    calls: sum(trend.slice(7), "calls"),
    connected: sum(trend.slice(7), "connected"),
    prevCalls: sum(trend.slice(0, 7), "calls"),
    prevConnected: sum(trend.slice(0, 7), "connected"),
  };
  const topCategories = [...cats.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([label, count]) => ({ label, count }));

  const result: CrmInsights = {
    scope: agentId ? "agent" : "floor",
    generatedAt: now.toISOString(),
    counts: {
      overdueFollowUps: overdueRows.length,
      dueToday: todayRows.length,
      staleLeads: stale.length,
      hotOpen: active.filter((l) => l.temperature === "hot").length,
      neverCalled: neverCalled.length,
    },
    overdue: overdueRows.slice(0, 8).map(toItem),
    dueToday: todayRows.slice(0, 8).map(toItem),
    priorities,
    stale: staleItems,
    trend,
    week,
    topCategories,
    ai: null,
    aiError: null,
  };

  if (withAi) {
    try {
      const out = await aiChatJson<{ headline?: string; insights?: string[]; actions?: string[] }>({
        system: `You are "Winstone AI" inside Winstone Pulse, a Bangladesh real-estate sales CRM.
Use ONLY the numbers and names given. Never invent facts, prices or people. Language: ${lang === "bn" ? "Bengali" : "English"}.
Scope: ${agentId ? "one sales agent's own work" : "the whole sales floor"}.
Return strict JSON: {"headline":"one sentence","insights":["3-4 short observations about trends and risks"],"actions":["3 concrete next steps, most urgent first"]}`,
        user: JSON.stringify({
          counts: result.counts,
          this_week: week,
          daily_trend: trend,
          top_report_categories: topCategories,
          overdue_follow_ups: result.overdue.map((i) => ({ name: i.name, due: i.at, priority: i.priority })),
          hot_warm_leads: priorities.map((i) => ({ name: i.name, temp: i.priority, detail: i.detail })),
        }),
      });
      result.ai = {
        headline: (out.headline ?? "").trim(),
        insights: (out.insights ?? []).filter(Boolean).slice(0, 4),
        actions: (out.actions ?? []).filter(Boolean).slice(0, 3),
      };
    } catch (e) {
      result.aiError = e instanceof Error ? e.message : "AI unavailable";
    }
  }
  return result;
}
