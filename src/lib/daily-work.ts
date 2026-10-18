import { dhakaDay } from "./lead-groups";
import type { Lead } from "./crm-data";
export function callableLeads(leads: Lead[], now = Date.now()) {
  return leads
    .filter(
      (l) =>
        l.status !== "closed" &&
        !["completed", "unresponsive", "duplicate_skipped", "recalled"].includes(l.work_state) &&
        (l.work_state !== "snoozed" ||
          (l.retry_after !== null && Date.parse(l.retry_after) <= now)),
    )
    .sort(
      (a, b) =>
        (({ hot: 0, warm: 1, cold: 2 })[a.temperature ?? "cold"] ?? 3) -
          ({ hot: 0, warm: 1, cold: 2 }[b.temperature ?? "cold"] ?? 3) ||
        a.created_at.localeCompare(b.created_at),
    );
}
export function followUpCounts(rows: { status: string; scheduled_at: string }[], now = Date.now()) {
  const today = dhakaDay(now);
  return {
    today: rows.filter((r) => r.status !== "done" && dhakaDay(r.scheduled_at) === today).length,
    overdue: rows.filter((r) => r.status !== "done" && Date.parse(r.scheduled_at) < now).length,
  };
}
