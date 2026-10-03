/**
 * LOCKED daily performance rule (2026-09-30). Pure — no I/O.
 * KPI completion = MIN(actual/target, 100%); performance = Σ completion × weight.
 * Default weights: Calls 50 + Site Visits 50. Lead quality is never mixed in.
 */
export type KpiWeights = { calls: number; siteVisits: number };
export const DEFAULT_KPI_WEIGHTS: KpiWeights = { calls: 50, siteVisits: 50 };

export function kpiCompletion(actual: number, target: number): number {
  if (!(target > 0)) return 0;
  return Math.min(Math.max(actual, 0) / target, 1);
}

export function dailyPerformance(
  input: { calls: number; callTarget: number; siteVisits: number; visitTarget: number },
  weights: KpiWeights = DEFAULT_KPI_WEIGHTS,
): number {
  const total = weights.calls + weights.siteVisits;
  if (!(total > 0)) return 0;
  const raw =
    kpiCompletion(input.calls, input.callTarget) * weights.calls +
    kpiCompletion(input.siteVisits, input.visitTarget) * weights.siteVisits;
  return Math.round((raw / total) * 1000) / 10; // one decimal, 0–100
}

export type KpiLine = {
  agentId: string;
  performance: number;
  completedSiteVisits: number;
  hotLeads: number;
  bookings: number;
  completedCalls: number;
  /** ISO time the final score was reached; earlier wins a full tie. */
  achievedAt: string | null;
};

/** Locked Top 3 tie-break chain, then agent id so order never flips. */
export function rankKpiLines(lines: KpiLine[]): KpiLine[] {
  const t = (s: string | null) => (s ? Date.parse(s) : Number.POSITIVE_INFINITY);
  return [...lines].sort(
    (a, b) =>
      b.performance - a.performance ||
      b.completedSiteVisits - a.completedSiteVisits ||
      b.hotLeads - a.hotLeads ||
      b.bookings - a.bookings ||
      b.completedCalls - a.completedCalls ||
      t(a.achievedAt) - t(b.achievedAt) ||
      (a.agentId < b.agentId ? -1 : a.agentId > b.agentId ? 1 : 0),
  );
}

/** live < 17:30 ≤ snapshot (still live numbers) < 18:00 ≤ final (locked). */
export function kpiPhase(dhakaMinuteOfDay: number): "live" | "snapshot" | "final" {
  if (dhakaMinuteOfDay >= 18 * 60) return "final";
  if (dhakaMinuteOfDay >= 17 * 60 + 30) return "snapshot";
  return "live";
}
