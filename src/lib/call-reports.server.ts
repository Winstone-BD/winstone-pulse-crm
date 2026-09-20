/**
 * The mandatory post-call workflow.
 *
 *   CALL -> ENDS -> POST-CALL REPORT -> CATEGORY -> REQUIRED FIELDS -> SUBMIT -> NEXT LEAD
 *
 * The invariant is enforced in the database, not in the UI: `call_reports` has a
 * partial unique index on (agent_id) WHERE status = 'pending', and a BEFORE
 * trigger validates the category and its conditional required fields whenever a
 * row is submitted. This module is the single server-side entry point used by
 * both the web desk and the Android app, so neither can bypass the rule.
 */

import {
  callEvidence,
  isNotConnectedOutcome,
  TASK_STATE_MESSAGE,
  taskState,
} from "@/lib/call-evidence";
import { nextRetryAt, needsSupervisorDecision, reportTrust } from "@/lib/call-retry";



export const CALL_CATEGORIES = [
  "hot_lead",
  "follow_up",
  "interested",
  "not_interested",
  "callback",
  "no_answer",
  "wrong_number",
  "closed_converted",
] as const;

export type CallCategory = (typeof CALL_CATEGORIES)[number];

export const CATEGORY_LABEL: Record<CallCategory, string> = {
  hot_lead: "HOT LEAD — খুব সম্ভাবনাময়",
  follow_up: "FOLLOW UP — পরে যোগাযোগ",
  interested: "INTERESTED — আগ্রহী",
  not_interested: "NOT INTERESTED — আগ্রহী নয়",
  callback: "CALLBACK — কলব্যাক চেয়েছেন",
  no_answer: "NO ANSWER — ধরেনি",
  wrong_number: "WRONG NUMBER — ভুল নম্বর",
  closed_converted: "CLOSED / CONVERTED — বিক্রি হয়েছে",
};

const LEAD_STATUS_FOR: Record<CallCategory, "pending" | "contacted" | "follow_up" | "closed"> = {
  hot_lead: "follow_up",
  follow_up: "follow_up",
  interested: "contacted",
  not_interested: "closed",
  callback: "follow_up",
  no_answer: "contacted",
  wrong_number: "closed",
  closed_converted: "closed",
};

/**
 * Classification is the business decision on a received call: how warm the
 * customer is, and how valuable the lead is. It is always a human decision —
 * AI may suggest, never write it.
 */
export const LEAD_TEMPERATURES = ["hot", "warm", "cold"] as const;
export const LEAD_GRADES = ["A", "B", "C", "D"] as const;

export type LeadTemperature = (typeof LEAD_TEMPERATURES)[number];
export type LeadGrade = (typeof LEAD_GRADES)[number];

export const TEMPERATURE_LABEL: Record<LeadTemperature, string> = {
  hot: "HOT — এখনই কিনবেন",
  warm: "WARM — আগ্রহ আছে",
  cold: "COLD — এখন নয়",
};

export const GRADE_LABEL: Record<LeadGrade, string> = {
  A: "A — সর্বোচ্চ মান",
  B: "B — ভালো",
  C: "C — সাধারণ",
  D: "D — দুর্বল",
};

export type ReportValidationError = { field: string; message: string };

/**
 * The call facts every report must carry: which way the call went, how it
 * ended, how long it lasted, and what happens next. They are asked in the
 * popup and re-checked here, so a report can never be stored without them.
 */
export const CALL_DIRECTIONS = ["outgoing", "incoming"] as const;
export const CALL_OUTCOME_STATES = ["connected", "no_answer", "busy", "failed"] as const;

export type CallDirection = (typeof CALL_DIRECTIONS)[number];
export type CallOutcomeState = (typeof CALL_OUTCOME_STATES)[number];

export const DIRECTION_LABEL: Record<CallDirection, string> = {
  outgoing: "আউটগোয়িং — এজেন্ট কল করেছেন",
  incoming: "ইনকামিং — ক্রেতা কল করেছেন",
};

export const CALL_STATE_LABEL: Record<CallOutcomeState, string> = {
  connected: "কথা হয়েছে",
  no_answer: "ধরেনি",
  busy: "ব্যস্ত ছিল",
  failed: "কল যায়নি",
};

/** Same rules as the database trigger, so the UI can show them before submit. */
export function validateReport(input: {
  category: string | null;
  summary?: string | null;
  note?: string | null;
  reason?: string | null;
  followUpAt?: string | null;
  /** A received call must be classified; an unanswered one goes back to the retry queue. */
  connected?: boolean;
  temperature?: string | null;
  grade?: string | null;
  /** Set on a fresh submit: direction, call state, duration and follow-up are mandatory. */
  requireCallFacts?: boolean;
  direction?: string | null;
  callStatus?: string | null;
  durationSeconds?: number | null;
  /** false = the agent explicitly says no follow-up is needed, and says why. */
  followUpNeeded?: boolean;
  followUpNote?: string | null;
}): ReportValidationError | null {
  const category = input.category as CallCategory | null;
  if (!category || !CALL_CATEGORIES.includes(category)) {
    return { field: "category", message: "কল ক্যাটেগরি বাছাই করুন" };
  }
  const summary = (input.summary ?? "").trim();
  const note = (input.note ?? "").trim();
  const reason = (input.reason ?? "").trim();

  // Every call, every category: summary + note are mandatory.
  if (summary.length < 2) return { field: "summary", message: "কলের সারাংশ লিখুন" };
  if (note.length < 2) return { field: "note", message: "নোট লিখুন" };

  if ((category === "not_interested" || category === "wrong_number") && !reason) {
    return { field: "reason", message: "কারণ লিখুন" };
  }
  if (input.connected !== false) {
    if (!LEAD_TEMPERATURES.includes((input.temperature ?? "") as LeadTemperature)) {
      return { field: "temperature", message: "কথা হওয়া কলে Hot / Warm / Cold বাছাই করুন" };
    }
    if (!LEAD_GRADES.includes((input.grade ?? "") as LeadGrade)) {
      return { field: "grade", message: "কথা হওয়া কলে গ্রেড A / B / C / D বাছাই করুন" };
    }
  }

  if (input.requireCallFacts) {
    if (!CALL_DIRECTIONS.includes((input.direction ?? "") as CallDirection)) {
      return { field: "direction", message: "কলের দিক বাছাই করুন — ইনকামিং না আউটগোয়িং" };
    }
    if (!CALL_OUTCOME_STATES.includes((input.callStatus ?? "") as CallOutcomeState)) {
      return { field: "callStatus", message: "কলের অবস্থা বাছাই করুন" };
    }
    const seconds = input.durationSeconds;
    if (typeof seconds !== "number" || !Number.isFinite(seconds) || seconds < 0) {
      return { field: "durationSeconds", message: "কলের সময়কাল (সেকেন্ড) লিখুন" };
    }
    if (input.callStatus === "connected" && seconds < 1) {
      return { field: "durationSeconds", message: "কথা হওয়া কলের সময়কাল ০ হতে পারে না" };
    }
    const followUpNote = (input.followUpNote ?? "").trim();
    if (!input.followUpAt && !(input.followUpNeeded === false && followUpNote.length > 1)) {
      return {
        field: "followUpAt",
        message: "ফলো-আপের তারিখ ও সময় দিন, নয়তো কেন ফলো-আপ দরকার নেই তা লিখুন",
      };
    }
  }
  return null;
}

/** Is this agent blocked from starting the next call? */
/**
 * Promotes the oldest queued post-call report to the open one. Used right after
 * a report is submitted so every call that rang meanwhile still gets its popup.
 */
export async function promoteNextQueuedReport(agentId: string): Promise<string | null> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: openRow } = await supabaseAdmin
    .from("call_reports")
    .select("id")
    .eq("agent_id", agentId)
    .eq("status", "pending")
    .maybeSingle();
  if (openRow) return openRow.id;
  const { data: next } = await supabaseAdmin
    .from("call_reports")
    .select("id")
    .eq("agent_id", agentId)
    .eq("status", "queued")
    .order("call_ended_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (!next) return null;
  await supabaseAdmin.from("call_reports").update({ status: "pending" }).eq("id", next.id);
  return next.id;
}

export async function pendingReportFor(agentId: string) {

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("call_reports")
    .select("id, lead_id, phone_number, call_ended_at, duration_seconds, connected, recording_id")
    .eq("agent_id", agentId)
    .eq("status", "pending")
    .maybeSingle();
  return data ?? null;
}

/**
 * Opens the post-call report the moment a call ends. Idempotent per agent: if a
 * report is already open it is returned instead of creating a second one, so a
 * WorkManager retry or an app restart lands on the same durable state.
 */
export async function openCallReport(input: {
  leadId: string;
  agentId: string;
  recordingId?: string | null;
  deviceId?: string | null;
  phoneNumber?: string | null;
  callStartedAt?: string | null;
  durationSeconds?: number;
  connected?: boolean;
}) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const open = await pendingReportFor(input.agentId);
  if (open) {
    // Same call / same lead: idempotent reuse (WorkManager retry, app restart).
    if (open.lead_id === input.leadId) {
      if (input.recordingId && !open.recording_id) {
        await supabaseAdmin
          .from("call_reports")
          .update({ recording_id: input.recordingId })
          .eq("id", open.id);
      }
      return { id: open.id, reused: true as const };
    }

    // A different call while a report is still open: never fold it into the
    // previous lead's report. It waits in the queue and becomes the next popup
    // as soon as the open one is submitted, so every call keeps its own report.
    const existingQueued = await supabaseAdmin
      .from("call_reports")
      .select("id, recording_id")
      .eq("agent_id", input.agentId)
      .eq("status", "queued")
      .eq("lead_id", input.leadId)
      .maybeSingle();
    if (existingQueued.data) {
      if (input.recordingId && !existingQueued.data.recording_id) {
        await supabaseAdmin
          .from("call_reports")
          .update({ recording_id: input.recordingId })
          .eq("id", existingQueued.data.id);
      }
      return { id: existingQueued.data.id, reused: true as const, queued: true as const };
    }
    const queued = await supabaseAdmin
      .from("call_reports")
      .insert({
        lead_id: input.leadId,
        agent_id: input.agentId,
        recording_id: input.recordingId ?? null,
        device_id: input.deviceId ?? null,
        phone_number: input.phoneNumber ?? null,
        call_started_at: input.callStartedAt ?? null,
        duration_seconds: input.durationSeconds ?? 0,
        connected: input.connected ?? true,
        status: "queued",
      })
      .select("id")
      .single();
    if (queued.error || !queued.data) {
      throw new Error(queued.error?.message ?? "Could not queue post-call report");
    }
    const { logLeadEvent: logQueued } = await import("@/lib/lead-events.server");
    await logQueued({
      leadId: input.leadId,
      agentId: input.agentId,
      recordingId: input.recordingId ?? null,
      kind: "call_ended",
      detail: "কল শেষ — রিপোর্ট সারিতে অপেক্ষমাণ",
    });
    return { id: queued.data.id, reused: false as const, queued: true as const };
  }


  const { data, error } = await supabaseAdmin
    .from("call_reports")
    .insert({
      lead_id: input.leadId,
      agent_id: input.agentId,
      recording_id: input.recordingId ?? null,
      device_id: input.deviceId ?? null,
      phone_number: input.phoneNumber ?? null,
      call_started_at: input.callStartedAt ?? null,
      duration_seconds: input.durationSeconds ?? 0,
      connected: input.connected ?? true,
      status: "pending",
    })
    .select("id")
    .single();
  if (error || !data) throw new Error(error?.message ?? "Could not open post-call report");

  const { logLeadEvent } = await import("@/lib/lead-events.server");
  await logLeadEvent({
    leadId: input.leadId,
    agentId: input.agentId,
    recordingId: input.recordingId ?? null,
    kind: "call_ended",
    detail: "কল শেষ — পোস্ট-কল রিপোর্ট বাকি",
  });

  return { id: data.id, reused: false as const };
}

/**
 * Submits the report: validates, closes it, moves the lead forward and creates
 * the linked calendar event for FOLLOW UP / CALLBACK. The human category is
 * final — an AI suggestion is stored beside it and never overwrites it.
 *
 * Completion rule, enforced here and in the database trigger:
 *   received + classified (temperature + grade) -> lead work_state = completed
 *   received, not classified                    -> refused, report stays open
 *   not received                                -> lead stays pending, retry queue
 */
export async function submitCallReport(input: {
  reportId: string;
  agentId: string;
  category: string;
  summary?: string | null;
  note?: string | null;
  reason?: string | null;
  followUpAt?: string | null;
  reminderMinutes?: number;
  temperature?: string | null;
  grade?: string | null;
  aiDecision?: "accepted" | "edited" | "rejected" | null;
  /** Mandatory call facts collected in the popup. */
  direction?: string | null;
  callStatus?: string | null;
  durationSeconds?: number | null;
  followUpNeeded?: boolean;
  followUpNote?: string | null;
}) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const category = input.category as CallCategory;

  const { data: report, error: readError } = await supabaseAdmin
    .from("call_reports")
    .select("*")
    .eq("id", input.reportId)
    .maybeSingle();
  if (readError) throw new Error(readError.message);
  if (!report) throw new Error("রিপোর্ট পাওয়া যায়নি");
  if (report.agent_id !== input.agentId) throw new Error("এই রিপোর্ট আপনার নয়");
  if (report.status === "submitted") return { ok: true, alreadySubmitted: true as const };

  // `connected` is set when the call ends, so the phone cannot skip the
  // classification requirement by omitting it from the submit payload. The agent
  // may only *upgrade* an unanswered call to "কথা হয়েছে", never the other way.
  const claimedConnected =
    !isNotConnectedOutcome(input.callStatus) &&
    (report.connected !== false || input.callStatus === "connected");
  const invalid = validateReport({ ...input, connected: claimedConnected, requireCallFacts: true });
  if (invalid) throw new Error(invalid.message);

  const temperature = claimedConnected
    ? ((input.temperature ?? null) as LeadTemperature | null)
    : null;
  const grade = claimedConnected ? ((input.grade ?? null) as LeadGrade | null) : null;
  const classified = Boolean(temperature && grade);

  // The phone's own record decides whether the call was really answered. A claim
  // with no measured call, no recording and no call log never completes a task —
  // the report is still stored, so nothing real is ever lost.
  const evidence = callEvidence({
    claimedConnected,
    callStatus: input.callStatus ?? null,
    measuredSeconds: report.duration_seconds,
    hasRecording: Boolean(report.recording_id),
    callStartedAt: report.call_started_at,
    callEndedAt: report.call_ended_at,
  });
  const received = evidence.connected;
  const taskOutcome = taskState({
    connected: received,
    classified,
    evidence: evidence.evidence,
    claimedConnected,
  });

  // The stored duration wins whenever the phone actually measured the call; the
  // agent's number is only used when nothing was measured.
  const storedSeconds = report.duration_seconds ?? 0;
  const durationSeconds =
    storedSeconds > 0 ? storedSeconds : Math.max(0, Math.round(input.durationSeconds ?? 0));
  const noFollowUpNote = (input.followUpNote ?? "").trim();
  const note = input.followUpAt
    ? input.note?.trim() || null
    : [input.note?.trim(), noFollowUpNote ? `ফলো-আপ দরকার নেই — ${noFollowUpNote}` : null]
        .filter(Boolean)
        .join(" — ") || null;

  const { error } = await supabaseAdmin
    .from("call_reports")
    .update({
      status: "submitted",
      category,
      summary: input.summary?.trim() || null,
      note,
      reason: input.reason?.trim() || null,
      follow_up_at: input.followUpAt ?? null,
      connected: claimedConnected,
      connection_verified: received,
      duration_seconds: durationSeconds,
      temperature,
      grade,
      ai_decision: input.aiDecision ?? null,
      submitted_at: new Date().toISOString(),
    })
    .eq("id", input.reportId)
    .eq("agent_id", input.agentId);
  if (error) throw new Error(error.message);

  // Direction and call state belong to the call itself, so the linked call row
  // carries what the agent confirmed in the popup.
  if (report.recording_id && input.direction && input.callStatus) {
    await supabaseAdmin
      .from("call_recordings")
      .update({
        call_direction: input.direction === "incoming" ? "incoming_callback" : "outgoing",
        call_status: input.callStatus === "connected" ? "completed" : input.callStatus,
        duration_seconds: durationSeconds,
      })
      .eq("id", report.recording_id);
  }

  const { data: lead } = await supabaseAdmin
    .from("leads")
    .select("id, name, phone_number, status, unanswered_attempts")
    .eq("id", report.lead_id)
    .maybeSingle();

  const nowIso = new Date().toISOString();
  const notes =
    [input.summary?.trim(), input.note?.trim(), input.reason?.trim()].filter(Boolean).join(" — ") ||
    null;

  if (received && classified) {
    await supabaseAdmin
      .from("leads")
      .update({
        status: LEAD_STATUS_FOR[category],
        outcome_category: category,
        notes,
        last_call_at: nowIso,
        temperature,
        grade,
        classification_note: input.note?.trim() || null,
        classified_at: nowIso,
        classified_by: input.agentId,
        work_state: "completed",
        retry_after: null,
      })
      .eq("id", report.lead_id);

    await supabaseAdmin.from("lead_classifications").insert({
      lead_id: report.lead_id,
      agent_id: input.agentId,
      report_id: report.id,
      temperature: temperature!,
      grade: grade!,
      note: input.note?.trim() || null,
      source: "manual",
      classified_at: nowIso,
    });
  } else {
    // Not received: the task is NOT finished. The lead goes back into the working
    // queue behind the untried leads and becomes callable again after a waiting
    // gap that grows with every unanswered try. It is never silently completed.
    const unanswered = Math.max(0, lead?.unanswered_attempts ?? 0) + 1;
    const retryAt = nextRetryAt(unanswered, new Date(nowIso));
    await supabaseAdmin
      .from("leads")
      .update({
        status: "pending",
        outcome_category: category,
        notes,
        last_call_at: nowIso,
        work_state: "pending",
        unanswered_attempts: unanswered,
        retry_after: retryAt,
      })
      .eq("id", report.lead_id);

    const { logLeadEvent: logRetryEvent } = await import("@/lib/lead-events.server");
    await logRetryEvent({
      leadId: report.lead_id,
      agentId: input.agentId,
      recordingId: report.recording_id,
      kind: "outcome_logged",
      detail: `কল ধরা হয়নি (${unanswered}তম বার) — টাস্ক শেষ হয়নি, লিড আবার কিউতে গেল, ${new Date(
        retryAt,
      ).toLocaleString("bn-BD", { timeZone: "Asia/Dhaka" })}-এর পর আবার কল করা যাবে`,
    });

    if (needsSupervisorDecision(unanswered)) {
      await supabaseAdmin.from("system_alerts").insert({
        code: "lead_unreachable",
        severity: "warning",
        title: "একই লিডে বারবার কল — কেউ ধরছে না",
        detail: `লিড ${lead?.name ?? report.lead_id} (${lead?.phone_number ?? report.phone_number ?? "—"}) ${unanswered} বার চেষ্টা করেও ধরা যায়নি — lead:${report.lead_id}`,
        action: "কোঅর্ডিনেটর সিদ্ধান্ত নিন: আবার চেষ্টা, অন্য এজেন্ট, নাকি বাদ",
      });
    }
  }

  let followUpId: string | null = null;
  if (input.followUpAt) {
    const { data: event } = await supabaseAdmin
      .from("follow_up_events")
      .insert({
        lead_id: report.lead_id,
        agent_id: input.agentId,
        report_id: report.id,
        recording_id: report.recording_id,
        customer_name: lead?.name ?? null,
        phone_number: lead?.phone_number ?? report.phone_number,
        category,
        priority: category === "callback" ? "high" : "normal",
        note: input.note?.trim() || null,
        scheduled_at: input.followUpAt,
        reminder_minutes: input.reminderMinutes ?? 30,
        status: "upcoming",
      })
      .select("id")
      .single();
    followUpId = event?.id ?? null;
  }

  const { logLeadEvent } = await import("@/lib/lead-events.server");
  await logLeadEvent({
    leadId: report.lead_id,
    agentId: input.agentId,
    recordingId: report.recording_id,
    kind: "outcome_logged",
    detail: `${CATEGORY_LABEL[category]}${
      classified
        ? ` — ${TEMPERATURE_LABEL[temperature!]} / গ্রেড ${grade}`
        : " — কথা হয়নি, আবার কল হবে"
    }${input.followUpAt ? ` — ফলো-আপ ${new Date(input.followUpAt).toLocaleString("bn-BD")}` : ""}`,
  });

  const { logAudit } = await import("@/lib/audit.server");
  await logAudit({
    action: "call_report_submitted",
    entityType: "call_report",
    entityId: report.id,
    actorProfileId: input.agentId,
    metadata: {
      leadId: report.lead_id,
      category,
      received,
      temperature,
      grade,
      workState: received && classified ? "completed" : "pending",
      aiDecision: input.aiDecision ?? null,
      followUpAt: input.followUpAt ?? null,
    },
  });

  // Sync trail for the phone: report accepted -> next lead unlocked.
  const { recordSyncEvent } = await import("@/lib/call-jobs.server");
  await recordSyncEvent({
    agentId: input.agentId,
    deviceId: report.device_id,
    eventType: "report_submitted",
    entityType: "call_report",
    entityId: report.id,
    idempotencyKey: `report_submitted:${report.id}`,
    payload: { leadId: report.lead_id, category, temperature, grade },
  });

  // Review alerts for IT / Authority: AI-vs-agent disagreement and a received
  // call with no recording. Neither changes the agent's decision, and a failure
  // here must never reject an accepted report.
  let review: { mismatchAlertId: string | null; missingRecordingAlertId: string | null } = {
    mismatchAlertId: null,
    missingRecordingAlertId: null,
  };
  try {
    const { reviewSubmittedReport } = await import("@/lib/classification-review.server");
    review = await reviewSubmittedReport({
      reportId: report.id,
      leadId: report.lead_id,
      agentId: input.agentId,
      recordingId: report.recording_id,
      connected: received,
      durationSeconds: report.duration_seconds ?? 0,
      temperature,
      grade,
    });
  } catch (error) {
    console.error("classification review after submit failed:", error);
  }

  // The spreadsheet is updated as soon as the agent's update is accepted.
  // Best effort: a spreadsheet outage must never reject an accepted report.
  let sheet: { appended: number; pending: boolean; error: string | null } | null = null;
  try {
    const { syncReportsToSheet } = await import("@/lib/report-sheet.server");
    const result = await syncReportsToSheet();
    sheet = { appended: result.appended, pending: Boolean(result.skipped), error: null };
  } catch (error) {
    // Truthful state: the report is stored, the spreadsheet copy is still pending.
    console.error("report sheet sync after submit failed:", error);
    sheet = {
      appended: 0,
      pending: true,
      error: error instanceof Error ? error.message : String(error),
    };
  }

  // Honesty check: does the phone's own record support the report? A real call
  // on a phone that failed to measure the duration is still accepted — but a
  // "কথা হয়েছে" with no evidence at all is flagged and the agent is warned.
  const trust = reportTrust({
    claimedConnected,
    measuredSeconds: report.duration_seconds ?? 0,
    declaredSeconds: input.durationSeconds ?? 0,
    hasRecording: Boolean(report.recording_id),
    callStartedAt: report.call_started_at ?? null,
  });
  if (trust.suspicious) {
    try {
      await supabaseAdmin.from("system_alerts").insert({
        code: "call_report_unverified",
        severity: "warning",
        title: "কল রিপোর্ট ফোনের রেকর্ডের সঙ্গে মেলেনি",
        detail: `${trust.reasons.join("; ")} — report:${report.id}`,
        action: "এজেন্টের সঙ্গে কথা বলুন — কল না করে রিপোর্ট দেওয়া হয়েছে কি না যাচাই করুন",
      });
      const { logAudit: logTrustAudit } = await import("@/lib/audit.server");
      await logTrustAudit({
        action: "call_report_unverified",
        entityType: "call_report",
        entityId: report.id,
        actorProfileId: input.agentId,
        metadata: { leadId: report.lead_id, reasons: trust.reasons, category },
      });
    } catch (alertError) {
      console.error("unverified report alert failed:", alertError);
    }
  }

  // The next queued call becomes the open report right away, so the popup
  // returns for every call that happened while this one was being written.
  const nextQueued = await promoteNextQueuedReport(input.agentId);

  return {
    ok: true,
    followUpId,
    sheet,
    review,
    nextReportId: nextQueued,
    workState: taskOutcome === "completed" ? ("completed" as const) : ("pending" as const),
    taskState: taskOutcome,
    retryQueued: taskOutcome !== "completed",
    // The task contract speaks first, then the honesty check.
    warning: TASK_STATE_MESSAGE[taskOutcome] ?? trust.warning,
  };

}

/**
 * AI report assistant.
 *
 * Built from the analysis already stored on the recording (Lovable AI
 * transcription + call analysis) — no second model call, no invented data. The
 * suggestion is advisory only: it is persisted separately in
 * `call_reports.ai_suggestion` and never written into `category`, which stays
 * the agent's decision.
 */
export type AiSuggestion = {
  summary: string[];
  requirements: string[];
  objections: string[];
  interest: "high" | "medium" | "low" | "unknown";
  suggestedCategory: CallCategory | null;
  nextAction: string;
  suggestedFollowUpAt: string | null;
  suggestedTemperature: LeadTemperature | null;
  suggestedGrade: LeadGrade | null;
  source: "call_analysis";
};

function suggestionFrom(recording: {
  ai_summary: string | null;
  sentiment: string | null;
  customer_objections: string[] | null;
  deal_stage: string | null;
  duration_seconds: number;
  ai_temperature?: string | null;
  ai_grade?: string | null;
}): AiSuggestion {
  const summary = (recording.ai_summary ?? "")
    .split("\n")
    .map((line) => line.replace(/^[•\-\s]+/, "").trim())
    .filter(Boolean);
  const objections = recording.customer_objections ?? [];
  const stage = (recording.deal_stage ?? "").toLowerCase();

  const interest: AiSuggestion["interest"] =
    recording.sentiment === "positive"
      ? "high"
      : recording.sentiment === "neutral"
        ? "medium"
        : recording.sentiment
          ? "low"
          : "unknown";

  let suggested: CallCategory | null = null;
  if (objections.some((o) => /কলব্যাক|callback|পরে ফোন/i.test(o))) suggested = "callback";
  else if (recording.duration_seconds < 6) suggested = "no_answer";
  else if (stage.includes("won") || stage.includes("closed")) suggested = "closed_converted";
  else if (recording.sentiment === "positive") suggested = "hot_lead";
  else if (recording.sentiment === "critical") suggested = "not_interested";
  else if (objections.length > 0) suggested = "follow_up";
  else if (recording.sentiment === "neutral") suggested = "interested";

  const followUp = new Date();
  followUp.setDate(followUp.getDate() + 1);
  followUp.setHours(11, 0, 0, 0);

  return {
    summary,
    requirements: summary.filter((line) => /দরকার|প্রয়োজন|চাই|need|want|require/i.test(line)),
    objections,
    interest,
    suggestedCategory: suggested,
    nextAction:
      suggested === "closed_converted"
        ? "চুক্তির কাগজপত্র পাঠান"
        : suggested === "not_interested"
          ? "এই লিড বন্ধ করে কারণ লিখুন"
          : "আগামীকাল সকালে ফলো-আপ কল দিন",
    suggestedTemperature: LEAD_TEMPERATURES.includes(recording.ai_temperature as LeadTemperature)
      ? (recording.ai_temperature as LeadTemperature)
      : null,
    suggestedGrade: LEAD_GRADES.includes(recording.ai_grade as LeadGrade)
      ? (recording.ai_grade as LeadGrade)
      : null,
    suggestedFollowUpAt:
      suggested === "follow_up" || suggested === "hot_lead" || suggested === "callback"
        ? followUp.toISOString()
        : null,
    source: "call_analysis",
  };
}

/** The open report plus lead, recording state and the AI suggestion. */
export async function loadPendingReportDetail(agentId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  // A queued call becomes the open report here too, so the popup always shows
  // the next unreported call even if the promotion after submit was missed.
  await promoteNextQueuedReport(agentId);
  const { data: report } = await supabaseAdmin
    .from("call_reports")
    .select("*")
    .eq("agent_id", agentId)
    .eq("status", "pending")
    .maybeSingle();
  if (!report) return null;
  const { count: queuedCount } = await supabaseAdmin
    .from("call_reports")
    .select("id", { count: "exact", head: true })
    .eq("agent_id", agentId)
    .eq("status", "queued");


  const { data: lead } = await supabaseAdmin
    .from("leads")
    .select("id, name, phone_number, company")
    .eq("id", report.lead_id)
    .maybeSingle();

  const { data: recording } = report.recording_id
    ? await supabaseAdmin
        .from("call_recordings")
        .select(
          "id, analysis_status, analysis_error, ai_summary, sentiment, customer_objections, deal_stage, duration_seconds, is_two_sided, recorder_source, ai_temperature, ai_grade, call_direction, call_status",
        )
        .eq("id", report.recording_id)
        .maybeSingle()
    : { data: null };

  let suggestion = (report.ai_suggestion as AiSuggestion | null) ?? null;
  if (!suggestion && recording && recording.analysis_status === "completed") {
    suggestion = suggestionFrom(recording);
    await supabaseAdmin
      .from("call_reports")
      .update({ ai_suggestion: suggestion })
      .eq("id", report.id);
  }

  return { report, lead, recording, suggestion, queuedCount: queuedCount ?? 0 };
}

/**
 * Field-correction window: an agent may correct an update they already submitted
 * while the Dhaka clock is inside 09:00–12:45 on the same day the call happened.
 * Executive HQ recomputes its presentation on every read, so a correction simply
 * shows up as newer numbers there — HQ is never shown that an edit took place.
 */
export const EDIT_WINDOW_START = 9 * 60;
export const EDIT_WINDOW_END = 12 * 60 + 45;

export function reportEditable(callEndedAt: string, at: Date = new Date()) {
  const now = dhakaClock(at);
  if (now.minutes < EDIT_WINDOW_START || now.minutes > EDIT_WINDOW_END) return false;
  return dhakaClock(new Date(callEndedAt)).dateKey === now.dateKey;
}

function dhakaClock(at: Date) {
  const shifted = new Date(at.getTime() + 6 * 60 * 60 * 1000);
  return {
    minutes: shifted.getUTCHours() * 60 + shifted.getUTCMinutes(),
    dateKey: shifted.toISOString().slice(0, 10),
  };
}

/** Applies an agent's own correction to an already submitted update. */
export async function editSubmittedReport(input: {
  reportId: string;
  agentId: string;
  category: string;
  summary?: string | null;
  note?: string | null;
  reason?: string | null;
  followUpAt?: string | null;
  temperature?: string | null;
  grade?: string | null;
}) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: report } = await supabaseAdmin
    .from("call_reports")
    .select("*")
    .eq("id", input.reportId)
    .maybeSingle();
  if (!report) throw new Error("রিপোর্ট পাওয়া যায়নি");
  if (report.agent_id !== input.agentId) throw new Error("এই রিপোর্ট আপনার নয়");
  if (report.status !== "submitted") throw new Error("এই রিপোর্ট এখনো জমা হয়নি");
  if (!reportEditable(report.call_ended_at)) {
    throw new Error("সংশোধনের সময় শেষ — সকাল ৯:০০ থেকে ১২:৪৫ পর্যন্ত একই দিনের রিপোর্ট বদলানো যায়");
  }

  // The same verified-connection rule as submission: an edit can never turn a
  // call the phone never proved into a completed conversation.
  const received = reportConnected(report);
  const invalid = validateReport({ ...input, connected: received });
  if (invalid) throw new Error(invalid.message);

  const category = input.category as CallCategory;
  const temperature = received ? ((input.temperature ?? null) as LeadTemperature | null) : null;
  const grade = received ? ((input.grade ?? null) as LeadGrade | null) : null;
  const nowIso = new Date().toISOString();

  const { error } = await supabaseAdmin
    .from("call_reports")
    .update({
      category,
      summary: input.summary?.trim() || null,
      note: input.note?.trim() || null,
      reason: input.reason?.trim() || null,
      follow_up_at: input.followUpAt ?? null,
      temperature,
      grade,
    })
    .eq("id", report.id)
    .eq("agent_id", input.agentId);
  if (error) throw new Error(error.message);

  const notes =
    [input.summary?.trim(), input.note?.trim(), input.reason?.trim()].filter(Boolean).join(" — ") ||
    null;

  await supabaseAdmin
    .from("leads")
    .update({
      status: received && temperature && grade ? LEAD_STATUS_FOR[category] : "pending",
      outcome_category: category,
      notes,
      ...(received && temperature && grade
        ? {
            temperature,
            grade,
            classification_note: input.note?.trim() || null,
            classified_at: nowIso,
            classified_by: input.agentId,
            work_state: "completed",
          }
        : {}),
    })
    .eq("id", report.lead_id);

  if (input.followUpAt) {
    await supabaseAdmin
      .from("follow_up_events")
      .update({
        category,
        note: input.note?.trim() || null,
        scheduled_at: input.followUpAt,
        priority: category === "callback" ? "high" : "normal",
      })
      .eq("report_id", report.id)
      .neq("status", "done");
  }

  const { logAudit } = await import("@/lib/audit.server");
  await logAudit({
    action: "call_report_edited",
    entityType: "call_report",
    entityId: report.id,
    actorProfileId: input.agentId,
    metadata: { leadId: report.lead_id, category, temperature, grade },
  });

  // Keep the spreadsheet aligned; an outage must never reject the correction.
  try {
    const { syncReportsToSheet } = await import("@/lib/report-sheet.server");
    await syncReportsToSheet();
  } catch (sheetError) {
    console.error("report sheet sync after edit failed:", sheetError);
  }

  return { ok: true as const };
}
