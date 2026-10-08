import { FOLLOW_UP_REASON_CODES } from "@/lib/follow-up-reasons";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/**
 * Web-side entry points for the mandatory post-call workflow and the follow-up
 * calendar. Both the web desk and the Android app go through the same server
 * helpers in call-reports.server.ts, so the invariant is identical everywhere.
 */

const Base = z.object({ adminToken: z.string().nullable().optional() });

async function agentOf(adminToken: string | null) {
  const { resolveCaller } = await import("@/lib/access.server");
  const caller = await resolveCaller(adminToken);
  if (caller.scope === "none" || !caller.profile) {
    throw new Error("অনুমোদিত অ্যাকাউন্ট দিয়ে সাইন ইন করুন");
  }
  return caller.profile;
}

/**
 * The agent's open post-call report, with the AI suggestion when ready.
 *
 * This one polls on every page, so a signed-out visitor is answered quietly
 * with "no report" instead of an error toast.
 */
export const myPendingReport = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => Base.parse(input))
  .handler(async ({ data }) => {
    const { resolveCaller } = await import("@/lib/access.server");
    const caller = await resolveCaller(data.adminToken ?? null);
    if (caller.scope === "none" || !caller.profile) return null;
    const { loadPendingReportDetail } = await import("@/lib/call-reports.server");
    return loadPendingReportDetail(caller.profile.id);
  });

/** Gate before dialling: refuses while a report is unfinished. */
export const startMyCall = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => Base.extend({ leadId: z.string().uuid().nullable().optional() }).parse(input))
  .handler(async ({ data }) => {
    const me = await agentOf(data.adminToken ?? null);
    const { requireAgentBriefing } = await import("@/lib/agent-briefing.server");
    const briefingBlock = await requireAgentBriefing(me.id);
    if (briefingBlock) return briefingBlock;
    {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: me2 } = await supabaseAdmin.from("profiles").select("photo_path").eq("id", me.id).maybeSingle();
      if (!me2?.photo_path) {
        return { blocked: true as const, reason: "অ্যাকাউন্টে নিজের পরিষ্কার ছবি যুক্ত করুন, তারপর কল শুরু করা যাবে" };
      }
    }
    const { pendingReportFor } = await import("@/lib/call-reports.server");
    const pending = await pendingReportFor(me.id);
    if (pending) {
      return {
        blocked: true as const,
        reportId: pending.id,
        reason: "আগের কলের রিপোর্ট জমা দিন, তারপর নতুন কল শুরু করা যাবে",
      };
    }

    if (!data.leadId) return { blocked: false as const };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: lead } = await supabaseAdmin
      .from("leads")
      .select("id, name, phone_number, assigned_to, assigned_agent_id")
      .eq("id", data.leadId)
      .maybeSingle();
    if (!lead) throw new Error("লিড পাওয়া যায়নি");
    const { leadNotAssignedTo, LEAD_NOT_YOURS } = await import("@/lib/lead-access.server");
    if (leadNotAssignedTo(lead, me.id)) throw new Error(LEAD_NOT_YOURS);

    const { logLeadEvent } = await import("@/lib/lead-events.server");
    await logLeadEvent({
      leadId: lead.id,
      agentId: me.id,
      kind: "call_started",
      detail: `${me.name} কল শুরু করেছেন`,
    });
    return { blocked: false as const, phone: lead.phone_number, name: lead.name };
  });

/** Call ended on the web desk -> open the durable report. */
export const openMyReport = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    Base.extend({
      leadId: z.string().uuid(),
      durationSeconds: z.number().int().min(0).default(0),
      connected: z.boolean().default(true),
    }).parse(input),
  )
  .handler(async ({ data }) => {
    const me = await agentOf(data.adminToken ?? null);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: lead } = await supabaseAdmin
      .from("leads")
      .select("id, assigned_to")
      .eq("id", data.leadId)
      .maybeSingle();
    if (!lead) throw new Error("লিড পাওয়া যায়নি");
    // Only the lead's owner may open a report for it — never someone else's lead.
    if (lead.assigned_to !== me.id) throw new Error("এই লিড আপনার তালিকায় নেই");
    const { openCallReport } = await import("@/lib/call-reports.server");
    const report = await openCallReport({
      leadId: data.leadId,
      agentId: me.id,
      durationSeconds: data.durationSeconds,
      connected: data.connected,
    });
    return report;
  });

/**
 * Customer called the agent back. Logs the incoming call, claims the lead when
 * it is still unassigned, and opens the mandatory post-call report — the same
 * gate as an outgoing call, so callbacks get category/summary/note/follow-up
 * and land in the spreadsheet like every other report.
 */
export const logIncomingCallback = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    Base.extend({
      leadId: z.string().uuid(),
      durationSeconds: z.number().int().min(0).max(86400).default(0),
    }).parse(input),
  )
  .handler(async ({ data }) => {
    const me = await agentOf(data.adminToken ?? null);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: lead } = await supabaseAdmin
      .from("leads")
      .select("id, name, phone_number, assigned_to")
      .eq("id", data.leadId)
      .maybeSingle();
    if (!lead) throw new Error("লিড পাওয়া যায়নি");
    if (lead.assigned_to && lead.assigned_to !== me.id) {
      throw new Error("এই লিড আপনার তালিকায় নেই");
    }
    if (!lead.assigned_to) {
      await supabaseAdmin
        .from("leads")
        .update({
          assigned_to: me.id,
          assigned_agent_id: me.id,
          assignment_source: "callback_claim",
        })
        .eq("id", lead.id);
    }

    const { data: rec, error } = await supabaseAdmin
      .from("call_recordings")
      .insert({
        lead_id: lead.id,
        agent_id: me.id,
        phone_number: lead.phone_number,
        call_direction: "incoming_callback",
        duration_seconds: data.durationSeconds,
        is_two_sided: false,
        sync_status: "uploaded",
        analysis_status: "not_available",
        call_source: "web_callback",
        call_status: "completed",
        recording_status: "not_available",
        upload_status: "pending",
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    const { openCallReport } = await import("@/lib/call-reports.server");
    const report = await openCallReport({
      leadId: lead.id,
      agentId: me.id,
      recordingId: rec?.id ?? null,
      phoneNumber: lead.phone_number,
      durationSeconds: data.durationSeconds,
      connected: true,
    });

    await supabaseAdmin
      .from("leads")
      .update({ last_call_at: new Date().toISOString() })
      .eq("id", lead.id);

    const { logLeadEvent } = await import("@/lib/lead-events.server");
    await logLeadEvent({
      leadId: lead.id,
      agentId: me.id,
      kind: "call_connected",
      detail: "ক্রেতা ফিরতি কল করেছেন (কলব্যাক)",
    });

    return report;
  });

/**
 * Any call, any number — the universal report gate for the web desk.
 *
 * Incoming, outgoing, a follow-up call, or a number nobody has ever entered:
 * the number is resolved to a lead and CREATED when it is unknown, the call is
 * stored, and the mandatory post-call report is opened. Nothing an agent does on
 * the phone can end without a report waiting in the CRM.
 */
export const logAnyNumberCall = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    Base.extend({
      phoneNumber: z.string().trim().min(5).max(30),
      name: z.string().trim().max(120).nullable().optional(),
      direction: z.enum(["incoming", "outgoing"]).default("incoming"),
      connected: z.boolean().default(true),
      durationSeconds: z.number().int().min(0).max(86400).default(0),
    }).parse(input),
  )
  .handler(async ({ data }) => {
    const me = await agentOf(data.adminToken ?? null);
    await (await import("@/lib/agent-briefing.server")).assertAgentBriefing(me.id);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { normalizeLeadPhone, intakeLead } = await import("@/lib/lead-intake.server");
    const { resolveLeadIdByPhone } = await import("@/lib/lead-eligibility.server");
    const { leadOwnerId } = await import("@/lib/lead-access.server");

    const phone = normalizeLeadPhone(data.phoneNumber);
    // Same number = same lead: an existing lead is reused, never duplicated.
    const status = await resolveLeadIdByPhone(data.phoneNumber, me.id);
    if (status.canonicalPhones.length === 0) throw new Error("সঠিক বাংলাদেশি মোবাইল নম্বর দিন");

    let leadId = status.existingLeadId;
    let createdLead = false;

    if (leadId) {
      const { data: lead } = await supabaseAdmin
        .from("leads")
        .select("id, assigned_to, assigned_agent_id")
        .eq("id", leadId)
        .maybeSingle();
      // An unowned number that called this agent becomes theirs to work.
      if (lead && !leadOwnerId(lead)) {
        await supabaseAdmin
          .from("leads")
          .update({
            assigned_to: me.id,
            assigned_agent_id: me.id,
            assignment_source: data.direction === "outgoing" ? "dialer_claim" : "callback_claim",
          })
          .eq("id", leadId)
          .is("assigned_to", null)
          .is("assigned_agent_id", null);
      }
      // Re-read ownership: a number that belongs to another agent cannot carry this call.
      const { data: owned } = await supabaseAdmin
        .from("leads")
        .select("assigned_to, assigned_agent_id")
        .eq("id", leadId)
        .maybeSingle();
      if (!owned || leadOwnerId(owned) !== me.id) {
        throw new Error("এই নম্বরটি অন্য এজেন্টের লিড — কোঅর্ডিনেটরের সাথে যোগাযোগ করুন");
      }
    } else {
      const intake = await intakeLead({
        name: data.name?.trim() || `${data.direction === "outgoing" ? "কল" : "ফিরতি কল"} ${phone}`,
        phoneNumber: phone,
        ownerId: me.id,
        ownerName: me.name,
        referenceBy: data.direction === "outgoing" ? "ওয়েব থেকে কল" : "কলব্যাক",
        notes:
          data.direction === "outgoing"
            ? "এজেন্ট সরাসরি নম্বরে কল করেছেন (CRM-এ লিড ছিল না)"
            : "ক্রেতা নিজে ফোন করেছেন (CRM-এ লিড ছিল না)",
      });
      leadId = intake.leadId;
      createdLead = !intake.duplicate;
    }

    const { data: rec } = await supabaseAdmin
      .from("call_recordings")
      .insert({
        lead_id: leadId,
        agent_id: me.id,
        phone_number: phone,
        call_direction: data.direction === "outgoing" ? "outgoing" : "incoming_callback",
        duration_seconds: data.durationSeconds,
        is_two_sided: false,
        sync_status: "uploaded",
        analysis_status: "not_available",
        call_source: data.direction === "outgoing" ? "web_manual" : "web_callback",
        call_status: data.connected ? "completed" : "no_answer",
        recording_status: "not_available",
        upload_status: "pending",
      })
      .select("id")
      .maybeSingle();

    const { openCallReport } = await import("@/lib/call-reports.server");
    const report = await openCallReport({
      leadId: leadId!,
      agentId: me.id,
      recordingId: rec?.id ?? null,
      phoneNumber: phone,
      durationSeconds: data.durationSeconds,
      connected: data.connected,
    });

    await supabaseAdmin
      .from("leads")
      .update({ last_call_at: new Date().toISOString() })
      .eq("id", leadId!);

    const { logLeadEvent } = await import("@/lib/lead-events.server");
    await logLeadEvent({
      leadId,
      agentId: me.id,
      kind: data.connected ? "call_connected" : "call_ended",
      detail:
        data.direction === "outgoing"
          ? `${me.name} ${phone} নম্বরে কল করেছেন`
          : `${phone} থেকে ${me.name}-কে কল এসেছে`,
    });

    return { ...report, leadId, createdLead, phone };
  });

export const submitMyReport = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    Base.extend({
      reportId: z.string().uuid(),
      category: z.string().min(2).max(40),
      summary: z.string().trim().max(4000).nullable().optional(),
      note: z.string().trim().max(4000).nullable().optional(),
      reason: z.string().trim().max(2000).nullable().optional(),
      followUpAt: z.string().nullable().optional(),
      followUpReason: z.enum(FOLLOW_UP_REASON_CODES).nullable().optional(),
      followUpReasonNote: z.string().trim().max(120).nullable().optional(),
      reminderMinutes: z.number().int().min(0).max(1440).default(30),
      temperature: z.enum(["hot", "warm", "cold"]).nullable().optional(),
      grade: z.enum(["A", "B", "C", "D"]).nullable().optional(),
      aiDecision: z.enum(["accepted", "edited", "rejected"]).nullable().optional(),
      direction: z.enum(["outgoing", "incoming"]).nullable().optional(),
      callStatus: z.enum(["connected", "no_answer", "busy", "failed"]).nullable().optional(),
      durationSeconds: z.number().int().min(0).max(86400).nullable().optional(),
      followUpNeeded: z.boolean().optional(),
      followUpNote: z.string().trim().max(500).nullable().optional(),
      interest: z.enum(["high", "medium", "low", "fake"]).nullable().optional(),
      requirement: z.string().trim().max(80).nullable().optional(),
      customerResponse: z.string().trim().max(60).nullable().optional(),
      nextAction: z.string().trim().max(60).nullable().optional(),
      noFollowUpReason: z.string().trim().max(60).nullable().optional(),
      smartReasons: z.record(z.string(), z.string().max(300)).nullable().optional(),
      evaluationAnswers: z.record(z.string(), z.boolean()).nullable().optional(),
    }).parse(input),
  )
  .handler(async ({ data }) => {
    const me = await agentOf(data.adminToken ?? null);
    const { requireAgentBriefing } = await import("@/lib/agent-briefing.server");
    const briefingBlock = await requireAgentBriefing(me.id);
    if (briefingBlock) throw new Error(briefingBlock.reason);
    const { submitCallReport } = await import("@/lib/call-reports.server");
    return submitCallReport({
      reportId: data.reportId,
      agentId: me.id,
      category: data.category,
      summary: data.summary ?? null,
      note: data.note ?? null,
      reason: data.reason ?? null,
      followUpAt: data.followUpAt ? new Date(data.followUpAt).toISOString() : null,
      followUpReason: data.followUpReason ?? null,
      followUpReasonNote: data.followUpReasonNote ?? null,
      reminderMinutes: data.reminderMinutes,
      temperature: data.temperature ?? null,
      grade: data.grade ?? null,
      aiDecision: data.aiDecision ?? null,
      direction: data.direction ?? null,
      callStatus: data.callStatus ?? null,
      durationSeconds: data.durationSeconds ?? null,
      followUpNeeded: data.followUpNeeded ?? true,
      followUpNote: data.followUpNote ?? null,
      interest: data.interest ?? null,
      requirement: data.requirement ?? null,
      customerResponse: data.customerResponse ?? null,
      nextAction: data.nextAction ?? null,
      noFollowUpReason: data.noFollowUpReason ?? null,
      smartReasons: data.smartReasons ?? null,
      evaluationAnswers: data.evaluationAnswers ?? null,
    });
  });

/** Calendar + notification feed. Agents see their own, supervisors see the floor. */
export const myFollowUps = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    Base.extend({
      fromIso: z.string().nullable().optional(),
      toIso: z.string().nullable().optional(),
    }).parse(input),
  )
  .handler(async ({ data }) => {
    const { resolveCaller } = await import("@/lib/access.server");
    const caller = await resolveCaller(data.adminToken ?? null);
    if (caller.scope === "none") throw new Error("অনুমোদিত অ্যাকাউন্ট দিয়ে সাইন ইন করুন");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Paged through every matching row — no silent truncation. Agents only get their own.
    const events: import("@/integrations/supabase/types").Database["public"]["Tables"]["follow_up_events"]["Row"][] = [];
    for (let from = 0; ; from += 1000) {
      let query = supabaseAdmin
        .from("follow_up_events")
        .select("*")
        .order("scheduled_at", { ascending: true })
        .order("id")
        .range(from, from + 999);
      if (caller.scope === "agent" && caller.profile) query = query.eq("agent_id", caller.profile.id);
      if (data.fromIso) query = query.gte("scheduled_at", data.fromIso);
      if (data.toIso) query = query.lte("scheduled_at", data.toIso);
      const { data: page, error } = await query;
      if (error) throw new Error(error.message);
      events.push(...(page ?? []));
      if (!page || page.length < 1000) break;
    }

    const now = Date.now();
    const { compareFollowUpPriority } = await import("@/lib/follow-up-priority");
    return (events ?? []).map((event) => {
      const at = new Date(event.scheduled_at).getTime();
      const due = at - (event.reminder_minutes ?? 30) * 60_000;
      const state =
        event.status === "done" ? "done" : at < now ? "overdue" : due <= now ? "due" : "upcoming";
      return { ...event, state } as typeof event & {
        state: "done" | "overdue" | "due" | "upcoming";
      };
    }).sort((a, b) => compareFollowUpPriority(a, b, now));
  });

export const completeFollowUp = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => Base.extend({ eventId: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const me = await agentOf(data.adminToken ?? null);
    await (await import("@/lib/agent-briefing.server")).assertAgentBriefing(me.id);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("follow_up_events")
      .update({ status: "done", completed_at: new Date().toISOString() })
      .eq("id", data.eventId)
      .eq("agent_id", me.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** The agent's own submitted call reports plus the next upcoming follow-ups. */
export const myCallReports = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    Base.extend({ limit: z.number().int().min(1).max(100).optional() }).parse(input),
  )
  .handler(async ({ data }) => {
    const me = await agentOf(data.adminToken ?? null);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: reports } = await supabaseAdmin
      .from("call_reports")
      .select(
        "id, lead_id, status, category, summary, note, reason, follow_up_at, connected, duration_seconds, call_ended_at, submitted_at, recording_id, temperature, grade",
      )
      .eq("agent_id", me.id)
      .order("call_ended_at", { ascending: false })
      .limit(data.limit ?? 50);

    const leadIds = [...new Set((reports ?? []).map((r) => r.lead_id).filter(Boolean))] as string[];
    const { data: leads } = leadIds.length
      ? await supabaseAdmin
          .from("leads")
          .select("id, name, phone_number, company")
          .in("id", leadIds)
      : { data: [] };
    const leadById = new Map((leads ?? []).map((l) => [l.id, l]));

    const nowIso = new Date().toISOString();
    const { data: upcoming } = await supabaseAdmin
      .from("follow_up_events")
      .select(
        "id, lead_id, customer_name, phone_number, category, priority, note, scheduled_at, status",
      )
      .eq("agent_id", me.id)
      .neq("status", "done")
      .order("scheduled_at", { ascending: true })
      .limit(20);

    const { reportEditable } = await import("@/lib/call-reports.server");
    const { compareFollowUpPriority } = await import("@/lib/follow-up-priority");
    return {
      reports: (reports ?? []).map((r) => ({
        ...r,
        lead: leadById.get(r.lead_id ?? "") ?? null,
        editable: r.status === "submitted" && reportEditable(r.call_ended_at),
      })),
      upcoming: [...(upcoming ?? [])].sort((a, b) => compareFollowUpPriority(a, b)),
      overdueCount: (upcoming ?? []).filter((e) => e.scheduled_at < nowIso).length,
    };
  });

/** Field correction on an already submitted update, inside the 09:00–12:45 window. */
export const editMyReport = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    Base.extend({
      reportId: z.string().uuid(),
      category: z.string().min(2).max(40),
      summary: z.string().trim().max(4000).nullable().optional(),
      note: z.string().trim().max(4000).nullable().optional(),
      reason: z.string().trim().max(2000).nullable().optional(),
      followUpAt: z.string().nullable().optional(),
      temperature: z.enum(["hot", "warm", "cold"]).nullable().optional(),
      grade: z.enum(["A", "B", "C", "D"]).nullable().optional(),
    }).parse(input),
  )
  .handler(async ({ data }) => {
    const me = await agentOf(data.adminToken ?? null);
    const { editSubmittedReport } = await import("@/lib/call-reports.server");
    return editSubmittedReport({
      reportId: data.reportId,
      agentId: me.id,
      category: data.category,
      summary: data.summary ?? null,
      note: data.note ?? null,
      reason: data.reason ?? null,
      followUpAt: data.followUpAt ? new Date(data.followUpAt).toISOString() : null,
      temperature: data.temperature ?? null,
      grade: data.grade ?? null,
    });
  });

/**
 * Replays a call attempt that happened while the browser was offline.
 *
 * Idempotent on the client-generated event id: a retry after a dropped
 * connection finds the event already in the lead's timeline and does nothing, so
 * a no-answer attempt and a later callback stay two distinct events and never
 * duplicate.
 */
export const syncOfflineCallEvent = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    Base.extend({
      clientEventId: z.string().min(8).max(64),
      leadId: z.string().uuid(),
      outcome: z.enum(["interested", "follow_up", "not_interested", "wrong_number", "no_answer"]),
      notes: z.string().trim().max(2000).nullable().optional(),
      occurredAt: z.string(),
      durationSeconds: z.number().int().min(0).default(0),
      connected: z.boolean().default(false),
    }).parse(input),
  )
  .handler(async ({ data }) => {
    const me = await agentOf(data.adminToken ?? null);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const marker = `[${data.clientEventId}]`;
    const { data: existing } = await supabaseAdmin
      .from("lead_events")
      .select("id")
      .eq("lead_id", data.leadId)
      .like("detail", `%${marker}%`)
      .maybeSingle();
    if (existing) return { ok: true as const, duplicate: true as const };

    const when = new Date(data.occurredAt);
    const stamp = Number.isNaN(when.getTime()) ? new Date() : when;

    const { data: lead } = await supabaseAdmin
      .from("leads")
      .select("id, call_attempts, last_call_at, notes, assigned_to, assigned_agent_id")
      .eq("id", data.leadId)
      .maybeSingle();
    if (!lead) throw new Error("লিড পাওয়া যায়নি");
    const owner = lead.assigned_to ?? lead.assigned_agent_id;
    if (me.role !== "admin" && owner !== me.id) throw new Error("এই লিড আপনার নয়");

    const trimmed = data.notes?.trim();
    await supabaseAdmin
      .from("leads")
      .update({
        call_attempts: (lead.call_attempts ?? 0) + 1,
        last_call_at:
          !lead.last_call_at || new Date(lead.last_call_at) < stamp
            ? stamp.toISOString()
            : lead.last_call_at,
        outcome_category: data.outcome,
        ...(trimmed
          ? {
              notes: `${lead.notes ? `${lead.notes}\n\n` : ""}[${stamp
                .toISOString()
                .slice(0, 16)
                .replace("T", " ")}] ${trimmed}`,
            }
          : {}),
      })
      .eq("id", data.leadId);

    const { logLeadEvent } = await import("@/lib/lead-events.server");
    await logLeadEvent({
      leadId: data.leadId,
      agentId: me.id,
      kind: data.connected ? "call_connected" : "outcome_logged",
      detail: `অফলাইনে করা কল (${stamp.toLocaleString("bn-BD")}) — ${data.outcome.replace(
        /_/g,
        " ",
      )} · ${data.durationSeconds}s ${marker}`,
    });

    return { ok: true as const, duplicate: false as const };
  });

/**
 * Every call report, filterable, with the lead attached.
 *
 * Agents see their own reports; a coordinator or the authority sees the whole
 * floor. The lead id travels with each row, so the list can open the lead file
 * the report belongs to.
 */
export const listCallReports = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    Base.extend({
      fromIso: z.string().nullable().optional(),
      toIso: z.string().nullable().optional(),
      category: z.string().max(40).nullable().optional(),
      direction: z.enum(["outgoing", "incoming"]).nullable().optional(),
      callState: z.enum(["connected", "not_connected"]).nullable().optional(),
      status: z.enum(["pending", "submitted"]).nullable().optional(),
      agentId: z.string().uuid().nullable().optional(),
      search: z.string().trim().max(60).nullable().optional(),
      limit: z.number().int().min(1).max(500).optional(),
    }).parse(input),
  )
  .handler(async ({ data }) => {
    const { resolveCaller } = await import("@/lib/access.server");
    const caller = await resolveCaller(data.adminToken ?? null);
    // Not signed in: an empty list, never an error screen on a shared page.
    if (caller.scope === "none") return { reports: [], scope: "none" as const, agents: [] };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let query = supabaseAdmin
      .from("call_reports")
      .select(
        "id, lead_id, agent_id, recording_id, phone_number, status, category, summary, note, reason, follow_up_at, connected, duration_seconds, call_ended_at, submitted_at, temperature, grade, interest, requirement, customer_response, next_action, created_at",
      )
      .order("call_ended_at", { ascending: false })
      .limit(data.limit ?? 200);

    // An agent can only ever see their own reports, whatever they ask for.
    if (caller.scope === "agent" && caller.profile) query = query.eq("agent_id", caller.profile.id);
    else if (data.agentId) query = query.eq("agent_id", data.agentId);

    if (data.fromIso) query = query.gte("call_ended_at", data.fromIso);
    if (data.toIso) query = query.lte("call_ended_at", data.toIso);
    if (data.category) query = query.eq("category", data.category);
    if (data.status) query = query.eq("status", data.status);
    if (data.callState) query = query.eq("connected", data.callState === "connected");

    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);

    const leadIds = [...new Set((rows ?? []).map((r) => r.lead_id).filter(Boolean))] as string[];
    const recordingIds = [
      ...new Set((rows ?? []).map((r) => r.recording_id).filter(Boolean)),
    ] as string[];

    const { data: leads } = leadIds.length
      ? await supabaseAdmin
          .from("leads")
          .select("id, name, phone_number, company, status, assigned_to")
          .in("id", leadIds)
      : { data: [] };
    const { data: recordings } = recordingIds.length
      ? await supabaseAdmin
          .from("call_recordings")
          .select("id, call_direction, call_status, audio_url")
          .in("id", recordingIds)
      : { data: [] };
    const { data: agents } = await supabaseAdmin.from("profiles").select("id, name, employee_id");

    const leadById = new Map((leads ?? []).map((l) => [l.id, l]));
    const recById = new Map((recordings ?? []).map((r) => [r.id, r]));
    const agentById = new Map((agents ?? []).map((a) => [a.id, a]));
    const needle = data.search?.trim().toLowerCase() ?? "";

    const { reportEditable } = await import("@/lib/call-reports.server");
    const reports = (rows ?? [])
      .map((row) => {
        const rec = row.recording_id ? recById.get(row.recording_id) : null;
        const lead = leadById.get(row.lead_id ?? "") ?? null;
        return {
          ...row,
          lead,
          agent: agentById.get(row.agent_id ?? "") ?? null,
          direction:
            rec?.call_direction === "incoming_callback"
              ? ("incoming" as const)
              : ("outgoing" as const),
          recordingStatus: rec?.call_status ?? null,
          hasAudio: Boolean(rec?.audio_url),
          editable: row.status === "submitted" && reportEditable(row.call_ended_at),
        };
      })
      .filter((row) => (data.direction ? row.direction === data.direction : true))
      .filter((row) =>
        needle
          ? [row.lead?.name, row.lead?.phone_number, row.phone_number, row.agent?.name]
              .filter(Boolean)
              .some((value) => String(value).toLowerCase().includes(needle))
          : true,
      );

    return {
      reports,
      scope: caller.scope,
      agents: (agents ?? []).map((a) => ({ id: a.id, name: a.name })),
    };
  });

/**
 * Per-lead desk extras: latest reported requirement and the next open
 * follow-up. Agents only ever receive their own leads' rows.
 */
export const myLeadExtras = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => Base.parse(input))
  .handler(async ({ data }) => {
    const { resolveCaller } = await import("@/lib/access.server");
    const caller = await resolveCaller(data.adminToken ?? null);
    if (caller.scope === "none") return [] as { leadId: string; requirement: string | null; nextFollowUpAt: string | null }[];
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const agentId = caller.scope === "agent" ? caller.profile?.id ?? null : null;
    if (caller.scope === "agent" && !agentId) return [];

    let reports = supabaseAdmin
      .from("call_reports")
      .select("lead_id, requirement, submitted_at")
      .eq("status", "submitted")
      .not("requirement", "is", null)
      .order("submitted_at", { ascending: false })
      .limit(2000);
    if (agentId) reports = reports.eq("agent_id", agentId);
    let follows = supabaseAdmin
      .from("follow_up_events")
      .select("lead_id, scheduled_at")
      .neq("status", "done")
      .order("scheduled_at", { ascending: true })
      .limit(2000);
    if (agentId) follows = follows.eq("agent_id", agentId);
    const [r, f] = await Promise.all([reports, follows]);

    const out = new Map<string, { leadId: string; requirement: string | null; nextFollowUpAt: string | null }>();
    const row = (id: string) => {
      const existing = out.get(id) ?? { leadId: id, requirement: null, nextFollowUpAt: null };
      out.set(id, existing);
      return existing;
    };
    for (const rep of r.data ?? []) if (rep.lead_id && !row(rep.lead_id).requirement) row(rep.lead_id).requirement = rep.requirement;
    for (const ev of f.data ?? []) if (ev.lead_id && !row(ev.lead_id).nextFollowUpAt) row(ev.lead_id).nextFollowUpAt = ev.scheduled_at;
    return [...out.values()];
  });

/**
 * Move a follow-up to a new time. Owner agent, coordinator or HQ only;
 * the change and who made it go to lead history and the audit log.
 */
export const rescheduleFollowUp = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    Base.extend({ eventId: z.string().uuid(), scheduledAt: z.string().datetime() }).parse(input),
  )
  .handler(async ({ data }) => {
    const { resolveCaller } = await import("@/lib/access.server");
    const { canReschedule } = await import("@/lib/lead-groups");
    const caller = await resolveCaller(data.adminToken ?? null);
    await (await import("@/lib/agent-briefing.server")).assertBriefingForCaller(caller);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: event } = await supabaseAdmin
      .from("follow_up_events")
      .select("id, agent_id, lead_id, scheduled_at, status")
      .eq("id", data.eventId)
      .maybeSingle();
    if (!event) throw new Error("ফলো-আপ পাওয়া যায়নি");
    if (
      !canReschedule(
        { scope: caller.scope, profileId: caller.profile?.id ?? null, readOnly: caller.readOnly },
        event.agent_id,
      )
    ) {
      throw new Error("এই ফলো-আপ বদলানোর অনুমতি নেই");
    }
    if (event.status === "done") throw new Error("সম্পন্ন ফলো-আপ বদলানো যায় না");
    if (Date.parse(data.scheduledAt) < Date.now() - 60_000) throw new Error("অতীত সময় বেছে নেওয়া যাবে না");

    // Guarded on the old time so two concurrent moves cannot both win.
    const { data: moved, error } = await supabaseAdmin
      .from("follow_up_events")
      .update({ scheduled_at: data.scheduledAt, notified_at: null, status: "upcoming" })
      .eq("id", event.id)
      .eq("scheduled_at", event.scheduled_at)
      .select("id");
    if (error) throw new Error(error.message);
    if (!moved?.length) throw new Error("অন্য কেউ এটি এইমাত্র বদলেছে — আবার চেষ্টা করুন");

    const { logLeadEvent } = await import("@/lib/lead-events.server");
    await logLeadEvent({
      leadId: event.lead_id,
      agentId: caller.profile?.id ?? null,
      kind: "outcome_logged",
      detail: `ফলো-আপ সময় বদল: ${new Date(event.scheduled_at).toLocaleString("bn-BD", { timeZone: "Asia/Dhaka" })} → ${new Date(data.scheduledAt).toLocaleString("bn-BD", { timeZone: "Asia/Dhaka" })}`,
    });
    const { logAudit } = await import("@/lib/audit.server");
    await logAudit({
      action: "follow_up_rescheduled",
      entityType: "follow_up_event",
      entityId: event.id,
      actorProfileId: caller.profile?.id ?? null,
      metadata: { from: event.scheduled_at, to: data.scheduledAt, scope: caller.scope },
    });
    return { ok: true };
  });
