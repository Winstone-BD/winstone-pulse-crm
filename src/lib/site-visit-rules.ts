/**
 * Pure site-visit rules shared by the server and tests: allowed status moves
 * and which reminder stage (24h / 2h / late / outcome) a visit is in.
 * Event keys include visit_at, so a rescheduled visit gets fresh reminders
 * while a repeated sweep for the same time stays silent.
 */
export type VisitStatus = "scheduled" | "confirmed" | "completed" | "offer_made" | "cancelled" | "no_show";

const MOVES: Record<VisitStatus, VisitStatus[]> = {
  scheduled: ["confirmed", "completed", "cancelled", "no_show"],
  confirmed: ["completed", "cancelled", "no_show"],
  completed: ["offer_made"],
  offer_made: [],
  cancelled: [],
  no_show: [],
};

export function canMoveVisit(from: string, to: string): boolean {
  return (MOVES[from as VisitStatus] ?? []).includes(to as VisitStatus);
}

export type VisitReminderStage = "24h" | "2h" | "late" | "outcome";

const H = 3_600_000;

export function visitReminderStage(
  v: { status: string; visit_at: string; outcome_at?: string | null },
  nowMs: number,
): VisitReminderStage | null {
  if (v.status === "completed") return v.outcome_at ? null : "outcome";
  if (v.status !== "scheduled" && v.status !== "confirmed") return null; // cancelled / no_show / offer_made
  const diff = new Date(v.visit_at).getTime() - nowMs;
  if (Number.isNaN(diff)) return null;
  if (diff <= 0) return "late";
  if (diff <= 2 * H) return "2h";
  if (diff <= 24 * H) return "24h";
  return null;
}

/** When the 2-hour reminder fires for a booked visit (null when the visit is not upcoming). */
export function visitTwoHourReminderAt(v: { status: string; visit_at: string }): Date | null {
  if (v.status !== "scheduled" && v.status !== "confirmed") return null;
  const at = new Date(v.visit_at).getTime();
  return Number.isNaN(at) ? null : new Date(at - 2 * H);
}

/** One push per stage per scheduled time per recipient; late/outcome repeat every 3h. */
export function visitReminderKey(
  v: { id: string; visit_at: string },
  stage: VisitReminderStage,
  recipientId: string,
  nowMs: number,
): string {
  const at = new Date(v.visit_at).toISOString();
  const tail = stage === "late" || stage === "outcome" ? `:${Math.floor(nowMs / (3 * H))}` : "";
  return `site_visit_${stage}:${v.id}:${at}:${recipientId}${tail}`;
}
