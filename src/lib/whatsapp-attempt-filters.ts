export type AttemptRow = {
  id: string; agentName: string | null; startedAt: string; submitted: boolean;
  leadName: string | null; phoneNumber: string | null; typedSeconds: number | null; submittedAt: string | null;
};
export type AttemptFilters = { from: string; to: string; agent: string; status: "all" | "submitted" | "pending" };
/** Inclusive calendar dates in Dhaka; never expands the scoped latest-300 feed. */
export function filterWhatsappAttempts<T extends Pick<AttemptRow, "startedAt" | "agentName" | "submitted">>(rows: readonly T[], filters: AttemptFilters): T[] {
  return rows.filter((row) => {
    const time = Date.parse(row.startedAt);
    if (!Number.isFinite(time)) return false;
    const day = new Date(time + 6 * 3600_000).toISOString().slice(0, 10);
    return (!filters.from || day >= filters.from) && (!filters.to || day <= filters.to)
      && (!filters.agent || (row.agentName ?? "") === filters.agent)
      && (filters.status === "all" || row.submitted === (filters.status === "submitted"));
  });
}
function cell(value: unknown) {
  let text = value == null ? "" : String(value);
  if (/^\s*[=+\-@]/.test(text) || /^[\t\r\n]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}
export function whatsappAttemptsCsv(rows: readonly AttemptRow[]) {
  const headers = ["Report ID", "Lead", "Phone", "Agent", "Started (Dhaka)", "Report status", "Agent-entered seconds", "Submitted at"];
  return "\uFEFF" + [headers, ...rows.map((r) => [r.id, r.leadName, r.phoneNumber, r.agentName,
    new Date(Date.parse(r.startedAt) + 6 * 3600_000).toISOString().replace("Z", "+06:00"),
    r.submitted ? "Submitted" : "Pending", r.typedSeconds, r.submittedAt])].map((r) => r.map(cell).join(",")).join("\r\n");
}