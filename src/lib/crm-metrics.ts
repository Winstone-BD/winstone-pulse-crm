/**
 * The CRM-wide metric contract.
 *
 * Every screen that shows a floor-level number reads it from `getFloorMetrics`
 * (src/lib/crm-metrics.functions.ts), which computes the values with exactly the
 * conditions documented below. Day boundaries are always Asia/Dhaka and always
 * decided on the server (see src/lib/daily-performance.ts).
 *
 * Metric definitions — the only accepted conditions:
 *
 * | Metric            | Condition                                                             |
 * | ----------------- | --------------------------------------------------------------------- |
 * | totalLeads        | every row in `leads`                                                  |
 * | newLeads          | `leads.work_state = 'pending'` AND no call attempt yet                 |
 * | contactedLeads    | `leads.call_attempts > 0` OR `leads.last_call_at` is set              |
 * | pendingLeads      | `leads.work_state <> 'completed'`                                     |
 * | qualifiedLeads    | `leads.temperature` in ('hot','warm')                                 |
 * | assignedLeads     | `leads.assigned_to` is set                                            |
 * | unassignedLeads   | `leads.assigned_to` is null                                           |
 * | closedWon         | `leads.status = 'closed'` AND `outcome_category = 'deal_won'`         |
 * | callAttempts      | submitted `call_reports` (one report = one attempt)                   |
 * | connectedCalls    | submitted `call_reports` with `connection_verified = true` (the phone proved the call was answered) |
 * | contactedLeadsByCall | distinct leads with at least one verified connected call             |
 * | attemptsToday     | submitted reports whose day (`call_ended_at`, else `submitted_at`) is today |
 * | connectedToday    | as above, `connection_verified = true`                                 |
 * | talkMinutesToday  | sum of measured `duration_seconds` over today's verified connected calls; `null` when nothing was measured (unavailable, never 0) |
 * | followUpDue       | open follow-ups (`upcoming`/`pending`) scheduled inside the Dhaka day |
 * | followUpOverdue   | open follow-ups scheduled before now                                  |
 * | visitsCompleted   | completed follow-ups in a site-visit category                        |
 * | trend             | submitted reports grouped by Dhaka day (attempts vs connected)       |
 *
 * Rules that hold for all of them:
 * - Lead-shaped metrics are counted once per lead id; event-shaped metrics count events.
 * - Drafts, pending, cancelled and missed records never inflate a number.
 * - Call recordings are NOT a call count — only a submitted report is an attempt.
 *   Recording sync is reported separately as `recordingSync`.
 * - A submitted report is NOT proof of a conversation. Connected calls, contacted
 *   leads and talk time all require telephony evidence (measured duration, synced
 *   recording, or logged call start) — see src/lib/call-evidence.ts.
 * - One call session counts once: two uploads of the same call (phone retry plus
 *   the web popup) are de-duplicated on the recording id.
 */

export type FloorMetrics = {
  /** Asia/Dhaka business date the "today" figures belong to. */
  dateKey: string;
  timeZone: "Asia/Dhaka";
  /** When the server computed these numbers. */
  generatedAt: string;
  totalLeads: number;
  newLeads: number;
  contactedLeads: number;
  pendingLeads: number;
  qualifiedLeads: number;
  hotLeads: number;
  warmLeads: number;
  coldLeads: number;
  assignedLeads: number;
  unassignedLeads: number;
  closedWon: number;
  callAttempts: number;
  connectedCalls: number;
  attemptsToday: number;
  connectedToday: number;
  /** Distinct leads with at least one verified connected call. */
  contactedLeadsByCall: number;
  /** Minutes of measured talk today; `null` = no measured duration available. */
  talkMinutesToday: number | null;
  /** Today's connected calls that carried a measured duration. */
  talkTimeMeasuredToday: number;
  followUpDue: number;
  followUpOverdue: number;
  visitsCompleted: number;
  /** Recordings actually synced from agent phones — evidence, not a call count. */
  recordingSync: number;
  trend: { dateKey: string; attempts: number; connected: number }[];
  agents: {
    agentId: string;
    name: string;
    employeeId: string | null;
    attempts: number;
    connected: number;
    bookings: number;
    /** Distinct leads this agent actually spoke to. */
    contactedLeads: number;
    /** Minutes talked on measured connected calls; `null` = unavailable. */
    talkMinutes: number | null;
  }[];
};

export function contactRate(m: Pick<FloorMetrics, "totalLeads" | "contactedLeads">): number {
  return m.totalLeads ? Math.round((m.contactedLeads / m.totalLeads) * 100) : 0;
}

export function connectRate(m: Pick<FloorMetrics, "callAttempts" | "connectedCalls">): number {
  return m.callAttempts ? Math.round((m.connectedCalls / m.callAttempts) * 100) : 0;
}

export function winRate(m: Pick<FloorMetrics, "totalLeads" | "closedWon">): number {
  return m.totalLeads ? Math.round((m.closedWon / m.totalLeads) * 100) : 0;
}
