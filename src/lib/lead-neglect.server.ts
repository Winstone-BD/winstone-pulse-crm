/**
 * Neglect sweep (server only). Warns agents on untouched leads for three
 * business days, then recalls the lead to the head pool and records an
 * append-only dispute (lead_neglect_recalls) visible to HQ and the agent.
 * Only zero-work leads are recalled; a lead with any call history is never
 * moved here. Idempotent: notices/recalls are unique per assignment.
 */
import { dhakaDateOf } from "@/lib/business-day";
import { NEGLECT_RECALL_REASON, neglectStage } from "@/lib/lead-neglect";

const IGNORED_EVENT_KINDS = new Set(["workday_moved", "neglect_warning", "neglect_recalled"]);

function chunks<T>(items: T[], size = 200): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

export async function runNeglectSweep(today: string = dhakaDateOf()) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const held: { id: string; name: string | null; owner: string }[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabaseAdmin
      .from("leads")
      .select("id, name, assigned_to, assigned_agent_id, call_count, call_attempts, last_call_at, status")
      .not("assigned_to", "is", null)
      .neq("status", "closed")
      .order("id")
      .range(from, from + 999);
    if (error) throw error;
    for (const l of data ?? []) {
      const owner = l.assigned_to ?? l.assigned_agent_id;
      if (!owner || (l.call_count ?? 0) > 0 || (l.call_attempts ?? 0) > 0 || l.last_call_at) continue;
      held.push({ id: l.id, name: l.name, owner });
    }
    if (!data || data.length < 1000) break;
  }

  const touched = new Set<string>();
  const assignedAt = new Map<string, string>();
  for (const ids of chunks(held.map((l) => l.id))) {
    const [reports, recs, events, assigns] = await Promise.all([
      supabaseAdmin.from("call_reports").select("lead_id").in("lead_id", ids),
      supabaseAdmin.from("call_recordings").select("lead_id").in("lead_id", ids),
      supabaseAdmin.from("lead_events").select("lead_id, kind").in("lead_id", ids),
      supabaseAdmin
        .from("lead_assignments")
        .select("lead_id, to_agent_id, created_at")
        .in("lead_id", ids)
        .order("created_at", { ascending: true }),
    ]);
    for (const r of reports.data ?? []) if (r.lead_id) touched.add(r.lead_id);
    for (const r of recs.data ?? []) if (r.lead_id) touched.add(r.lead_id);
    for (const e of events.data ?? []) if (e.lead_id && !IGNORED_EVENT_KINDS.has(e.kind)) touched.add(e.lead_id);
    for (const a of assigns.data ?? []) assignedAt.set(`${a.lead_id}:${a.to_agent_id}`, a.created_at);
  }

  let notices = 0;
  let recalled = 0;
  for (const lead of held) {
    if (touched.has(lead.id)) continue;
    const at = assignedAt.get(`${lead.id}:${lead.owner}`);
    if (!at) continue; // no assignment trail → never guess
    const stage = neglectStage(dhakaDateOf(new Date(at).getTime()), today);
    if (stage.kind === "none") continue;

    if (stage.kind === "notice") {
      const { error } = await supabaseAdmin.from("lead_neglect_notices").insert({
        lead_id: lead.id,
        agent_id: lead.owner,
        assigned_at: at,
        notice_day: stage.day,
        business_date: today,
      });
      if (!error) {
        notices += 1;
        await supabaseAdmin.from("lead_events").insert({
          lead_id: lead.id,
          agent_id: lead.owner,
          kind: "neglect_warning",
          detail: `অবহেলা সতর্কবার্তা ${stage.day}/২ — এখনো কোনো কল হয়নি`,
        });
      }
      continue;
    }

    // Recall: the dispute row is written first; its unique key makes reruns harmless.
    const { data: dispute, error } = await supabaseAdmin
      .from("lead_neglect_recalls")
      .insert({
        lead_id: lead.id,
        agent_id: lead.owner,
        assigned_at: at,
        business_date: today,
        reason: NEGLECT_RECALL_REASON,
        evidence: { assigned_at: at, calls: 0, reports: 0, recordings: 0, notices: 2 },
      })
      .select("id")
      .maybeSingle();
    if (error || !dispute) continue;

    const { data: freed } = await supabaseAdmin
      .from("leads")
      .update({ assigned_to: null, assigned_agent_id: null, assignment_source: "neglect_recall", work_date: null })
      .eq("id", lead.id)
      .eq("assigned_to", lead.owner)
      .select("id");
    if (!freed?.length) continue;
    recalled += 1;

    await supabaseAdmin.from("lead_assignments").insert({
      lead_id: lead.id,
      from_agent_id: lead.owner,
      to_agent_id: null,
      source: "neglect_recall",
      note: NEGLECT_RECALL_REASON,
    });
    await supabaseAdmin.from("lead_events").insert({
      lead_id: lead.id,
      agent_id: lead.owner,
      kind: "neglect_recalled",
      detail: "অবহেলার কারণে LeadHub Nexus-এ ফেরত",
    });
    const { logAudit } = await import("@/lib/audit.server");
    await logAudit({
      action: "lead_neglect_recalled",
      entityType: "lead",
      entityId: lead.id,
      actorLabel: "Neglect sweep",
      metadata: { agent_id: lead.owner, dispute_id: dispute.id, business_date: today },
    });
  }

  return { today, checked: held.length, notices, recalled };
}

/** True when this lead was ever recalled from this agent for neglect. */
export async function wasRecalledFrom(leadId: string, agentId: string): Promise<boolean> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("lead_neglect_recalls")
    .select("id")
    .eq("lead_id", leadId)
    .eq("agent_id", agentId)
    .limit(1);
  return Boolean(data?.length);
}
