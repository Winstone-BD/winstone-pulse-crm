/**
 * What counts as a real call — the single rule set for the whole CRM.
 *
 * The floor is judged on calls that actually happened, not on reports that were
 * typed. So every screen (agent desk, Executive HQ, leaderboard, daily report,
 * task queue, Lead 360) and the Android app decide all of this here:
 *
 *   - a call attempt: one submitted post-call report for one call session;
 *   - a connected call: the phone itself proves the customer answered — a
 *     measured duration, a synced recording, or a logged call start time;
 *   - talk time: only the duration the phone measured. Nothing is estimated, and
 *     "no measurement" is reported as unavailable, never as zero minutes;
 *   - a finished task: connected AND classified. Everything else goes back into
 *     the queue for another call.
 *
 * Outcomes like no answer, busy, rejected, failed and missed are attempts with a
 * visible history — they never add to performance and never finish a task.
 */

/** Call outcomes that are explicitly NOT a conversation. */
export const NOT_CONNECTED_OUTCOMES = [
  "no_answer",
  "noanswer",
  "no-answer",
  "busy",
  "failed",
  "rejected",
  "declined",
  "missed",
  "cancelled",
  "canceled",
  "not_connected",
  "unanswered",
];

/** The one outcome that means the customer answered. */
export const CONNECTED_OUTCOME = "connected";

export function isNotConnectedOutcome(callStatus: string | null | undefined): boolean {
  return NOT_CONNECTED_OUTCOMES.includes((callStatus ?? "").trim().toLowerCase());
}

/** Shortest measured call that can hold a conversation. Below this, ringing. */
export const MIN_CONNECTED_SECONDS = 1;

export type CallFacts = {
  /** The agent (or the phone) says the call was answered. */
  claimedConnected: boolean;
  /** Outcome the phone reported for the call session, when it reported one. */
  callStatus?: string | null;
  /** Seconds the phone measured. 0/null means nothing was measured. */
  measuredSeconds?: number | null;
  /** A call recording row is linked to this call. */
  hasRecording?: boolean;
  /** The phone logged when the call started. */
  callStartedAt?: string | null;
  /** The phone logged when the call ended. */
  callEndedAt?: string | null;
};

export type CallEvidence = {
  /** A connected call for every count in the CRM. Requires real evidence. */
  connected: boolean;
  /** Where the proof came from. */
  evidence: "measured" | "recording" | "call_log" | "none";
  /**
   * Seconds of talk that can be proven. `null` means the phone measured
   * nothing — the metric is unavailable, and must never be shown as 0 minutes.
   */
  verifiedSeconds: number | null;
};

/** The canonical read of one call's facts. Same answer for the same inputs. */
export function callEvidence(facts: CallFacts): CallEvidence {
  const measured = Math.max(0, Math.round(facts.measuredSeconds ?? 0));
  const verifiedSeconds = measured >= MIN_CONNECTED_SECONDS ? measured : null;

  // An outcome the phone itself reported as not-connected always wins over a
  // claim in the popup: the agent cannot type a lead into "কথা হয়েছে".
  if (!facts.claimedConnected || isNotConnectedOutcome(facts.callStatus)) {
    return { connected: false, evidence: "none", verifiedSeconds: null };
  }

  if (verifiedSeconds !== null) return { connected: true, evidence: "measured", verifiedSeconds };
  if (facts.hasRecording) return { connected: true, evidence: "recording", verifiedSeconds: null };
  if (facts.callStartedAt || facts.callEndedAt) {
    return { connected: true, evidence: "call_log", verifiedSeconds: null };
  }
  // Claimed, but the phone carries no trace of a call at all.
  return { connected: false, evidence: "none", verifiedSeconds: null };
}

/** The state of one call task. */
export type TaskState = "completed" | "retry_required" | "manual_note";

/**
 * The task completion contract:
 *   attempted + connected + classified  -> completed
 *   attempted + not connected           -> retry_required (lead returns)
 *   report only, no call evidence       -> manual_note (kept, never completed)
 */
export function taskState(input: {
  connected: boolean;
  classified: boolean;
  evidence: CallEvidence["evidence"];
  /** The agent claimed a conversation in the popup. */
  claimedConnected: boolean;
}): TaskState {
  if (input.connected && input.classified) return "completed";
  if (input.claimedConnected && input.evidence === "none") return "manual_note";
  return "retry_required";
}

export const TASK_STATE_MESSAGE: Record<TaskState, string | null> = {
  completed: null,
  retry_required:
    "কল সংযুক্ত হয়নি। এই রিপোর্ট টাস্ক সম্পূর্ণ হিসেবে গণ্য হবে না। আবার কল করতে হবে।",
  manual_note:
    "এই কলের কোনো প্রমাণ ফোনে পাওয়া যায়নি — রিপোর্টটি শুধু নোট হিসেবে রাখা হলো, টাস্ক সম্পূর্ণ হয়নি। আবার কল করতে হবে।",
};

/**
 * One call session, whatever route it arrived by. The phone, a retried upload and
 * the web popup can all report the same call, so counts key on the call session
 * (the recording row) and fall back to the report id.
 */
export function callSessionKey(input: {
  reportId: string;
  recordingId?: string | null;
}): string {
  return input.recordingId ? `session:${input.recordingId}` : `report:${input.reportId}`;
}

export type TalkTime = {
  /** Proven talk seconds. */
  seconds: number;
  /** Connected calls whose duration the phone never measured. */
  unmeasuredCalls: number;
  /** Connected calls with a measured duration. */
  measuredCalls: number;
};

/**
 * Average talk time (ATA) is counted only from this Dhaka date — the day the
 * verified-call contract went live. Earlier days never produced phone-measured
 * durations, so an ATA for them would be invented.
 */
export const VERIFIED_TALK_START_DATE = "2026-09-20";

/**
 * ATA: average verified talk seconds per connected call the phone actually
 * measured. Unmeasured connected calls are excluded from both sides — dividing
 * proven seconds by all connected calls would understate the real average.
 * Returns null when nothing was measured (show "unavailable", never 0).
 */
export function averageTalkSecondsOf(
  calls: { verifiedConnected: boolean; verifiedSeconds: number | null }[],
): number | null {
  let total = 0;
  let measured = 0;
  for (const call of calls) {
    if (!call.verifiedConnected || call.verifiedSeconds === null) continue;
    total += call.verifiedSeconds;
    measured += 1;
  }
  return measured ? Math.round(total / measured) : null;
}

/** Talk time over a set of calls — proven seconds only, with the gap reported. */
export function talkTimeOf(calls: { connected: boolean; verifiedSeconds: number | null }[]): TalkTime {
  let seconds = 0;
  let measuredCalls = 0;
  let unmeasuredCalls = 0;
  for (const call of calls) {
    if (!call.connected) continue;
    if (call.verifiedSeconds === null) unmeasuredCalls += 1;
    else {
      seconds += call.verifiedSeconds;
      measuredCalls += 1;
    }
  }
  return { seconds, measuredCalls, unmeasuredCalls };
}

/**
 * One canonical call in the whole CRM: a submitted post-call report, read as a
 * call session. Every console (agent desk, Coordinator Deck, Executive HQ,
 * reports, AI coach, copilot, Android) builds its numbers from this shape only.
 */
export type CanonicalCall = {
  id: string;
  agentId: string | null;
  leadId: string | null;
  /** Effective call time: when the phone ended the call, else when it was filed. */
  at: string;
  verifiedConnected: boolean;
  /** Proven talk seconds, or null when nothing was measured. */
  verifiedSeconds: number | null;
  recordingId: string | null;
};

/** The raw columns every canonical read of `call_reports` needs. */
export const CALL_REPORT_CANONICAL_COLUMNS =
  "id, agent_id, lead_id, status, connected, connection_verified, duration_seconds, recording_id, call_started_at, call_ended_at, submitted_at, created_at";

export type CallReportRow = {
  id: string;
  agent_id?: string | null;
  lead_id?: string | null;
  connected?: boolean | null;
  connection_verified?: boolean | null;
  call_status?: string | null;
  duration_seconds?: number | null;
  recording_id?: string | null;
  call_started_at?: string | null;
  call_ended_at?: string | null;
  submitted_at?: string | null;
  created_at?: string | null;
};

/** Did this stored report prove a conversation? The one answer for every screen. */
export function reportConnected(row: CallReportRow): boolean {
  if (row.connection_verified === true) return true;
  return callEvidence({
    claimedConnected: row.connected !== false,
    callStatus: row.call_status ?? null,
    measuredSeconds: row.duration_seconds ?? null,
    hasRecording: Boolean(row.recording_id),
    callStartedAt: row.call_started_at ?? null,
    callEndedAt: row.call_ended_at ?? null,
  }).connected;
}

/** Turns stored reports into canonical calls, de-duplicated per call session. */
export function canonicalCallsOf(rows: CallReportRow[]): CanonicalCall[] {
  const seen = new Set<string>();
  const calls: CanonicalCall[] = [];
  for (const row of rows) {
    const key = callSessionKey({ reportId: row.id, recordingId: row.recording_id ?? null });
    if (seen.has(key)) continue;
    seen.add(key);
    const measured = row.duration_seconds ?? 0;
    calls.push({
      id: row.id,
      agentId: row.agent_id ?? null,
      leadId: row.lead_id ?? null,
      at: row.call_ended_at ?? row.submitted_at ?? row.created_at ?? new Date().toISOString(),
      verifiedConnected: reportConnected(row),
      verifiedSeconds: measured > 0 ? measured : null,
      recordingId: row.recording_id ?? null,
    });
  }
  return calls;
}
