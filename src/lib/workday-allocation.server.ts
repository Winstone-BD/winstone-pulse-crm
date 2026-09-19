/**
 * The authoritative workday allocation state, read straight from the database.
 *
 * Every surface — web dashboard, Executive HQ, the Android agent app — shows
 * these numbers. Nothing is derived on a client, so web and phone can never
 * disagree, and a refresh, a cron rerun or a double tap always converges on the
 * same answer.
 */

import { allocationState, isSpecialWorkday, type AgentAllocationStatus } from "@/lib/workday-allocation";

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

/** Hand-outs that are deliberately protected from automatic reassignment. */
const PROTECTED_SOURCES = ["extra_manual", "manual", "coordinator"];

/**
 * Excess leads that are genuinely safe to hand to another desk:
 * still pending, never called, no call report in flight, no recording, and not
 * a protected manual hand-out. Newest first, so the oldest work stays put.
 */
export async function movableExcessLeadIds(
  agentId: string,
  workDate: string,
  limit: number,
): Promise<string[]> {
  if (limit <= 0) return [];
  const supabaseAdmin = await admin();
  const { data } = await supabaseAdmin
    .from("leads")
    .select("id, assignment_source")
    .eq("assigned_to", agentId)
    .eq("work_date", workDate)
    .eq("work_state", "pending")
    .eq("call_attempts", 0)
    .is("last_call_at", null)
    .order("created_at", { ascending: false })
    .limit(limit * 3 + 50);

  const candidates = (data ?? [])
    .filter((row) => !PROTECTED_SOURCES.includes(row.assignment_source ?? ""))
    .map((row) => row.id);
  if (candidates.length === 0) return [];

  // A lead with any call report (pending = call in flight) or any recording is
  // being worked on — it never moves automatically.
  const [{ data: reports }, { data: recordings }] = await Promise.all([
    supabaseAdmin.from("call_reports").select("lead_id").in("lead_id", candidates),
    supabaseAdmin.from("call_recordings").select("lead_id").in("lead_id", candidates),
  ]);
  const busy = new Set<string>();
  (reports ?? []).forEach((row) => row.lead_id && busy.add(row.lead_id));
  (recordings ?? []).forEach((row) => row.lead_id && busy.add(row.lead_id));

  return candidates.filter((id) => !busy.has(id)).slice(0, limit);
}

type LeadRow = {
  id: string;
  assigned_to: string | null;
  work_state: string;
  assignment_source: string | null;
  carried_from_date: string | null;
  call_attempts: number | null;
  last_call_at: string | null;
};

async function boardLeads(workDate: string): Promise<LeadRow[]> {
  const supabaseAdmin = await admin();
  const rows: LeadRow[] = [];
  for (let from = 0; ; from += 1000) {
    const { data } = await supabaseAdmin
      .from("leads")
      .select(
        "id, assigned_to, work_state, assignment_source, carried_from_date, call_attempts, last_call_at",
      )
      .eq("work_date", workDate)
      .not("assigned_to", "is", null)
      .range(from, from + 999);
    rows.push(...((data ?? []) as LeadRow[]));
    if (!data || data.length < 1000) break;
  }
  return rows;
}

export type FloorAllocationStatus = {
  workDate: string;
  /** True only for the single workday the detailed carry-over rule covers. */
  special: boolean;
  floorQuota: number;
  poolAvailable: number;
  /** Leads still needed to bring every desk to its target. */
  requested: number;
  /** Part of that need the database cannot cover. */
  shortage: number;
  agents: (AgentAllocationStatus & { state: "on_target" | "short" | "excess" })[];
  totals: {
    pending: number;
    carriedOver: number;
    newFromDatabase: number;
    reassigned: number;
    completed: number;
    excess: number;
    gap: number;
  };
};

/**
 * One truthful picture of the workday for every active desk. Counts come from
 * the lead rows themselves; movement counts come from the existing assignment
 * history, so a lead is never counted twice.
 */
export async function floorAllocationStatus(workDate: string): Promise<FloorAllocationStatus> {
  const supabaseAdmin = await admin();
  const { activeAgents, dailyPlan, usablePoolCount } = await import("@/lib/lead-pool.server");
  const { quotaFor } = await import("@/lib/lead-quota");

  const [agents, plan, poolAvailable, leads] = await Promise.all([
    activeAgents(),
    dailyPlan(),
    usablePoolCount(),
    boardLeads(workDate),
  ]);

  // Movements recorded today, deduplicated by lead id so one lead counts once.
  const dayStart = new Date(`${workDate}T00:00:00+06:00`).toISOString();
  const dayEnd = new Date(new Date(dayStart).getTime() + 86_400_000).toISOString();
  const { data: moves } = await supabaseAdmin
    .from("lead_assignments")
    .select("lead_id, to_agent_id, from_agent_id, source, created_at")
    .gte("created_at", dayStart)
    .lt("created_at", dayEnd);

  const receivedIn = new Map<string, Set<string>>();
  const movedOut = new Map<string, Set<string>>();
  for (const move of moves ?? []) {
    if (move.source !== "rebalance") continue;
    if (move.to_agent_id) {
      const set = receivedIn.get(move.to_agent_id) ?? new Set<string>();
      set.add(move.lead_id);
      receivedIn.set(move.to_agent_id, set);
    }
    if (move.from_agent_id) {
      const set = movedOut.get(move.from_agent_id) ?? new Set<string>();
      set.add(move.lead_id);
      movedOut.set(move.from_agent_id, set);
    }
  }

  const rows = agents.map((agent) => {
    const quota = quotaFor(agent.employee_id, plan.perAgent);
    const mine = leads.filter((lead) => lead.assigned_to === agent.id);
    const pendingRows = mine.filter((lead) => lead.work_state === "pending");
    const carried = pendingRows.filter((lead) => lead.carried_from_date);
    const carriedFrom = carried
      .map((lead) => lead.carried_from_date!)
      .sort()
      .at(0) ?? null;
    const pending = pendingRows.length;
    // A reassigned lead belongs to the receiving desk only from the moment of
    // the hand-over, so it is counted here and not on the donor's list.
    const received = receivedIn.get(agent.id)?.size ?? 0;
    const status: AgentAllocationStatus = {
      agentId: agent.id,
      name: agent.name,
      employeeId: agent.employee_id ?? null,
      quota,
      pending,
      carriedOver: carried.length,
      carriedFrom,
      newFromDatabase: pendingRows.filter(
        (lead) => !lead.carried_from_date && lead.assignment_source === "lead_database",
      ).length,
      receivedFromOthers: received,
      movedToOthers: movedOut.get(agent.id)?.size ?? 0,
      completed: mine.filter((lead) => lead.work_state === "completed").length,
      excess: Math.max(0, pending - quota),
      gap: Math.max(0, quota - pending),
    };
    return { ...status, state: allocationState(status) };
  });

  const requested = rows.reduce((sum, row) => sum + row.gap, 0);
  return {
    workDate,
    special: isSpecialWorkday(workDate),
    floorQuota: plan.perAgent,
    poolAvailable,
    requested,
    shortage: Math.max(0, requested - poolAvailable),
    agents: rows,
    totals: {
      pending: rows.reduce((s, r) => s + r.pending, 0),
      carriedOver: rows.reduce((s, r) => s + r.carriedOver, 0),
      newFromDatabase: rows.reduce((s, r) => s + r.newFromDatabase, 0),
      reassigned: rows.reduce((s, r) => s + r.receivedFromOthers, 0),
      completed: rows.reduce((s, r) => s + r.completed, 0),
      excess: rows.reduce((s, r) => s + r.excess, 0),
      gap: requested,
    },
  };
}

/**
 * HQ / IT Console notice for states that need a human: unresolved excess that
 * could not be handed over, or a database shortage. Successful top-ups are
 * silent, and the same day's notice is written once only.
 */
export async function notifyAllocationProblems(status: FloorAllocationStatus): Promise<boolean> {
  const stuck = status.agents.filter((row) => row.excess > 0);
  if (stuck.length === 0 && status.shortage === 0) return false;

  const supabaseAdmin = await admin();
  const code = stuck.length > 0 ? "lead_excess_dispute" : "lead_pool_low";
  const { data: existing } = await supabaseAdmin
    .from("system_alerts")
    .select("id")
    .eq("code", code)
    .gte("created_at", new Date(`${status.workDate}T00:00:00+06:00`).toISOString())
    .is("acknowledged_at", null)
    .limit(1);
  if (existing && existing.length > 0) return false;

  const detail =
    stuck.length > 0
      ? `${stuck.map((row) => `${row.name}: ${row.excess}টি অতিরিক্ত`).join(", ")}। এগুলো কারও কাছে সরানো যায়নি — হয় সবাই লক্ষ্যের উপরে, নয় লিডগুলোতে কাজ শুরু হয়ে গেছে।`
      : `আজ ${status.requested}টি লিড দরকার, ডেটাবেজে ${status.poolAvailable}টি আছে — ${status.shortage}টি কম।`;

  await supabaseAdmin.from("system_alerts").insert({
    code,
    severity: "warning",
    title:
      stuck.length > 0
        ? `অতিরিক্ত পেন্ডিং লিড মীমাংসা হয়নি — ${status.totals.excess}টি`
        : `হেড ডেটাবেজে লিড কম — ${status.shortage}টি ঘাটতি`,
    detail,
    action:
      stuck.length > 0
        ? "IT Console → লিড ডেটাবেজ: অতিরিক্ত লিড হাতে বণ্টন করুন বা কোটা পুনর্বিবেচনা করুন"
        : "হেড অফিস থেকে নতুন লিড আপলোড করুন",
  });
  return true;
}
