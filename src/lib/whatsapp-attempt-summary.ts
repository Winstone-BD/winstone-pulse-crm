export type WhatsappAttempt = { agentName: string | null; submitted: boolean; startedAt: string };
/** Aggregates the existing bounded, authority-scoped report feed. */
export function summarizeWhatsappAttempts(attempts: readonly WhatsappAttempt[]) {
  const groups = new Map<string | null, { agentName: string | null; attempts: number; submitted: number; pending: number; lastAttemptAt: string }>();
  for (const a of attempts) {
    const row = groups.get(a.agentName) ?? { agentName: a.agentName, attempts: 0, submitted: 0, pending: 0, lastAttemptAt: a.startedAt };
    row.attempts++;
    if (a.submitted) row.submitted++; else row.pending++;
    if (a.startedAt > row.lastAttemptAt) row.lastAttemptAt = a.startedAt;
    groups.set(a.agentName, row);
  }
  return [...groups.values()].sort((a, b) => b.pending - a.pending || b.attempts - a.attempts);
}

/** Export the displayed totals and their inclusive Dhaka date range. */
export function whatsappSummaryCsv(rows: ReturnType<typeof summarizeWhatsappAttempts>, from: string, to: string) {
  const cell = (value: unknown) => {
    let text = value == null ? "" : String(value);
    if (/^\s*[=+\-@]/.test(text) || /^[\t\r\n]/.test(text)) text = `'${text}`;
    return `"${text.replace(/"/g, '""')}"`;
  };
  const headers = ["Agent", "Attempts", "Submitted", "Pending", "Last attempt (Dhaka)", "From date (Dhaka)", "To date (Dhaka)"];
  return "\uFEFF" + [headers, ...rows.map(row => [row.agentName, row.attempts, row.submitted, row.pending,
    new Date(Date.parse(row.lastAttemptAt) + 6 * 3600_000).toISOString().replace("Z", "+06:00"), from, to])]
    .map(row => row.map(cell).join(",")).join("\r\n");
}
