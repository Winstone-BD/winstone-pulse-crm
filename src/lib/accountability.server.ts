import {
  ACCOUNTABILITY_START_DATE,
  computeAccountability,
  dhakaDayBounds,
  nextDate,
  type AccountabilityMetrics,
} from "@/lib/accountability";

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

/** Real CRM numbers for one agent on one Dhaka business day. */
export async function measureAgentDay(agentId: string, day: string): Promise<AccountabilityMetrics & { evidence: Record<string, unknown> }> {
  const db = await admin();
  const { start, end } = dhakaDayBounds(day);

  const { data: leads } = await db
    .from("leads")
    .select("id, name, status, work_state, updated_at, assignment_source")
    .eq("assigned_to", agentId)
    .eq("work_date", day)
    .limit(1000);
  const usable = (leads ?? []).filter((l) => l.assignment_source !== "duplicate_skipped");
  const ids = usable.map((l) => l.id);

  const reported = new Set<string>();
  if (ids.length) {
    const { data: reps } = await db
      .from("call_reports")
      .select("lead_id")
      .eq("agent_id", agentId)
      .in("lead_id", ids)
      .gte("created_at", start)
      .lte("created_at", end);
    for (const r of reps ?? []) if (r.lead_id) reported.add(r.lead_id);
  }
  const leadRows = usable.map((l) => ({
    id: l.id,
    completed:
      reported.has(l.id) || (l.work_state === "completed" && l.updated_at <= end) ||
      (l.status !== "pending" && l.updated_at <= end),
  }));

  const { data: fus } = await db
    .from("follow_up_events")
    .select("id, lead_id, customer_name, scheduled_at, status, completed_at")
    .eq("agent_id", agentId)
    .lte("scheduled_at", end)
    .or(`status.eq.upcoming,completed_at.gte.${start}`)
    .limit(1000);
  const due = (fus ?? []).map((f) => ({
    id: f.id,
    handled: f.status === "done" && Boolean(f.completed_at) && String(f.completed_at) <= end,
    scheduled_at: f.scheduled_at,
    customer: f.customer_name,
  }));

  const { count: missed } = await db
    .from("call_reports")
    .select("id", { count: "exact", head: true })
    .eq("agent_id", agentId)
    .is("submitted_at", null)
    .gte("call_started_at", start)
    .lte("call_started_at", end);

  const m = computeAccountability({ leads: leadRows, dueFollowUps: due, missedReports: missed ?? 0 });
  return {
    ...m,
    evidence: {
      measured_at: new Date().toISOString(),
      window: { start, end, timezone: "Asia/Dhaka" },
      pending_lead_ids: leadRows.filter((l) => !l.completed).map((l) => l.id).slice(0, 100),
      overdue_followups: due.filter((f) => !f.handled).slice(0, 50).map((f) => ({ id: f.id, scheduled_at: f.scheduled_at, customer: f.customer })),
    },
  };
}

/**
 * Evaluate one business day for the given agents. Inserts are idempotent
 * (unique agent + date, ignore duplicates), so an approved or held event is
 * never re-flagged. A day on which the agent's queue was locked is skipped.
 */
export async function evaluateDay(day: string, agentIds: string[]): Promise<number> {
  if (!agentIds.length || day < ACCOUNTABILITY_START_DATE) return 0;
  const db = await admin();
  const { data: existing } = await db
    .from("agent_accountability_reviews")
    .select("agent_id, business_date, unlock_for_date, status")
    .in("agent_id", agentIds)
    .or(`business_date.eq.${day},and(unlock_for_date.eq.${day},status.neq.approved)`);
  const skip = new Set((existing ?? []).map((r) => r.agent_id));

  let created = 0;
  for (const agentId of agentIds) {
    if (skip.has(agentId)) continue;
    const m = await measureAgentDay(agentId, day);
    if (!m.flagged) continue;
    const { data, error } = await db
      .from("agent_accountability_reviews")
      .upsert(
        {
          agent_id: agentId,
          business_date: day,
          unlock_for_date: nextDate(day),
          assigned_count: m.assigned,
          eligible_count: m.eligible,
          completed_count: m.completed,
          pending_count: m.pending,
          pending_percent: m.pendingPercent,
          overdue_followups: m.overdueFollowUps,
          missed_reports: m.missedReports,
          trigger_reason: m.reason,
          evidence: m.evidence as never,
          status: "review_required",
          review_history: [
            { action: "flagged", at: new Date().toISOString(), by: "system", note: m.reason },
          ] as never,
        },
        { onConflict: "agent_id,business_date", ignoreDuplicates: true },
      )
      .select("id");
    if (!error && data?.length) {
      created += 1;
      const { logAudit } = await import("@/lib/audit.server");
      await logAudit({
        action: "accountability_flagged",
        entityType: "agent_accountability_review",
        entityId: data[0]!.id,
        actorLabel: "system",
        metadata: { agent_id: agentId, business_date: day, pending_percent: m.pendingPercent },
      });
    }
  }
  return created;
}
