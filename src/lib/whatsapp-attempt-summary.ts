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
