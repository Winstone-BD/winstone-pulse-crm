/**
 * Lead Insight Score + neglected high-potential list + manual reassignment
 * (server only). Scores are computed on read from saved facts; nothing here
 * changes the locked V2 score. Reassignment is LeadHub-only and always
 * appends lead_assignments + lead_events rows.
 */
import { dhakaDateOf } from "@/lib/business-day";
import { businessDaysSince } from "@/lib/lead-neglect";
import {
  MIN_REASON,
  NEGLECT_BUSINESS_DAYS,
  OVERDUE_FOLLOW_UP_HOURS,
  reassignNeedsBypass,
  scoreLead,
  type LeadInsightScore,
} from "@/lib/lead-insight-score";

const CLOSED_FU = ["done", "completed", "cancelled", "canceled", "missed_closed"];

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

function chunks<T>(items: T[], size = 200): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

export async function scoreLeads(ids: string[]): Promise<Map<string, LeadInsightScore>> {
  const db = await admin();
  const out = new Map<string, LeadInsightScore>();
  for (const part of chunks(ids)) {
    const [rp, rc, fu] = await Promise.all([
      db.from("call_reports").select("lead_id, connected, duration_seconds, evaluation_answers, interest").in("lead_id", part),
      db.from("call_recordings").select("lead_id, duration_seconds, sentiment, ai_intent, ai_temperature").in("lead_id", part),
      db.from("follow_up_events").select("lead_id, reason_code").in("lead_id", part),
    ]);
    for (const id of part) {
      out.set(id, scoreLead({
        reports: (rp.data ?? []).filter((r) => r.lead_id === id).map((r) => ({
          connected: r.connected, duration_seconds: r.duration_seconds, interest: r.interest,
          evaluation_answers: (r.evaluation_answers && typeof r.evaluation_answers === "object" && !Array.isArray(r.evaluation_answers))
            ? (r.evaluation_answers as Record<string, unknown>) : null,
        })),
        recordings: (rc.data ?? []).filter((r) => r.lead_id === id).map((r) => ({
          duration_seconds: r.duration_seconds, sentiment: r.sentiment as string | null, ai_intent: r.ai_intent, ai_temperature: r.ai_temperature,
        })),
        followUpReasons: (fu.data ?? []).filter((r) => r.lead_id === id).map((r) => r.reason_code),
      }));
    }
  }
  return out;
}

export type NeglectedLead = {
  id: string; name: string | null; phone: string; ownerId: string; ownerName: string;
  reason: "uncontacted" | "overdue_follow_up"; since: string; score: LeadInsightScore;
};

export async function neglectedHighPotential(now = Date.now()): Promise<NeglectedLead[]> {
  const db = await admin();
  const today = dhakaDateOf(now);
  const reasons = new Map<string, { reason: NeglectedLead["reason"]; since: string }>();

  // 1. Overdue follow-ups (> 48h past their time, still open).
  const cutoff = new Date(now - OVERDUE_FOLLOW_UP_HOURS * 3600_000).toISOString();
  const { data: fus } = await db.from("follow_up_events").select("lead_id, scheduled_at, status")
    .lt("scheduled_at", cutoff).not("status", "in", `(${CLOSED_FU.join(",")})`).limit(2000);
  for (const f of fus ?? []) if (f.lead_id && !reasons.has(f.lead_id)) reasons.set(f.lead_id, { reason: "overdue_follow_up", since: f.scheduled_at });

  // 2. Held but untouched for 2+ business days since assignment.
  const held: { id: string }[] = [];
  for (let from = 0; from < 20000; from += 1000) {
    const { data } = await db.from("leads").select("id, call_count, call_attempts, last_call_at")
      .not("assigned_to", "is", null).neq("status", "closed").order("id").range(from, from + 999);
    for (const l of data ?? []) if (!(l.call_count ?? 0) && !(l.call_attempts ?? 0) && !l.last_call_at) held.push(l);
    if (!data || data.length < 1000) break;
  }
  for (const part of chunks(held.map((l) => l.id))) {
    const [{ data: assigns }, { data: reps }] = await Promise.all([
      db.from("lead_assignments").select("lead_id, created_at").in("lead_id", part).order("created_at", { ascending: false }),
      db.from("call_reports").select("lead_id").in("lead_id", part),
    ]);
    const worked = new Set((reps ?? []).map((r) => r.lead_id));
    const latest = new Map<string, string>();
    for (const a of assigns ?? []) if (!latest.has(a.lead_id)) latest.set(a.lead_id, a.created_at);
    for (const [id, at] of latest) {
      if (worked.has(id) || reasons.has(id)) continue;
      if (businessDaysSince(dhakaDateOf(new Date(at).getTime()), today) >= NEGLECT_BUSINESS_DAYS) reasons.set(id, { reason: "uncontacted", since: at });
    }
  }

  const ids = [...reasons.keys()];
  if (!ids.length) return [];
  const scores = await scoreLeads(ids);
  const flagged = ids.filter((id) => scores.get(id)!.highPotential);
  const rows: NeglectedLead[] = [];
  for (const part of chunks(flagged)) {
    const { data: leads } = await db.from("leads").select("id, name, phone_number, assigned_to, status").in("id", part).not("assigned_to", "is", null);
    const owners = [...new Set((leads ?? []).map((l) => l.assigned_to!))];
    const { data: profs } = owners.length ? await db.from("profiles").select("id, name").in("id", owners) : { data: [] };
    const names = new Map((profs ?? []).map((p) => [p.id, p.name]));
    for (const l of leads ?? []) {
      if (l.status === "closed") continue;
      const r = reasons.get(l.id)!;
      rows.push({ id: l.id, name: l.name, phone: l.phone_number, ownerId: l.assigned_to!, ownerName: names.get(l.assigned_to!) ?? "—", reason: r.reason, since: r.since, score: scores.get(l.id)! });
    }
  }
  return rows.sort((a, b) => b.score.total - a.score.total);
}

export type ReassignTarget = { id: string; name: string; presence: string; assignedToday: number; quota: number; available: boolean; why?: string | undefined };

export async function reassignTargets(): Promise<ReassignTarget[]> {
  const pool = await import("@/lib/lead-pool.server");
  const { effectiveQuota } = await import("@/lib/lead-quota");
  const db = await admin();
  const [{ data: agents }, today, extra, plan] = await Promise.all([
    db.from("profiles").select("id, name, presence").eq("role", "agent").eq("is_active", true).eq("approval_status", "approved").order("name"),
    pool.assignedTodayByAgent(pool.dhakaToday()),
    pool.extraGrantsToday(),
    pool.dailyPlan(),
  ]);
  return (agents ?? []).map((a) => {
    const quota = effectiveQuota(plan.perAgent, extra[a.id] ?? 0);
    const assignedToday = today.get(a.id) ?? 0;
    const offline = !a.presence || a.presence === "offline";
    const full = assignedToday >= quota;
    return { id: a.id, name: a.name, presence: a.presence ?? "offline", assignedToday, quota, available: !offline && !full,
      why: offline ? "Off duty (offline)" : full ? "At today's lead capacity" : undefined };
  });
}

export async function reassignLead(input: { leadId: string; toAgentId: string; reason: string; bypassReason?: string | null | undefined; actorLabel: string }) {
  const db = await admin();
  const reason = input.reason.trim();
  if (reason.length < MIN_REASON) throw new Error(`Write a reason of at least ${MIN_REASON} characters`);
  const { data: lead } = await db.from("leads").select("id, assigned_to, status").eq("id", input.leadId).maybeSingle();
  if (!lead) throw new Error("Lead not found");
  if (!lead.assigned_to) throw new Error("This lead is in the pool — use Assign by Agent + Quantity instead");
  if (lead.assigned_to === input.toAgentId) throw new Error("Lead already belongs to this agent");

  const target = (await reassignTargets()).find((t) => t.id === input.toAgentId);
  if (!target) throw new Error("Target is not an active, approved agent");
  if (!target.available) throw new Error(`Cannot reassign: ${target.why}`);

  const { count: recalled } = await db.from("lead_neglect_recalls").select("id", { count: "exact", head: true })
    .eq("lead_id", lead.id).eq("agent_id", input.toAgentId);
  if (recalled) throw new Error("This lead was recalled from that agent for neglect");

  const nowIso = new Date().toISOString();
  const [{ count: visits }, { count: bookings }] = await Promise.all([
    db.from("site_visits").select("id", { count: "exact", head: true }).eq("lead_id", lead.id).eq("status", "scheduled").gte("visit_at", nowIso),
    db.from("bookings").select("id", { count: "exact", head: true }).eq("lead_id", lead.id).neq("status", "cancelled").neq("approval_status", "rejected"),
  ]);
  const blockers = { upcomingVisits: visits ?? 0, activeBookings: bookings ?? 0 };
  const bypass = input.bypassReason?.trim() ?? "";
  if (reassignNeedsBypass(blockers) && bypass.length < MIN_REASON) {
    return { ok: false as const, needsBypass: true as const, ...blockers };
  }

  // Compare-and-set: only move if the owner is still who the coordinator saw.
  const { data: moved, error } = await db.from("leads").update({ assigned_to: input.toAgentId })
    .eq("id", lead.id).eq("assigned_to", lead.assigned_to).select("id");
  if (error) throw new Error(error.message);
  if (!moved?.length) throw new Error("Lead owner changed meanwhile — reload and try again");

  const detail = JSON.stringify({ from: lead.assigned_to, to: input.toAgentId, reason, bypass: bypass || null, blockers, by: input.actorLabel });
  await db.from("lead_assignments").insert({ lead_id: lead.id, from_agent_id: lead.assigned_to, to_agent_id: input.toAgentId, source: "leadhub_reassign", note: reason.slice(0, 500) });
  await db.from("lead_events").insert({ lead_id: lead.id, agent_id: input.toAgentId, kind: "reassigned", detail });
  return { ok: true as const };
}
