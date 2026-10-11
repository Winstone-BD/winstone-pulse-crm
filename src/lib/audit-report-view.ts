/**
 * Pure view helpers for /audit-report. Every value is derived from the
 * canonical handover-docs.ts records — nothing is invented here.
 */
export type AuditItem = { item: string; result: string; evidence: string };
export type ResultKind = "pass" | "qualified" | "other";

export function resultKind(result: string): ResultKind {
  const r = result.trim().toUpperCase();
  if (r === "PASS") return "pass";
  if (r.startsWith("PASS")) return "qualified";
  return "other";
}

/** Text inside parentheses, e.g. "code/test" for "PASS (code/test)". */
export function resultQualifier(result: string): string | null {
  return result.match(/\(([^)]+)\)/)?.[1] ?? null;
}

export function qualifierMeaning(q: string | null): string | null {
  if (!q) return null;
  if (q === "code/test") return "Verified by reading code, database rules and automated tests — not by a live end-to-end run on real devices or signed-in sessions.";
  if (q === "public pages") return "Verified on public pages only; PIN and signed-in screens were not part of this check.";
  return `Verification limited to: ${q}.`;
}

export function itemNumber(item: string): string {
  return item.match(/^(\d+)\./)?.[1] ?? "";
}
export function itemTitle(item: string): string {
  return item.replace(/^\d+\.\s*/, "");
}

export function resultOptions(items: AuditItem[]): string[] {
  return [...new Set(items.map((i) => i.result))];
}

export function countResults(items: AuditItem[]) {
  return {
    total: items.length,
    pass: items.filter((i) => resultKind(i.result) === "pass").length,
    qualified: items.filter((i) => resultKind(i.result) === "qualified").length,
    other: items.filter((i) => resultKind(i.result) === "other").length,
  };
}

export function filterItems(items: AuditItem[], q: string, result: string): AuditItem[] {
  const needle = q.trim().toLowerCase();
  return items.filter((i) =>
    (!result || i.result === result) &&
    (!needle || i.item.toLowerCase().includes(needle) || i.evidence.toLowerCase().includes(needle)));
}

/** Days between the documented audit date (leading YYYY-MM-DD HH:MM UTC) and now. */
export function auditAgeDays(auditDate: string, now: Date = new Date()): number | null {
  const m = auditDate.match(/^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}) UTC/);
  if (!m) return null;
  const t = Date.parse(`${m[1]}T${m[2]}:00Z`);
  return Number.isNaN(t) ? null : Math.floor((now.getTime() - t) / 86_400_000);
}

export const STALE_AFTER_DAYS = 30;
