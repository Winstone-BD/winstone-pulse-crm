/**
 * Sales Command Center — pure aggregation over canonical rows already loaded
 * for the caller's permitted scope. No numbers are invented: every figure is a
 * count over leads, call_recordings, submitted call_reports or follow_up_events.
 * Site visit / booking count only explicit saved report signals.
 */
import { dhakaDay } from "@/lib/lead-groups";

export type CcLead = {
  id: string;
  status: string;
  temperature: string | null;
  outcome_category: string | null;
  source: string | null;
  created_at: string;
  assigned_agent_id: string | null;
  assigned_to: string | null;
};
export type CcCall = { id: string; lead_id: string | null; agent_id: string | null; created_at: string; duration_seconds: number };
export type CcReport = {
  id: string;
  lead_id: string | null;
  agent_id: string | null;
  category: string | null;
  customer_response: string | null;
  next_action: string | null;
  requirement: string | null;
  submitted_at: string | null;
  created_at: string;
};
export type CcFollowUp = {
  id: string;
  lead_id: string | null;
  agent_id: string | null;
  status: string;
  scheduled_at: string | null;
  completed_at: string | null;
};
export type CcAgent = { id: string; name: string };

export type CcFilters = { fromDay: string; toDay: string; agentId: string | null; source: string | null; project: string | null };

export const CONNECTED_SECONDS = 10;
export const isSiteVisit = (r: CcReport) => r.customer_response === "site_visit" || r.next_action === "site_visit";
export const isBooking = (r: CcReport) => r.category === "closed_converted";
const isInterested = (r: CcReport) => r.category === "interested" || r.category === "hot_lead";
const owner = (l: CcLead) => l.assigned_agent_id ?? l.assigned_to;
const srcKey = (s: string | null) => (s ?? "unknown").replace(/_/g, " ");
const reportDay = (r: CcReport) => dhakaDay(r.submitted_at ?? r.created_at);
const inRange = (day: string, f: CcFilters) => day >= f.fromDay && day <= f.toDay;
const pct = (n: number, d: number) => (d > 0 ? Math.round((n / d) * 1000) / 10 : null);

export function listDays(fromDay: string, toDay: string): string[] {
  const out: string[] = [];
  let t = Date.parse(`${fromDay}T00:00:00Z`);
  const end = Date.parse(`${toDay}T00:00:00Z`);
  while (t <= end && out.length < 400) {
    out.push(new Date(t).toISOString().slice(0, 10));
    t += 864e5;
  }
  return out;
}

export function computeCommandCenter(input: {
  leads: CcLead[];
  calls: CcCall[];
  reports: CcReport[];
  followUps: CcFollowUp[];
  agents: CcAgent[];
  filters: CcFilters;
  now: Date;
  dailyLeadQuota: number;
}) {
  const { filters: f, now } = input;
  const today = dhakaDay(now);

  // ---- scope: agent + source + project filters applied consistently ----
  let leads = input.leads;
  if (f.agentId) leads = leads.filter((l) => owner(l) === f.agentId);
  if (f.source) leads = leads.filter((l) => srcKey(l.source) === f.source);
  let reports = input.reports;
  if (f.project) {
    const projLeads = new Set(reports.filter((r) => r.requirement === f.project).map((r) => r.lead_id));
    leads = leads.filter((l) => projLeads.has(l.id));
  }
  const leadIds = new Set(leads.map((l) => l.id));
  const scoped = !!(f.source || f.project);
  reports = reports.filter((r) => (!f.agentId || r.agent_id === f.agentId) && (!scoped || (r.lead_id && leadIds.has(r.lead_id))));
  const calls = input.calls.filter((c) => (!f.agentId || c.agent_id === f.agentId) && (!scoped || (c.lead_id && leadIds.has(c.lead_id))));
  const followUps = input.followUps.filter((x) => (!f.agentId || x.agent_id === f.agentId) && (!scoped || (x.lead_id && leadIds.has(x.lead_id))));

  const rangeReports = reports.filter((r) => inRange(reportDay(r), f));
  const rangeCalls = calls.filter((c) => inRange(dhakaDay(c.created_at), f));
  const distinct = (rows: CcReport[], pred: (r: CcReport) => boolean) =>
    new Set(rows.filter(pred).map((r) => r.lead_id).filter(Boolean) as string[]);

  // ---- KPI pulse ----
  const callsToday = calls.filter((c) => dhakaDay(c.created_at) === today);
  const openFu = followUps.filter((x) => x.status !== "done");
  const kpi = {
    totalLeads: leads.length,
    newLeadsInRange: leads.filter((l) => inRange(dhakaDay(l.created_at), f)).length,
    callsToday: callsToday.length,
    connectedToday: callsToday.filter((c) => c.duration_seconds > CONNECTED_SECONDS).length,
    openFollowUps: openFu.length,
    siteVisits: distinct(rangeReports, isSiteVisit).size,
    bookings: distinct(rangeReports, isBooking).size,
    /** No revenue/deal-value field exists in the CRM — never estimated. */
    revenue: null as number | null,
  };

  // ---- funnel (all-time, current scope) ----
  const siteLeads = distinct(reports, isSiteVisit);
  const bookLeads = distinct(reports, isBooking);
  const interestedLeads = distinct(reports, isInterested);
  const stage = {
    leads: leads.map((l) => l.id),
    contacted: leads.filter((l) => l.status !== "pending").map((l) => l.id),
    interested: leads.filter((l) => l.temperature === "hot" || l.temperature === "warm" || interestedLeads.has(l.id)).map((l) => l.id),
    siteVisit: leads.filter((l) => siteLeads.has(l.id)).map((l) => l.id),
    booking: leads.filter((l) => bookLeads.has(l.id) || (l.status === "closed" && l.outcome_category === "deal_won")).map((l) => l.id),
  };
  const order = ["leads", "contacted", "interested", "siteVisit", "booking"] as const;
  const funnel = order.map((k, i) => ({
    key: k,
    count: stage[k].length,
    leadIds: stage[k],
    fromPrev: i === 0 ? null : pct(stage[k].length, stage[order[i - 1]].length),
  }));

  // ---- agent execution today ----
  const agentRows = input.agents
    .filter((a) => !f.agentId || a.id === f.agentId)
    .map((a) => {
      const mine = callsToday.filter((c) => c.agent_id === a.id);
      const worked = new Set(mine.map((c) => c.lead_id).filter(Boolean)).size;
      const todayReports = reports.filter((r) => r.agent_id === a.id && reportDay(r) === today);
      return {
        id: a.id,
        name: a.name,
        calls: mine.length,
        connected: mine.filter((c) => c.duration_seconds > CONNECTED_SECONDS).length,
        leadsWorked: worked,
        target: input.dailyLeadQuota,
        progress: pct(worked, input.dailyLeadQuota),
        siteVisits: distinct(todayReports, isSiteVisit).size,
      };
    })
    .sort((a, b) => b.leadsWorked - a.leadsWorked || a.name.localeCompare(b.name));
  const execution = {
    leadsWorked: agentRows.reduce((s, a) => s + a.leadsWorked, 0),
    target: agentRows.length * input.dailyLeadQuota,
    followUpsDoneToday: followUps.filter((x) => x.completed_at && dhakaDay(x.completed_at) === today).length,
    followUpsDueToday: openFu.filter((x) => x.scheduled_at && dhakaDay(x.scheduled_at) === today).length,
    siteVisitsToday: distinct(reports.filter((r) => reportDay(r) === today), isSiteVisit).size,
  };

  // ---- trend ----
  const days = listDays(f.fromDay, f.toDay);
  const trend = days.map((d) => {
    const dc = rangeCalls.filter((c) => dhakaDay(c.created_at) === d);
    const dr = rangeReports.filter((r) => reportDay(r) === d);
    return {
      day: d,
      calls: dc.length,
      connected: dc.filter((c) => c.duration_seconds > CONNECTED_SECONDS).length,
      bookings: distinct(dr, isBooking).size,
      siteVisits: distinct(dr, isSiteVisit).size,
    };
  });

  // ---- source performance ----
  const bySource = new Map<string, { leads: string[]; qualified: number; site: number; book: number }>();
  for (const l of leads) {
    const k = srcKey(l.source);
    const row = bySource.get(k) ?? { leads: [], qualified: 0, site: 0, book: 0 };
    row.leads.push(l.id);
    if (l.temperature === "hot" || l.temperature === "warm" || interestedLeads.has(l.id)) row.qualified += 1;
    if (siteLeads.has(l.id)) row.site += 1;
    if (bookLeads.has(l.id)) row.book += 1;
    bySource.set(k, row);
  }
  const sources = [...bySource.entries()].map(([name, r]) => ({
    name,
    leads: r.leads.length,
    leadIds: r.leads,
    qualified: r.qualified,
    siteVisits: r.site,
    bookings: r.book,
  }));

  // ---- follow-up health ----
  const fuLeads = (rows: CcFollowUp[]) => [...new Set(rows.map((x) => x.lead_id).filter(Boolean) as string[])];
  const dueToday = openFu.filter((x) => x.scheduled_at && dhakaDay(x.scheduled_at) === today);
  const overdue = openFu.filter((x) => x.scheduled_at && dhakaDay(x.scheduled_at) < today);
  const upcoming = openFu.filter((x) => !x.scheduled_at || dhakaDay(x.scheduled_at) > today);
  const completed = followUps.filter((x) => x.status === "done" && x.completed_at && inRange(dhakaDay(x.completed_at), f));
  const followUpHealth = {
    dueToday: { count: dueToday.length, leadIds: fuLeads(dueToday) },
    overdue: { count: overdue.length, leadIds: fuLeads(overdue) },
    upcoming: { count: upcoming.length, leadIds: fuLeads(upcoming) },
    completed: { count: completed.length, leadIds: fuLeads(completed) },
  };

  // ---- insights: only from loaded data, with a minimum sample ----
  const insights: string[] = [];
  if (overdue.length > 0) insights.push(`${overdue.length}টি ফলো-আপ নির্ধারিত সময় পেরিয়ে গেছে — আগে এগুলো শেষ করুন।`);
  const rc = rangeCalls.length;
  if (rc >= 20) {
    const conn = rangeCalls.filter((c) => c.duration_seconds > CONNECTED_SECONDS).length;
    insights.push(`এই সময়ে ${rc}টি কলের ${pct(conn, rc)}% সংযুক্ত হয়েছে (>${CONNECTED_SECONDS} সেকেন্ড)।`);
  }
  const bigSources = sources.filter((s) => s.leads >= 30);
  if (bigSources.length >= 2) {
    const best = [...bigSources].sort((a, b) => b.qualified / b.leads - a.qualified / a.leads)[0];
    insights.push(`৩০+ লিডের সোর্সগুলোর মধ্যে "${best.name}"-এ আগ্রহী লিডের হার সর্বোচ্চ (${pct(best.qualified, best.leads)}%)।`);
  }
  const stuck = funnel[1].count - funnel[2].count;
  if (funnel[1].count >= 30 && stuck > 0) insights.push(`যোগাযোগ হওয়া ${funnel[1].count} লিডের মধ্যে ${stuck}টি এখনো আগ্রহী ধাপে পৌঁছায়নি।`);

  return { kpi, funnel, agentRows, execution, trend, sources, followUpHealth, insights, today };
}

export function presetRange(preset: "7d" | "30d" | "month", now: Date): { fromDay: string; toDay: string } {
  const toDay = dhakaDay(now);
  if (preset === "month") return { fromDay: `${toDay.slice(0, 8)}01`, toDay };
  const n = preset === "7d" ? 6 : 29;
  return { fromDay: dhakaDay(new Date(now.getTime() - n * 864e5)), toDay };
}
