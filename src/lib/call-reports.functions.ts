import { followUpWork } from "@/lib/follow-up-work.server";
import { followUpHealth } from "@/lib/follow-up-lifecycle";
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
  const { resolveWorkCaller } = await import("@/lib/access.server");
  const caller = await resolveWorkCaller(adminToken);
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
      .select("id, assigned_to, assigned_agent_id")
      .eq("id", data.leadId)
      .maybeSingle();
    if (!lead) throw new Error("লিড পাওয়া যায়নি");
    // Only the lead's owner may open a report for it — never someone else's lead.
    if ((lead.assigned_to ?? lead.assigned_agent_id) !== me.id) throw new Error("এই লিড আপনার তালিকায় নেই");
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
      retryPlan: z
        .object({
          mode: z.enum(["plus2", "plus3", "custom"]),
          slot: z.enum(["morning", "afternoon", "evening", "custom"]),
          time: z.string().regex(/^\d{2}:\d{2}$/).nullable().optional(),
          customAt: z.string().max(40).nullable().optional(),
        })
        .nullable()
        .optional(),
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
      retryPlan: data.retryPlan ?? null,
    });
  });

/** Calendar + notification feed. Agents see their own, supervisors see the floor. */
export const myFollowUps = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    Base.extend({
      fromIso: z.string().nullable().optional(),
      toIso: z.string().nullable().optional(),
      activeOnly: z.boolean().optional(),
    }).parse(input),
  )
  .handler(async ({ data }) => {
    const { resolveCaller } = await import("@/lib/access.server");
    const caller = await resolveCaller(data.adminToken ?? null);
    if (caller.scope === "none" || (caller.scope !== "authority" && !caller.profile)) throw new Error("অনুমোদিত অ্যাকাউন্ট দিয়ে সাইন ইন করুন");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Paged through every matching row — no silent truncation. Agents only get their own.
    const events: import("@/integrations/supabase/types").Database["public"]["Tables"]["follow_up_events"]["Row"][] = [];
    for (let from = 0; ; from += 1000) {
      let query = (data.activeOnly ? followUpWork(supabaseAdmin) : supabaseAdmin.from("follow_up_events"))
        .select("*")
        .order("scheduled_at", { ascending: true })
        .order("id")
        .range(from, from + 999);
      if (caller.scope !== "authority" && caller.profile) query = query.eq("agent_id", caller.profile.id);
      if (data.fromIso) query = query.gte("scheduled_at", data.fromIso);
      if (data.toIso) query = query.lte("scheduled_at", data.toIso);
      const { data: page, error } = await query;
      if (error) throw new Error(error.message);
      events.push(...(page ?? []));
      if (!page || page.length < 1000) break;
    }

    let visible = events;
    if (caller.scope !== "authority") {
      const ownIds = new Set<string>();
      for (let from = 0; ; from += 1000) {
        const { data: leads, error } = await supabaseAdmin.from("leads").select("id, assigned_to, assigned_agent_id").or(`assigned_to.eq.${caller.profile?.id},assigned_agent_id.eq.${caller.profile?.id}`).order("id").range(from, from + 999);
        if (error) throw new Error(error.message);
        for (const lead of leads ?? []) if ((lead.assigned_to ?? lead.assigned_agent_id) === caller.profile?.id) ownIds.add(lead.id);
        if (!leads || leads.length < 1000) break;
      }
      visible = events.filter(event => ownIds.has(event.lead_id));
    }
    const now = Date.now();
    const { compareFollowUpPriority } = await import("@/lib/follow-up-priority");
    return visible.map(event => ({ ...event, health: followUpHealth(event, now), state:
      ["done", "completed"].includes(event.status) ? "done" : ["cancelled", "rescheduled"].includes(event.status) ? event.status :
      Date.parse(event.scheduled_at) < now || event.status === "missed" ? "overdue" :
      Date.parse(event.scheduled_at) - (event.reminder_minutes ?? 30) * 60_000 <= now ? "due" : "upcoming"
    })).sort((a, b) => compareFollowUpPriority(a, b, now));
  });

const TransitionInput = Base.extend({ eventId: z.string().uuid(), reason: z.string().trim().min(1).max(2000), key: z.string().uuid() });
export const completeFollowUp = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => TransitionInput.parse(input))
  .handler(async ({ data }) => {
    const caller = await (await import("@/lib/access.server")).resolveWorkCaller(data.adminToken ?? null);
    await (await import("@/lib/agent-briefing.server")).assertBriefingForCaller(caller);
    return (await import("@/lib/follow-up-lifecycle.server")).transitionFollowUp(caller, { ...data, action: "complete" });
  });

export const changeFollowUp = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => TransitionInput.extend({ action: z.enum(["cancel", "miss"]) }).parse(input))
  .handler(async ({ data }) => {
    const caller = await (await import("@/lib/access.server")).resolveWorkCaller(data.adminToken ?? null);
    await (await import("@/lib/agent-briefing.server")).assertBriefingForCaller(caller);
    return (await import("@/lib/follow-up-lifecycle.server")).transitionFollowUp(caller, data);
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

    const { assignedLeadIds, filterAssignedActivity } = await import('@/lib/assigned-lead-scope.server');
    const ownIds = await assignedLeadIds(me.id);
    const visibleReports = filterAssignedActivity(reports ?? [], ownIds);
    const leadIds = [...new Set(visibleReports.map((r) => r.lead_id).filter(Boolean))] as string[];
    const { data: leads } = leadIds.length
      ? await supabaseAdmin
          .from("leads")
          .select("id, name, phone_number, company")
          .in("id", leadIds)
      : { data: [] };
    const leadById = new Map((leads ?? []).map((l) => [l.id, l]));

    const nowIso = new Date().toISOString();
    const { data: upcoming } = await followUpWork(supabaseAdmin)
      .select(
        "id, lead_id, customer_name, phone_number, category, priority, note, scheduled_at, status",
      )
      .eq("agent_id", me.id)
      .in("status", ["upcoming", "due", "missed"])
      .order("scheduled_at", { ascending: true })
      .limit(20);

    const { reportEditable } = await import("@/lib/call-reports.server");
    const { compareFollowUpPriority } = await import("@/lib/follow-up-priority");
    return {
      reports: visibleReports.map((r) => ({
        ...r,
        lead: leadById.get(r.lead_id ?? "") ?? null,
        editable: r.status === "submitted" && reportEditable(r.call_ended_at),
      })),
      upcoming: filterAssignedActivity(upcoming ?? [], ownIds).sort((a, b) => compareFollowUpPriority(a, b)),
      overdueCount: filterAssignedActivity(upcoming ?? [], ownIds).filter((e) => e.scheduled_at < nowIso).length,
    };
  });

/** Gemini brief for one of the agent's own submitted reports (cached per report). */
export const summarizeMyReport = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    Base.extend({ reportId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data }) => {
    const me = await agentOf(data.adminToken ?? null);
    const { briefCallReport } = await import("@/lib/report-summary.server");
    const { supabaseAdmin: db } = await import('@/integrations/supabase/client.server');
    const { data: report } = await db.from('call_reports').select('lead_id, agent_id').eq('id', data.reportId).maybeSingle();
    if (!report || report.agent_id !== me.id) throw new Error('Report not available');
    await (await import('@/lib/assigned-lead-scope.server')).assertAssignedLead(me.id, report.lead_id);
    return briefCallReport(data.reportId, me.id);
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
    const { supabaseAdmin: db } = await import('@/integrations/supabase/client.server');
    const { data: report } = await db.from('call_reports').select('lead_id, agent_id').eq('id', data.reportId).maybeSingle();
    if (!report || report.agent_id !== me.id) throw new Error('Report not available');
    await (await import('@/lib/assigned-lead-scope.server')).assertAssignedLead(me.id, report.lead_id);
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

    const { assignedLeadIds, filterAssignedActivity } = await import('@/lib/assigned-lead-scope.server');
    const scopedRows = caller.scope === 'agent'
      ? filterAssignedActivity(rows ?? [], await assignedLeadIds(caller.profile?.id ?? '')) : rows ?? [];
    const leadIds = [...new Set(scopedRows.map((r) => r.lead_id).filter(Boolean))] as string[];
    const recordingIds = [
      ...new Set(scopedRows.map((r) => r.recording_id).filter(Boolean)),
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
    const reports = scopedRows
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
    let follows = followUpWork(supabaseAdmin)
      .select("lead_id, scheduled_at")
      .in("status", ["upcoming", "due", "missed"])
      .order("scheduled_at", { ascending: true })
      .limit(2000);
    if (agentId) follows = follows.eq("agent_id", agentId);
    const [r, f] = await Promise.all([reports, follows]);
    if (r.error || f.error) throw new Error((r.error ?? f.error)?.message);
    const { assignedLeadIds, filterAssignedActivity } = await import('@/lib/assigned-lead-scope.server');
    const ownIds = agentId ? await assignedLeadIds(agentId) : null;
    const reportRows = ownIds ? filterAssignedActivity(r.data ?? [], ownIds) : r.data ?? [];
    const followRows = ownIds ? filterAssignedActivity(f.data ?? [], ownIds) : f.data ?? [];

    const out = new Map<string, { leadId: string; requirement: string | null; nextFollowUpAt: string | null }>();
    const row = (id: string) => {
      const existing = out.get(id) ?? { leadId: id, requirement: null, nextFollowUpAt: null };
      out.set(id, existing);
      return existing;
    };
    for (const rep of reportRows) if (rep.lead_id && !row(rep.lead_id).requirement) row(rep.lead_id).requirement = rep.requirement;
    for (const ev of followRows) if (ev.lead_id && !row(ev.lead_id).nextFollowUpAt) row(ev.lead_id).nextFollowUpAt = ev.scheduled_at;
    return [...out.values()];
  });

/**
 * Move a follow-up to a new time. Owner agent, coordinator or HQ only;
 * the change and who made it go to lead history and the audit log.
 */
export const rescheduleFollowUp = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => TransitionInput.extend({ scheduledAt: z.string().datetime() }).parse(input))
  .handler(async ({ data }) => {
    const caller = await (await import("@/lib/access.server")).resolveWorkCaller(data.adminToken ?? null);
    await (await import("@/lib/agent-briefing.server")).assertBriefingForCaller(caller);
    return (await import("@/lib/follow-up-lifecycle.server")).transitionFollowUp(caller, { ...data, action: "reschedule" });
  });

export const recoverMissedFollowUp = createServerFn({ method: 'POST' })
  .inputValidator((input: unknown) => TransitionInput.extend({ scheduledAt: z.string().datetime(), nextAction: z.string().trim().min(1).max(2000) }).parse(input))
  .handler(async ({ data }) => {
    const caller = await (await import('@/lib/access.server')).resolveWorkCaller(data.adminToken ?? null);
    await (await import('@/lib/agent-briefing.server')).assertBriefingForCaller(caller);
    return (await import('@/lib/follow-up-lifecycle.server')).recoverFollowUp(caller, data);
  });
