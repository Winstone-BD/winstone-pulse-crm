/**
 * Daily lead rescue sweep — nothing on a desk is allowed to rot.
 *
 * Runs right before the daily hand-out. It looks only at stored facts and
 * returns two kinds of lead to the head database:
 *   - called the maximum number of times, nobody ever answered;
 *   - sat on a desk for STALE_DESK_DAYS with not a single call attempt.
 *
 * The move is bounded (one batch per run), idempotent (a lead already back in
 * the database no longer matches), written to the lead's own history and to the
 * audit log, and surfaced to the coordinator as one alert per Dhaka day.
 */

import { rescueDecision, summarizeRescue, type RescueLead } from "@/lib/lead-rescue";

const BATCH = 300;

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

function toRescueLead(row: {
  id: string;
  work_state: string | null;
  work_date: string | null;
  call_attempts: number | null;
  last_call_at: string | null;
  retry_after: string | null;
  unanswered_attempts: number | null;
  assigned_to: string | null;
}): RescueLead {
  return {
    id: row.id,
    workState: row.work_state,
    workDate: row.work_date,
    callAttempts: row.call_attempts,
    lastCallAt: row.last_call_at,
    retryAfter: row.retry_after,
    unansweredAttempts: row.unanswered_attempts,
    assignedTo: row.assigned_to,
  };
}

export type RescueSweepResult = {
  today: string;
  inspected: number;
  returnedToPool: number;
  working: number;
  retryWait: number;
  retryDue: number;
  stale: number;
  exhausted: number;
};

export async function sweepLeadRescue(today: string): Promise<RescueSweepResult> {
  const supabaseAdmin = await admin();

  const { data } = await supabaseAdmin
    .from("leads")
    .select(
      "id, work_state, work_date, call_attempts, last_call_at, retry_after, unanswered_attempts, assigned_to",
    )
    .not("assigned_to", "is", null)
    .neq("work_state", "completed")
    .order("work_date", { ascending: true })
    .limit(2000);

  const leads = (data ?? []).map(toRescueLead);
  const summary = summarizeRescue(leads, { today });

  const { logLeadEvent } = await import("@/lib/lead-events.server");
  const { logAudit } = await import("@/lib/audit.server");

  let returned = 0;
  for (const lead of leads) {
    if (returned >= BATCH) break;
    const decision = rescueDecision(lead, { today });
    if (!decision.returnToPool) continue;

    // Guarded update: a lead somebody already pulled back no longer matches.
    const { data: moved } = await supabaseAdmin
      .from("leads")
      .update({
        assigned_to: null,
        assigned_agent_id: null,
        work_state: "pending",
        retry_after: null,
        assignment_source: "rescued_pool",
      })
      .eq("id", lead.id)
      .not("assigned_to", "is", null)
      .select("id");
    if ((moved ?? []).length === 0) continue;
    returned += 1;

    await logLeadEvent({
      leadId: lead.id,
      agentId: lead.assignedTo,
      kind: "workday_moved",
      detail: decision.reason,
    });
    await logAudit({
      action: "lead_rescued_to_pool",
      entityType: "lead",
      entityId: lead.id,
      actorLabel: "স্বয়ংক্রিয় লিড উদ্ধার",
      metadata: { state: decision.state, reason: decision.reason, from: lead.assignedTo },
    });
  }

  if (returned > 0) {
    const code = "lead_rescued_to_pool";
    const { data: existing } = await supabaseAdmin
      .from("system_alerts")
      .select("id")
      .eq("code", code)
      .gte("created_at", `${today}T00:00:00+06:00`)
      .limit(1);
    if ((existing ?? []).length === 0) {
      await supabaseAdmin.from("system_alerts").insert({
        code,
        severity: "warning",
        title: "কিছু লিড ডেটাবেজে ফিরিয়ে আনা হয়েছে",
        detail: `${returned}টি লিড কাজ হচ্ছিল না (বারবার ধরেনি বা দিনের পর দিন কল হয়নি) — পরের বণ্টনে অন্য ডেস্কে যাবে।`,
      });
    }
  }

  return {
    today,
    inspected: leads.length,
    returnedToPool: returned,
    working: summary.working,
    retryWait: summary.retryWait,
    retryDue: summary.retryDue,
    stale: summary.stale,
    exhausted: summary.exhausted,
  };
}
