/**
 * The head lead database engine.
 *
 * Head office leads wait unassigned in `leads`. Every working day the same
 * number of them goes to each active agent — oldest first — and the rest stay in
 * the database for the following days. Nothing is deleted and every hand-over is
 * written to the lead's own history.
 *
 * Duplicate protection is the core rule here:
 *   - a lead row leaves the database only once (the update is guarded by
 *     `assigned_to IS NULL`), so two agents can never receive the same row;
 *   - a phone number that already sits in somebody's list is never handed out
 *     again — the duplicate row is parked as `duplicate_skipped` so tomorrow's
 *     run does not look at it either;
 *   - duplicates inside the database itself are collapsed the same way.
 */

import { extractBangladeshPhones } from "@/lib/lead-phone";

/** Today in Dhaka — the working day a distributed lead belongs to. */
export function dhakaToday(): string {
  return new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

const DUPLICATE = "duplicate_skipped";
/** Rows still usable by the daily hand-out (not parked as duplicates). */
const USABLE = `assignment_source.is.null,assignment_source.neq.${DUPLICATE}`;

/** Canonical keys for every Bangladesh mobile found in one lead value. */
function phoneKeys(raw: string | null | undefined): string[] {
  return extractBangladeshPhones(raw ?? "");
}

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

export type PoolAgent = { id: string; name: string; employee_id?: string | null };

export async function activeAgents(): Promise<PoolAgent[]> {
  const supabaseAdmin = await admin();
  const { data } = await supabaseAdmin
    .from("profiles")
    .select("id, name, employee_id")
    .eq("role", "agent")
    .eq("is_active", true)
    .eq("approval_status", "approved")
    .order("name");
  return data ?? [];
}

/** How many leads are still usable in the database. */
export async function usablePoolCount(): Promise<number> {
  const supabaseAdmin = await admin();
  const { data } = await supabaseAdmin
    .from("leads")
    .select("id")
    .is("assigned_to", null)
    .is("assigned_agent_id", null)
    .or(USABLE)
    .limit(20000);
  const { eligibleLeadIds } = await import("@/lib/lead-eligibility.server");
  return (await eligibleLeadIds((data ?? []).map((row) => row.id))).length;
}

/** Every phone number that already belongs to an agent. */
async function assignedPhoneKeys(): Promise<Set<string>> {
  const supabaseAdmin = await admin();
  const keys = new Set<string>();
  for (let from = 0; ; from += 1000) {
    const { data } = await supabaseAdmin
      .from("leads")
      .select("phone_number")
      .not("assigned_to", "is", null)
      .range(from, from + 999);
    (data ?? []).forEach((row) => phoneKeys(row.phone_number).forEach((key) => keys.add(key)));
    if (!data || data.length < 1000) break;
  }
  return keys;
}

export type DistributionResult = {
  moved: number;
  agents: number;
  perAgent: number;
  duplicatesSkipped: number;
  remaining: number;
  /** True when the database cannot cover another full round tomorrow. */
  shortage: boolean;
  /** How many more leads head office needs for one more full round. */
  shortfall: number;
  workDate: string;
  /** True when every desk already held its full quota, so nothing moved. */
  alreadyComplete: boolean;
  /** Desks that were topped up to their quota by this run. */
  toppedUp: { agentId: string; name: string; quota: number; had: number; given: number }[];
};

/** Today's run ledger row — the idempotency record and allocation cursor. */
export async function distributionRun(workDate: string = dhakaToday()) {
  const supabaseAdmin = await admin();
  const { data } = await supabaseAdmin
    .from("lead_distribution_runs")
    .select("*")
    .eq("work_date", workDate)
    .maybeSingle();
  return data;
}

/**
 * Day rollover: unfinished (pending) leads from earlier working days become
 * today's task. The lead stays with the same agent — only its listed working
 * day moves forward, so yesterday's leftovers appear on today's board.
 * Safe to call repeatedly; leads already on today are untouched.
 */
export async function rolloverPendingLeads(workDate: string = dhakaToday()): Promise<number> {
  const supabaseAdmin = await admin();
  const { data } = await supabaseAdmin
    .from("leads")
    .update({ work_date: workDate })
    .eq("work_state", "pending")
    .lt("work_date", workDate)
    .select("id");
  return (data ?? []).length;
}

/**
 * Today's open workload per desk: every lead sitting on today's board that is
 * still unfinished (pending) — carried-over leftovers AND leads handed out
 * earlier today alike. The daily run counts this against the quota first, so
 * pending work is always served before new database leads, and a desk with a
 * heavy backlog takes fewer (or no) new leads while a light desk is topped up
 * to the same round number.
 */
async function openWorkloadByAgent(workDate: string): Promise<Map<string, number>> {
  const supabaseAdmin = await admin();
  const counts = new Map<string, number>();
  for (let from = 0; ; from += 1000) {
    const { data } = await supabaseAdmin
      .from("leads")
      .select("assigned_to")
      .eq("work_date", workDate)
      .eq("work_state", "pending")
      .not("assigned_to", "is", null)
      .range(from, from + 999);
    (data ?? []).forEach((row) => {
      if (!row.assigned_to) return;
      counts.set(row.assigned_to, (counts.get(row.assigned_to) ?? 0) + 1);
    });
    if (!data || data.length < 1000) break;
  }
  return counts;
}


/**
 * Hands `perAgent` database leads to every active agent for today.
 * Safe to call twice — a lead already taken is never taken again.
 */
export async function distributeDailyLeads(options: {
  perAgent: number;
  actorProfileId?: string | null;
  actorLabel?: string;
  trigger: "manual" | "daily_auto";
}): Promise<DistributionResult> {
  const supabaseAdmin = await admin();
  const today = dhakaToday();
  const agents = await activeAgents();
  if (agents.length === 0) throw new Error("চালু কোনো এজেন্ট নেই");

  // Each desk has its own daily quota: the floor-wide round, unless that person
  // runs on a fixed lighter quota (Sell Team Admin).
  const { quotaFor } = await import("@/lib/lead-quota");
  const quotas = new Map(agents.map((a) => [a.id, quotaFor(a.employee_id, options.perAgent)]));

  // Idempotency: what each desk already holds for today is subtracted from its
  // quota, so a second run (cron retry, double click) only fills real gaps.
  const held = await assignedTodayByAgent(today);
  const shortfallByAgent = new Map<string, number>();
  for (const agent of agents) {
    const quota = quotas.get(agent.id) ?? options.perAgent;
    shortfallByAgent.set(agent.id, Math.max(0, quota - (held.get(agent.id) ?? 0)));
  }
  const need = [...shortfallByAgent.values()].reduce((sum, value) => sum + value, 0);
  const fullRound = agents.reduce((sum, a) => sum + (quotas.get(a.id) ?? options.perAgent), 0);

  const run = await distributionRun(today);
  if (need === 0) {
    const remainingNow = await usablePoolCount();
    return {
      moved: 0,
      agents: agents.length,
      perAgent: options.perAgent,
      duplicatesSkipped: 0,
      remaining: remainingNow,
      shortage: remainingNow < fullRound,
      shortfall: Math.max(0, fullRound - remainingNow),
      workDate: today,
      alreadyComplete: true,
      toppedUp: [],
    };
  }

  // The cursor remembers how far down the (oldest-first) database the engine got,
  // so a run does not re-scan rows it already walked past. It is a hint only —
  // when the cursor window cannot cover today's need, the full pool is read.
  const cursor = run?.cursor_created_at ?? null;
  async function readPool(fromCursor: string | null) {
    let query = supabaseAdmin
      .from("leads")
      .select("id, name, phone_number, created_at")
      .is("assigned_to", null)
      .is("assigned_agent_id", null)
      .or(USABLE);
    if (fromCursor) query = query.gte("created_at", fromCursor);
    const { data } = await query
      .order("created_at", { ascending: true })
      .limit(Math.min(need * 3 + 200, 6000));
    return data ?? [];
  }
  let pool = await readPool(cursor);
  if (cursor && pool.length < need) pool = await readPool(null);

  const taken = await assignedPhoneKeys();
  const { eligibleLeadIds } = await import("@/lib/lead-eligibility.server");
  const databaseEligible = new Set(await eligibleLeadIds(pool.map((lead) => lead.id)));
  const seen = new Set<string>();
  const usable: { id: string; createdAt: string }[] = [];
  const duplicates: string[] = [];

  for (const lead of pool) {
    const keys = phoneKeys(lead.phone_number);
    if (keys.length === 0 || !databaseEligible.has(lead.id)) {
      duplicates.push(lead.id);
      continue;
    }
    if (keys.some((key) => taken.has(key) || seen.has(key))) {
      duplicates.push(lead.id);
      continue;
    }
    keys.forEach((key) => seen.add(key));
    if (usable.length < need) usable.push({ id: lead.id, createdAt: lead.created_at });
  }

  // Park duplicates so they never come up again, and so the database count is honest.
  for (let start = 0; start < duplicates.length; start += 200) {
    await supabaseAdmin
      .from("leads")
      .update({ assignment_source: DUPLICATE })
      .in("id", duplicates.slice(start, start + 200))
      .is("assigned_to", null);
  }

  if (usable.length === 0 && duplicates.length === 0) {
    throw new Error("ডেটাবেজে অ্যাসাইন করার মতো কোনো নতুন লিড নেই");
  }

  // Round-robin, oldest first, so an incomplete batch is still fair. Each desk
  // stops at ITS OWN remaining gap, so a lighter desk never takes a full round
  // and a desk that already has today's leads takes nothing.
  const slots: PoolAgent[] = [];
  const maxGap = Math.max(0, ...agents.map((a) => shortfallByAgent.get(a.id) ?? 0));
  for (let round = 0; round < maxGap; round += 1) {
    for (const agent of agents) {
      if (round < (shortfallByAgent.get(agent.id) ?? 0)) slots.push(agent);
    }
  }

  const buckets = new Map<string, { name: string; leadIds: string[] }>();
  usable.forEach((lead, index) => {
    const agent = slots[index];
    if (!agent) return;
    const bucket = buckets.get(agent.id) ?? { name: agent.name, leadIds: [] };
    bucket.leadIds.push(lead.id);
    buckets.set(agent.id, bucket);
  });
  const cursorCreatedAt = usable.length
    ? usable.map((lead) => lead.createdAt).sort().at(-1)!
    : (cursor ?? null);

  const CHUNK = 100;
  let moved = 0;
  for (const [agentId, bucket] of buckets) {
    for (let start = 0; start < bucket.leadIds.length; start += CHUNK) {
      const ids = bucket.leadIds.slice(start, start + CHUNK);
      const { data: updated, error } = await supabaseAdmin
        .from("leads")
        .update({
          assigned_to: agentId,
          assigned_agent_id: agentId,
          assignment_source: "lead_database",
          work_date: today,
        })
        .in("id", ids)
        .is("assigned_to", null)
        .is("assigned_agent_id", null)
        .select("id");
      if (error) continue;
      const takenIds = (updated ?? []).map((row) => row.id);
      if (takenIds.length === 0) continue;
      moved += takenIds.length;

      await supabaseAdmin.from("lead_assignments").insert(
        takenIds.map((leadId) => ({
          lead_id: leadId,
          from_agent_id: null,
          to_agent_id: agentId,
          source: "lead_database",
          note: `হেড ডেটাবেজ থেকে ${bucket.name} — ${today}`,
        })),
      );
      await supabaseAdmin.from("lead_events").insert(
        takenIds.map((leadId) => ({
          lead_id: leadId,
          agent_id: agentId,
          kind: "workday_moved" as const,
          detail: `হেড ডেটাবেজ থেকে ${bucket.name}-কে দেওয়া হয়েছে (${today})`,
        })),
      );
    }
  }

  const remaining = await usablePoolCount();
  const shortfall = Math.max(0, fullRound - remaining);
  const shortage = remaining < fullRound;

  // Ledger row: one per work date, carrying the cursor forward for tomorrow.
  await supabaseAdmin.from("lead_distribution_runs").upsert(
    {
      work_date: today,
      status: "completed",
      trigger: options.trigger,
      per_agent: options.perAgent,
      moved: (run?.moved ?? 0) + moved,
      duplicates_skipped: (run?.duplicates_skipped ?? 0) + duplicates.length,
      cursor_created_at: cursorCreatedAt,
      cursor_lead_id: null,
      actor_label: options.actorLabel ?? "IT Console",
      actor_profile_id: options.actorProfileId ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "work_date" },
  );

  const toppedUp = [...buckets.entries()].map(([agentId, bucket]) => ({
    agentId,
    name: bucket.name,
    quota: quotas.get(agentId) ?? options.perAgent,
    had: held.get(agentId) ?? 0,
    given: bucket.leadIds.length,
  }));

  const { logAudit } = await import("@/lib/audit.server");
  await logAudit({
    action: "lead_pool_distributed",
    entityType: "lead_pool",
    entityId: today,
    actorProfileId: options.actorProfileId ?? null,
    actorLabel: options.actorLabel ?? "IT Console",
    metadata: {
      perAgent: options.perAgent,
      agents: agents.length,
      moved,
      duplicatesSkipped: duplicates.length,
      remaining,
      trigger: options.trigger,
    },
  });

  if (shortage)
    await raiseShortageAlert({ remaining, need: fullRound, perAgent: options.perAgent });

  return {
    moved,
    agents: agents.length,
    perAgent: options.perAgent,
    duplicatesSkipped: duplicates.length,
    remaining,
    shortage,
    shortfall,
    workDate: today,
    alreadyComplete: false,
    toppedUp,
  };
}

/**
 * One alert per day for Executive HQ and the IT Console when the database can no
 * longer cover a full round tomorrow.
 */
export async function raiseShortageAlert(input: {
  remaining: number;
  need: number;
  perAgent: number;
}) {
  const supabaseAdmin = await admin();
  const today = dhakaToday();
  const { data: existing } = await supabaseAdmin
    .from("system_alerts")
    .select("id")
    .eq("code", "lead_pool_low")
    .gte("created_at", `${today}T00:00:00Z`)
    .is("acknowledged_at", null)
    .limit(1);
  if (existing && existing.length > 0) return;

  await supabaseAdmin.from("system_alerts").insert({
    code: "lead_pool_low",
    severity: "warning",
    title: `হেড ডেটাবেজে লিড কমে এসেছে — বাকি ${input.remaining}টি`,
    detail: `আগামীকাল প্রত্যেক এজেন্টকে ${input.perAgent}টি করে দিতে ${input.need}টি লিড দরকার, ডেটাবেজে আছে ${input.remaining}টি।`,
    action: "হেড অফিস থেকে নতুন লিড আপলোড করুন (IT Console → লিড ডেটাবেজ)",
  });
}

/** How many leads each agent gets on the automatic daily run. */
export async function dailyPlan(): Promise<{ perAgent: number; lastRunDate: string | null }> {
  const supabaseAdmin = await admin();
  const { data } = await supabaseAdmin
    .from("app_config")
    .select("data")
    .eq("id", "lead_pool_daily")
    .maybeSingle();
  const state = (data?.data ?? {}) as { perAgent?: number; lastRunDate?: string };
  return { perAgent: state.perAgent ?? 25, lastRunDate: state.lastRunDate ?? null };
}

export async function saveDailyPlan(input: { perAgent: number; lastRunDate?: string | null }) {
  const supabaseAdmin = await admin();
  const current = await dailyPlan();
  await supabaseAdmin.from("app_config").upsert({
    id: "lead_pool_daily",
    data: {
      perAgent: input.perAgent,
      lastRunDate: input.lastRunDate ?? current.lastRunDate,
    },
    updated_at: new Date().toISOString(),
  });
}

/**
 * Extra leads on top of somebody's base daily quota.
 *
 * The base round is untouched: the person's default quota never changes, the
 * extra batch is recorded separately in `lead_extra_grants` so performance
 * screens can show "base 15 + extra 5" honestly. Same duplicate protection as
 * the daily run — only eligible, unassigned, non-duplicate rows move, and the
 * `assigned_to IS NULL` guard makes a double click harmless.
 */
export async function grantExtraLeads(input: {
  agentProfileId: string;
  quantity: number;
  reason?: string | null;
  actorProfileId?: string | null;
  actorLabel?: string | null;
}): Promise<{ moved: number; remaining: number; workDate: string }> {
  const supabaseAdmin = await admin();
  const today = dhakaToday();

  const { data: agent } = await supabaseAdmin
    .from("profiles")
    .select("id, name, is_active, approval_status")
    .eq("id", input.agentProfileId)
    .maybeSingle();
  if (!agent || !agent.is_active || agent.approval_status !== "approved") {
    throw new Error("এই এজেন্ট সক্রিয় নয়");
  }

  const { data: pool } = await supabaseAdmin
    .from("leads")
    .select("id, phone_number, created_at")
    .is("assigned_to", null)
    .is("assigned_agent_id", null)
    .or(USABLE)
    .order("created_at", { ascending: true })
    .limit(Math.min(input.quantity * 4 + 100, 4000));

  const taken = await assignedPhoneKeys();
  const { eligibleLeadIds } = await import("@/lib/lead-eligibility.server");
  const eligible = new Set(await eligibleLeadIds((pool ?? []).map((lead) => lead.id)));
  const seen = new Set<string>();
  const picked: string[] = [];

  for (const lead of pool ?? []) {
    if (picked.length >= input.quantity) break;
    const keys = phoneKeys(lead.phone_number);
    if (keys.length === 0 || !eligible.has(lead.id)) continue;
    if (keys.some((key) => taken.has(key) || seen.has(key))) continue;
    keys.forEach((key) => seen.add(key));
    picked.push(lead.id);
  }
  if (picked.length === 0) throw new Error("ডেটাবেজে দেওয়ার মতো নতুন লিড নেই");

  let moved = 0;
  for (let start = 0; start < picked.length; start += 100) {
    const ids = picked.slice(start, start + 100);
    const { data: updated } = await supabaseAdmin
      .from("leads")
      .update({
        assigned_to: input.agentProfileId,
        assigned_agent_id: input.agentProfileId,
        assignment_source: "extra_manual",
        work_date: today,
      })
      .in("id", ids)
      .is("assigned_to", null)
      .is("assigned_agent_id", null)
      .select("id");
    const takenIds = (updated ?? []).map((row) => row.id);
    if (takenIds.length === 0) continue;
    moved += takenIds.length;

    await supabaseAdmin.from("lead_assignments").insert(
      takenIds.map((leadId) => ({
        lead_id: leadId,
        from_agent_id: null,
        to_agent_id: input.agentProfileId,
        source: "extra_manual",
        note: `অতিরিক্ত লিড — ${input.actorLabel ?? "IT Console"} (${today})`,
      })),
    );
    await supabaseAdmin.from("lead_events").insert(
      takenIds.map((leadId) => ({
        lead_id: leadId,
        agent_id: input.agentProfileId,
        kind: "extra_lead_granted" as const,
        detail: `অতিরিক্ত লিড দেওয়া হয়েছে (${today}) — ${input.reason ?? "কারণ লেখা হয়নি"}`,
      })),
    );
  }

  await supabaseAdmin.from("lead_extra_grants").insert({
    agent_profile_id: input.agentProfileId,
    work_date: today,
    quantity: moved,
    reason: input.reason ?? null,
    source: "manual_extra",
    granted_by: input.actorProfileId ?? null,
    granted_by_label: input.actorLabel ?? "IT Console",
  });

  const { logAudit } = await import("@/lib/audit.server");
  await logAudit({
    action: "extra_leads_granted",
    entityType: "lead_pool",
    entityId: input.agentProfileId,
    actorProfileId: input.actorProfileId ?? null,
    actorLabel: input.actorLabel ?? "IT Console",
    metadata: {
      agent: agent.name,
      requested: input.quantity,
      moved,
      reason: input.reason ?? null,
      workDate: today,
    },
  });

  return { moved, remaining: await usablePoolCount(), workDate: today };
}

/** Extra leads handed out today, per agent — shown next to the base quota. */
export async function extraGrantsToday(): Promise<Record<string, number>> {
  const supabaseAdmin = await admin();
  const { data } = await supabaseAdmin
    .from("lead_extra_grants")
    .select("agent_profile_id, quantity")
    .eq("work_date", dhakaToday());
  const totals: Record<string, number> = {};
  for (const row of data ?? []) {
    totals[row.agent_profile_id] = (totals[row.agent_profile_id] ?? 0) + row.quantity;
  }
  return totals;
}
