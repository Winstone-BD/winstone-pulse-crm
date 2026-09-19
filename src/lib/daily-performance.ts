/**
 * One definition of a day's work for the whole CRM.
 *
 * Every screen — Executive, Agent, IT Console, Reports, the Android app — counts
 * a day through this file, so no two places can disagree. The rules are
 * deliberately strict:
 *
 * - The business day is always Asia/Dhaka, decided by the server. A device clock
 *   never decides which day work belongs to.
 * - Only work that actually happened counts: a submitted call report, a
 *   completed follow-up, a recorded booking. Holding a lead is not work, and a
 *   button press is not an outcome.
 * - Cancelled, failed, draft and duplicate records never inflate a number.
 * - Credit follows the person named on the event. A lead handed to someone else
 *   keeps its history, but the work is never counted twice.
 * - Lead-shaped figures (qualified, bookings) are counted once per lead, so a
 *   second call about the same lead cannot double the total.
 */

/** A submitted post-call report — the authoritative record of one call attempt. */
export type CallReportEvent = {
  id: string;
  leadId: string | null;
  agentId: string | null;
  /** Only "submitted" reports count; drafts and pending ones are still in progress. */
  status: string;
  connected: boolean;
  durationSeconds: number | null;
  category: string | null;
  /** When the call ended (falls back to submission time). */
  at: string | null;
};

/** A follow-up, site visit or reminder with its own lifecycle. */
export type FollowUpEvent = {
  id: string;
  leadId: string | null;
  agentId: string | null;
  category: string | null;
  /** pending | completed | cancelled | missed */
  status: string;
  scheduledAt: string | null;
  completedAt: string | null;
  createdAt: string | null;
};

export type DailyPerformance = {
  agentId: string;
  /** Leads sitting on this desk for the day — workload, NOT performance. */
  leadsAssigned: number;
  carriedOverPending: number;
  newFromDatabase: number;
  reassignedIn: number;
  reassignedOut: number;
  /** Real call attempts confirmed by a submitted report. */
  callsAttempted: number;
  /** Attempts the call record confirms were answered. */
  connectedCalls: number;
  /** Distinct leads moved to a promising outcome today. */
  qualifiedLeads: number;
  followUpsCompleted: number;
  siteVisitsScheduled: number;
  siteVisitsCompleted: number;
  /** Distinct leads sold/closed today. */
  bookings: number;
  talkMinutes: number;
  /** Pending work above the day's target — never silently dropped. */
  excessPending: number;
  /** The day's target. Reaching it is not the same as doing the work. */
  target: number;
  /** Share of the target actually worked on (attempted), capped at 100. */
  activityPercent: number;
  /** Connected ÷ attempted, as a percentage. */
  connectRate: number;
  /** Bookings ÷ attempted, as a percentage. */
  conversionRate: number;
};

/** Categories that mean the lead is genuinely promising. */
export const QUALIFYING_CATEGORIES = ["hot_lead", "interested", "closed_converted"];
/** The one category that means a sale. */
export const BOOKING_CATEGORY = "closed_converted";
/** Follow-up categories that represent a visit to the site. */
export const SITE_VISIT_CATEGORIES = ["site_visit", "site-visit", "visit"];

const SUBMITTED = "submitted";

/** Dhaka day boundaries as real UTC instants (UTC+6, no daylight saving). */
export function dhakaDayWindow(dateKey: string): { start: string; end: string } {
  const start = new Date(`${dateKey}T00:00:00+06:00`);
  return {
    start: start.toISOString(),
    end: new Date(start.getTime() + 86_400_000).toISOString(),
  };
}

/** The Asia/Dhaka business date of an instant — never the device's own date. */
export function dhakaDateKey(at: Date = new Date()): string {
  return new Date(at.getTime() + 6 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function withinDay(at: string | null, dateKey: string): boolean {
  if (!at) return false;
  return dhakaDateKey(new Date(at)) === dateKey;
}

/** A report counts as one attempt only when it is submitted and dated in the day. */
export function countsAsAttempt(report: CallReportEvent, dateKey: string): boolean {
  return report.status === SUBMITTED && withinDay(report.at, dateKey);
}

export type WorkloadFacts = {
  leadsAssigned: number;
  carriedOverPending: number;
  newFromDatabase: number;
  reassignedIn: number;
  reassignedOut: number;
  excessPending: number;
  target: number;
};

/**
 * The day's numbers for one desk, from the persisted records themselves.
 *
 * Rerunning this with the same rows always gives the same answer, so a refresh,
 * a retry, a cron rerun, or the same action arriving from both the web and the
 * phone can never change a count or create a duplicate.
 */
export function dailyPerformanceOf(input: {
  agentId: string;
  dateKey: string;
  reports: CallReportEvent[];
  followUps: FollowUpEvent[];
  workload: WorkloadFacts;
}): DailyPerformance {
  const { agentId, dateKey, workload } = input;

  // Credit belongs to whoever did the work, on this day, once per record.
  const seenReports = new Set<string>();
  const attempts: CallReportEvent[] = [];
  for (const report of input.reports) {
    if (report.agentId !== agentId) continue;
    if (!countsAsAttempt(report, dateKey)) continue;
    if (seenReports.has(report.id)) continue;
    seenReports.add(report.id);
    attempts.push(report);
  }

  const connected = attempts.filter((report) => report.connected);
  const talkSeconds = connected.reduce((sum, report) => sum + Math.max(0, report.durationSeconds ?? 0), 0);

  // Lead-shaped outcomes are counted once per lead, however many calls it took.
  const qualified = new Set<string>();
  const booked = new Set<string>();
  for (const report of attempts) {
    if (!report.leadId || !report.category) continue;
    if (QUALIFYING_CATEGORIES.includes(report.category)) qualified.add(report.leadId);
    if (report.category === BOOKING_CATEGORY) booked.add(report.leadId);
  }

  const mine = input.followUps.filter((event) => event.agentId === agentId);
  const isVisit = (event: FollowUpEvent) =>
    SITE_VISIT_CATEGORIES.includes((event.category ?? "").toLowerCase());
  const live = (event: FollowUpEvent) => event.status !== "cancelled";

  const followUpsCompleted = new Set(
    mine
      .filter((event) => event.status === "completed" && withinDay(event.completedAt, dateKey))
      .map((event) => event.id),
  ).size;

  const siteVisitsScheduled = new Set(
    mine
      .filter(
        (event) =>
          isVisit(event) &&
          live(event) &&
          (withinDay(event.scheduledAt, dateKey) || withinDay(event.createdAt, dateKey)),
      )
      .map((event) => event.id),
  ).size;

  const siteVisitsCompleted = new Set(
    mine
      .filter(
        (event) => isVisit(event) && event.status === "completed" && withinDay(event.completedAt, dateKey),
      )
      .map((event) => event.id),
  ).size;

  const callsAttempted = attempts.length;
  const target = workload.target;

  return {
    agentId,
    leadsAssigned: workload.leadsAssigned,
    carriedOverPending: workload.carriedOverPending,
    newFromDatabase: workload.newFromDatabase,
    reassignedIn: workload.reassignedIn,
    reassignedOut: workload.reassignedOut,
    callsAttempted,
    connectedCalls: connected.length,
    qualifiedLeads: qualified.size,
    followUpsCompleted,
    siteVisitsScheduled,
    siteVisitsCompleted,
    bookings: booked.size,
    talkMinutes: Math.round(talkSeconds / 60),
    excessPending: workload.excessPending,
    target,
    activityPercent: target > 0 ? Math.min(100, Math.round((callsAttempted / target) * 100)) : 0,
    connectRate: callsAttempted > 0 ? Math.round((connected.length / callsAttempted) * 100) : 0,
    conversionRate: callsAttempted > 0 ? Math.round((booked.size / callsAttempted) * 100) : 0,
  };
}

/** Floor totals, summed from the same per-desk numbers — never recounted differently. */
export function floorTotals(rows: DailyPerformance[]) {
  const sum = (pick: (row: DailyPerformance) => number) => rows.reduce((total, row) => total + pick(row), 0);
  const attempted = sum((row) => row.callsAttempted);
  const connected = sum((row) => row.connectedCalls);
  const bookings = sum((row) => row.bookings);
  return {
    agents: rows.length,
    leadsAssigned: sum((row) => row.leadsAssigned),
    carriedOverPending: sum((row) => row.carriedOverPending),
    newFromDatabase: sum((row) => row.newFromDatabase),
    reassigned: sum((row) => row.reassignedIn),
    callsAttempted: attempted,
    connectedCalls: connected,
    qualifiedLeads: sum((row) => row.qualifiedLeads),
    followUpsCompleted: sum((row) => row.followUpsCompleted),
    siteVisitsScheduled: sum((row) => row.siteVisitsScheduled),
    siteVisitsCompleted: sum((row) => row.siteVisitsCompleted),
    bookings,
    talkMinutes: sum((row) => row.talkMinutes),
    excessPending: sum((row) => row.excessPending),
    target: sum((row) => row.target),
    connectRate: attempted > 0 ? Math.round((connected / attempted) * 100) : 0,
    conversionRate: attempted > 0 ? Math.round((bookings / attempted) * 100) : 0,
  };
}
