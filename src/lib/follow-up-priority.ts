export type FollowUpPriority = "high" | "medium" | "low";

type FollowUpLike = {
  id: string;
  scheduled_at: string;
  reminder_minutes?: number | null;
  priority?: string | null;
};

const PRIORITY_RANK: Record<string, number> = { high: 3, medium: 2, normal: 2, low: 1 };

/** Legacy reports use their saved temperature; V2 reports pass their server-derived category. */
export function followUpPriorityFor(temperature?: string | null): FollowUpPriority {
  if (temperature === "hot") return "high";
  if (temperature === "warm") return "medium";
  return "low";
}

function timeBand(row: FollowUpLike, now: number): number {
  const scheduled = Date.parse(row.scheduled_at);
  if (!Number.isFinite(scheduled)) return 0;
  if (scheduled < now) return 3;
  const reminderAt = scheduled - (row.reminder_minutes ?? 30) * 60_000;
  if (reminderAt <= now) return 2;
  if (scheduled - now <= 24 * 60 * 60_000) return 1;
  return 0;
}

/** Time urgency wins; Hot/Warm/Cold priority breaks ties; then the earliest time wins. */
export function compareFollowUpPriority(a: FollowUpLike, b: FollowUpLike, now = Date.now()) {
  return (
    timeBand(b, now) - timeBand(a, now) ||
    (PRIORITY_RANK[b.priority ?? ""] ?? 0) - (PRIORITY_RANK[a.priority ?? ""] ?? 0) ||
    a.scheduled_at.localeCompare(b.scheduled_at) ||
    a.id.localeCompare(b.id)
  );
}

export const FOLLOW_UP_PRIORITY_LABEL: Record<string, string> = {
  high: "Hot · সর্বোচ্চ",
  medium: "Warm · গুরুত্বপূর্ণ",
  normal: "Warm · গুরুত্বপূর্ণ",
  low: "Cold · সাধারণ",
};