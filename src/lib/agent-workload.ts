import { NEW_LEAD_TARGET } from "@/lib/new-lead-topup";

export function workloadRow(newLeads: number, pending: number, calls: number) {
  return { newLeads, pending, calls, gap: Math.max(0, NEW_LEAD_TARGET - newLeads), ok: newLeads === NEW_LEAD_TARGET };
}

export function isPendingWork(status: string, workState: string | null) {
  return status === "pending" && workState !== "completed" && workState !== "unresponsive" && workState !== "duplicate_skipped" && workState !== "snoozed";
}

export function dhakaDayBounds(day: string) {
  const start = new Date(`${day}T00:00:00+06:00`);
  if (!Number.isFinite(start.getTime()) || new Date(start.getTime() + 21600000).toISOString().slice(0, 10) !== day) throw new Error("Invalid date");
  return { start: start.toISOString(), end: new Date(start.getTime() + 86400000).toISOString() };
}