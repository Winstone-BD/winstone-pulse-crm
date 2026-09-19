/**
 * Unanswered calls and report honesty — one rule set for the whole CRM.
 *
 * Two facts the floor depends on:
 *
 * 1. A call nobody picked up is NOT finished work. The lead goes back into the
 *    working queue behind the leads that have not been tried yet, and it becomes
 *    callable again after a waiting gap that grows with every failed try. It is
 *    never silently completed and never quietly dropped.
 * 2. A report is only trusted when the phone itself carries evidence of the
 *    call. Claiming "কথা হয়েছে" with no measured call, no recording and no start
 *    time is flagged and the agent is warned — the report is still stored, so a
 *    real call is never lost, but a supervisor sees the flag.
 */

/** Waiting gap (minutes) before an unanswered lead may be called again. */
export const RETRY_BACKOFF_MINUTES = [90, 240, 1440, 2880];

/** How many unanswered tries before the lead needs a supervisor's decision. */
export const MAX_UNANSWERED_ATTEMPTS = 6;

/** The gap after the Nth unanswered try (1-based). Last gap repeats. */
export function retryDelayMinutes(unansweredAttempts: number): number {
  const index = Math.max(1, Math.round(unansweredAttempts)) - 1;
  return RETRY_BACKOFF_MINUTES[Math.min(index, RETRY_BACKOFF_MINUTES.length - 1)]!;
}

/** When an unanswered lead becomes callable again. */
export function nextRetryAt(unansweredAttempts: number, now: Date = new Date()): string {
  return new Date(now.getTime() + retryDelayMinutes(unansweredAttempts) * 60_000).toISOString();
}

/** Is the waiting gap over, so this lead may be called again? */
export function isRetryDue(retryAfter: string | null | undefined, now: Date = new Date()): boolean {
  if (!retryAfter) return true;
  return new Date(retryAfter).getTime() <= now.getTime();
}

/** Has this lead been tried so often that a coordinator should step in? */
export function needsSupervisorDecision(unansweredAttempts: number): boolean {
  return unansweredAttempts >= MAX_UNANSWERED_ATTEMPTS;
}

export type ReportTrustInput = {
  /** The agent says the call was answered. */
  claimedConnected: boolean;
  /** Seconds the phone actually measured (0 or null = nothing measured). */
  measuredSeconds: number | null;
  /** Seconds the agent typed into the popup. */
  declaredSeconds: number | null;
  /** A call recording row is linked to this report. */
  hasRecording: boolean;
  /** The phone logged when the call started. */
  callStartedAt: string | null;
};

export type ReportTrust = {
  /** The report contradicts the phone's own evidence. */
  suspicious: boolean;
  /** Bengali reasons, shown to the agent and stored on the alert. */
  reasons: string[];
  /** The warning to show the agent, or null when the report looks sound. */
  warning: string | null;
};

/**
 * Checks a submitted report against what the phone recorded. Never blocks the
 * report: a genuine call on a phone that failed to measure the duration must
 * still be storable. It only tells the truth about what was verified.
 */
export function reportTrust(input: ReportTrustInput): ReportTrust {
  const reasons: string[] = [];
  const measured = Math.max(0, input.measuredSeconds ?? 0);
  const declared = Math.max(0, input.declaredSeconds ?? 0);

  if (input.claimedConnected) {
    if (measured === 0 && !input.hasRecording && !input.callStartedAt) {
      reasons.push("ফোন থেকে এই কলের কোনো প্রমাণ পাওয়া যায়নি — কল লগ, রেকর্ডিং বা সময় কিছুই নেই");
    }
    if (measured === 0 && declared >= 60) {
      reasons.push(`ফোনে কলের সময় ০ সেকেন্ড, কিন্তু রিপোর্টে ${declared} সেকেন্ড লেখা হয়েছে`);
    }
    if (measured > 0 && measured < 6) {
      reasons.push(`কলটি মাত্র ${measured} সেকেন্ড ছিল — এত অল্প সময়ে কথা হওয়া সম্ভব নয়`);
    }
  }

  return {
    suspicious: reasons.length > 0,
    reasons,
    warning: reasons.length
      ? `সতর্কতা: এই রিপোর্ট ফোনের কল রেকর্ডের সঙ্গে মেলেনি — ${reasons.join("; ")}। রিপোর্ট জমা হয়েছে, তবে সুপারভাইজারকে জানানো হয়েছে। কল না করে বা কথা না বলে রিপোর্ট দিলে তা পারফরম্যান্সে গোনা হয় না।`
      : null,
  };
}
