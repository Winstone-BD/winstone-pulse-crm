/** Device chronology is not independent evidence of connected talk time. */
export const terminalCallStates = new Set(["completed", "failed", "no_answer"]);
const order: Record<string, number> = { initiated: 0, ringing: 1, answered: 2, completed: 3, failed: 3, no_answer: 3 };

export function reconcileCallTiming(input: {
  state: string;
  claimedSeconds?: number | undefined;
  existing?: { call_status: string | null; created_at: string; duration_seconds: number; device_reported_duration_seconds?: number | null } | null;
  nowMs: number;
}) {
  const previous = input.existing;
  const previousState = previous?.call_status ?? "initiated";
  const state = previous && (terminalCallStates.has(previousState) || (order[previousState] ?? 0) > (order[input.state] ?? 0))
    ? previousState : input.state;
  const elapsed = previous ? Math.max(0, Math.floor((input.nowMs - Date.parse(previous.created_at)) / 1000)) : 0;
  const cap = previous && Number.isFinite(elapsed) ? elapsed + 60 : 0;
  // Replays must not gain minutes merely because the retry arrives later.
  const alreadyFinished = previous && terminalCallStates.has(previousState);
  const durationSeconds = alreadyFinished ? previous.duration_seconds
    : terminalCallStates.has(input.state) ? Math.min(input.claimedSeconds ?? 0, cap) : previous?.duration_seconds ?? 0;
  const reportedSeconds = alreadyFinished && previous.device_reported_duration_seconds != null
    ? previous.device_reported_duration_seconds
    : terminalCallStates.has(input.state) ? input.claimedSeconds ?? previous?.device_reported_duration_seconds ?? null
    : previous?.device_reported_duration_seconds ?? null;
  return { state, durationSeconds, reportedSeconds, applyEventTime: state === input.state && !alreadyFinished };
}

export function reportDurationForSubmit(stored: number, deviceClaim: number | null | undefined, entered: number | null | undefined) {
  return deviceClaim != null || stored > 0 ? stored : Math.max(0, Math.round(entered ?? 0));
}