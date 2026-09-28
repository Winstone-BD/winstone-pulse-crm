/**
 * Daily Agent Accountability — pure rule, shared by server and tests.
 * Workload = eligible leads assigned for the business day + follow-ups due by
 * the end of that day. Pending = workload not actioned by the end of the day.
 * Above the threshold → one neutral HQ review for the next business day.
 */

export const PENDING_THRESHOLD_PERCENT = 10;

/** First business day the rule applies to — earlier days are never flagged retroactively. */
export const ACCOUNTABILITY_START_DATE = "2026-09-28";

export type AccountabilityStatus = "review_required" | "approved" | "hold";

export const STATUS_LABEL: Record<AccountabilityStatus, string> = {
  review_required: "REVIEW REQUIRED",
  approved: "APPROVED",
  hold: "HOLD",
};

export type AccountabilityInput = {
  leads: { id: string; completed: boolean }[];
  dueFollowUps: { id: string; handled: boolean }[];
  missedReports: number;
};

export type AccountabilityMetrics = {
  assigned: number;
  eligible: number;
  completed: number;
  pending: number;
  pendingPercent: number;
  overdueFollowUps: number;
  missedReports: number;
  flagged: boolean;
  reason: string;
};

export function computeAccountability(input: AccountabilityInput): AccountabilityMetrics {
  const assigned = input.leads.length;
  const completedLeads = input.leads.filter((l) => l.completed).length;
  const dueCount = input.dueFollowUps.length;
  const overdue = input.dueFollowUps.filter((f) => !f.handled).length;
  const eligible = assigned + dueCount;
  const completed = completedLeads + (dueCount - overdue);
  const pending = eligible - completed;
  const pendingPercent = eligible === 0 ? 0 : Math.round((pending / eligible) * 1000) / 10;
  const flagged = eligible > 0 && pendingPercent > PENDING_THRESHOLD_PERCENT;

  const parts: string[] = [];
  if (assigned - completedLeads > 0) parts.push(`${assigned - completedLeads} assigned leads not actioned`);
  if (overdue > 0) parts.push(`${overdue} due follow-ups not handled`);
  if (input.missedReports > 0) parts.push(`${input.missedReports} call reports incomplete`);
  const reason = flagged
    ? `Unusual pending pattern — policy review required (${pendingPercent}% pending > ${PENDING_THRESHOLD_PERCENT}%): ${parts.join(", ")}`
    : "Within threshold";

  return {
    assigned,
    eligible,
    completed,
    pending,
    pendingPercent,
    overdueFollowUps: overdue,
    missedReports: input.missedReports,
    flagged,
    reason,
  };
}

/** Dhaka calendar day (YYYY-MM-DD) shifted by `offset` days. */
export function dhakaDate(offset = 0, now = Date.now()): string {
  return new Date(now + 6 * 3_600_000 + offset * 86_400_000).toISOString().slice(0, 10);
}

export function nextDate(day: string): string {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

/** UTC ISO bounds of a Dhaka business day. */
export function dhakaDayBounds(day: string): { start: string; end: string } {
  const start = new Date(`${day}T00:00:00+06:00`);
  const end = new Date(start.getTime() + 86_400_000 - 1);
  return { start: start.toISOString(), end: end.toISOString() };
}

/** A queue stays locked while any non-approved review has reached its unlock date. */
export function isLocked(
  rows: { status: AccountabilityStatus; unlock_for_date: string }[],
  today: string,
): boolean {
  return rows.some((r) => r.status !== "approved" && r.unlock_for_date <= today);
}
