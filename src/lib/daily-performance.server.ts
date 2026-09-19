/**
 * The single server-side source of a day's numbers.
 *
 * Executive HQ, the agent desk, the IT Console, reports and the Android app all
 * read this one function, so their figures cannot drift apart. The business day
 * is always Asia/Dhaka and always decided here, never on a device.
 */
import {
  dailyPerformanceOf,
  dhakaDateKey,
  dhakaDayWindow,
  floorTotals,
  type CallReportEvent,
  type DailyPerformance,
  type FollowUpEvent,
} from "@/lib/daily-performance";
import type { FloorAllocationStatus } from "@/lib/workday-allocation.server";

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

export type DailyPerformanceBoard = {
  dateKey: string;
  timeZone: "Asia/Dhaka";
  windowStart: string;
  windowEnd: string;
  allocation: FloorAllocationStatus;
  rows: (DailyPerformance & { name: string; employeeId: string | null })[];
  totals: ReturnType<typeof floorTotals>;
  /** Row counts that went into the numbers, so any total can be checked. */
  sources: {
    submittedReports: number;
    followUpRows: number;
    /** Reports left out because they are drafts or still pending. */
    unsubmittedReports: number;
  };
};

/** Today's (or a given day's) authoritative performance for every active desk. */
export async function dailyPerformanceBoard(
  dateKey: string = dhakaDateKey(),
): Promise<DailyPerformanceBoard> {
  const supabaseAdmin = await admin();
  const { floorAllocationStatus } = await import("@/lib/workday-allocation.server");
  const { start, end } = dhakaDayWindow(dateKey);

  const [allocation, reportRows, followUpRows] = await Promise.all([
    floorAllocationStatus(dateKey),
    supabaseAdmin
      .from("call_reports")
      .select(
        "id, lead_id, agent_id, status, connected, duration_seconds, category, temperature, grade, call_ended_at, submitted_at",
      )
      // Older reports carry no call_ended_at, so the submission time stands in —
      // otherwise a real day of work would silently count as zero.
      .or(
        [
          `and(call_ended_at.gte.${start},call_ended_at.lt.${end})`,
          `and(call_ended_at.is.null,submitted_at.gte.${start},submitted_at.lt.${end})`,
        ].join(","),
      ),
    supabaseAdmin
      .from("follow_up_events")
      .select("id, lead_id, agent_id, category, status, scheduled_at, completed_at, created_at")
      .or(
        [
          `and(scheduled_at.gte.${start},scheduled_at.lt.${end})`,
          `and(completed_at.gte.${start},completed_at.lt.${end})`,
          `and(created_at.gte.${start},created_at.lt.${end})`,
        ].join(","),
      ),
  ]);

  const reports: CallReportEvent[] = (reportRows.data ?? []).map((row) => ({
    id: row.id,
    leadId: row.lead_id,
    agentId: row.agent_id,
    status: row.status,
    connected: !!row.connected,
    durationSeconds: row.duration_seconds,
    category: row.category,
    at: row.call_ended_at ?? row.submitted_at,
    classified: Boolean(row.temperature && row.grade),
  }));
  const followUps: FollowUpEvent[] = (followUpRows.data ?? []).map((row) => ({
    id: row.id,
    leadId: row.lead_id,
    agentId: row.agent_id,
    category: row.category,
    status: row.status,
    scheduledAt: row.scheduled_at,
    completedAt: row.completed_at,
    createdAt: row.created_at,
  }));

  const rows = allocation.agents.map((agent) => ({
    name: agent.name,
    employeeId: agent.employeeId,
    ...dailyPerformanceOf({
      agentId: agent.agentId,
      dateKey,
      reports,
      followUps,
      workload: {
        leadsAssigned: agent.pending + agent.completed,
        carriedOverPending: agent.carriedOver,
        newFromDatabase: agent.newFromDatabase,
        reassignedIn: agent.receivedFromOthers,
        reassignedOut: agent.movedToOthers,
        excessPending: agent.excess,
        target: agent.quota,
      },
    }),
  }));

  return {
    dateKey,
    timeZone: "Asia/Dhaka",
    windowStart: start,
    windowEnd: end,
    allocation,
    rows,
    totals: floorTotals(rows),
    sources: {
      submittedReports: reports.filter((row) => row.status === "submitted").length,
      unsubmittedReports: reports.filter((row) => row.status !== "submitted").length,
      followUpRows: followUps.length,
    },
  };
}

/** One desk's own day — the same numbers the floor board shows for that row. */
export async function agentDailyPerformance(agentId: string, dateKey: string = dhakaDateKey()) {
  const board = await dailyPerformanceBoard(dateKey);
  return {
    dateKey: board.dateKey,
    timeZone: board.timeZone,
    me: board.rows.find((row) => row.agentId === agentId) ?? null,
    poolAvailable: board.allocation.poolAvailable,
    poolShortage: board.allocation.shortage,
  };
}
