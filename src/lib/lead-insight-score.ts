/**
 * Lead Insight Score (pure, shared). A transparent 100-point helper score
 * built only from saved facts. It sits BESIDE the locked V2 score (6-answer
 * Cold/Warm/Hot) and never changes temperature, grade or priority.
 *
 *   Call duration     up to 25  — longest connected call, 30s → 0 … 5 min → 25
 *   Engagement        up to 40  — price 10, site visit 15, project 5, info 4, decision ≤30d 6
 *   AI sentiment      up to 35  — sentiment up to 20 + AI intent/temperature up to 15
 *
 * Missing AI analysis scores 0 and is shown as "not analysed" — never guessed.
 */

export const HIGH_POTENTIAL_SCORE = 60;
/** A lead held this many business days with no work is "neglected" (48h rule). */
export const NEGLECT_BUSINESS_DAYS = 2;
/** A follow-up this many hours past its time is "overdue-neglected". */
export const OVERDUE_FOLLOW_UP_HOURS = 48;

export type ScoreInputs = {
  reports: {
    connected: boolean | null;
    duration_seconds: number | null;
    evaluation_answers: Record<string, unknown> | null;
    interest?: string | null;
  }[];
  recordings: {
    duration_seconds: number | null;
    sentiment: string | null;
    ai_intent: string | null;
    ai_temperature: string | null;
  }[];
  followUpReasons: (string | null)[];
};

export type ScoreLine = { label: string; points: number };
export type ScorePart = { points: number; max: number; lines: ScoreLine[]; note?: string };
export type LeadInsightScore = {
  total: number;
  duration: ScorePart;
  engagement: ScorePart;
  ai: ScorePart;
  visitInterest: boolean;
  highPotential: boolean;
};

const ENGAGEMENT: { key: string; label: string; points: number; followUp?: string }[] = [
  { key: "asked_price", label: "Asked about price", points: 10, followUp: "price" },
  { key: "visit_interest", label: "Site visit interest", points: 15, followUp: "site_visit" },
  { key: "project_interest", label: "Interested in a project", points: 5, followUp: "project_details" },
  { key: "wanted_info", label: "Wanted more information", points: 4, followUp: "brochure" },
  { key: "decision_30d", label: "Decision within 30 days", points: 6 },
];

const SENTIMENT: Record<string, number> = { positive: 20, neutral: 10, negative: 3, critical: 0 };

function intentPoints(value: string | null | undefined): number | null {
  const v = (value ?? "").toLowerCase();
  if (!v) return null;
  if (/(hot|buy|purchase|book|visit|high)/.test(v)) return 15;
  if (/(warm|interest|consider|medium|info)/.test(v)) return 8;
  if (/(cold|not|low|fake|no)/.test(v)) return 0;
  return null;
}

export function scoreLead(input: ScoreInputs): LeadInsightScore {
  // Duration — longest connected call, linear 30s → 300s.
  const durations = [
    ...input.reports.filter((r) => r.connected).map((r) => r.duration_seconds ?? 0),
    ...input.recordings.map((r) => r.duration_seconds ?? 0),
  ];
  const longest = Math.max(0, ...durations);
  const durPts = longest < 30 ? 0 : Math.min(25, Math.round(((longest - 30) / 270) * 25));
  const duration: ScorePart = {
    points: durPts,
    max: 25,
    lines: [{ label: longest ? `Longest call ${Math.floor(longest / 60)}m ${longest % 60}s` : "No connected call yet", points: durPts }],
  };

  // Engagement — any saved yes answer or matching follow-up reason counts once.
  const reasons = new Set(input.followUpReasons.filter(Boolean) as string[]);
  const lines: ScoreLine[] = [];
  let visitInterest = false;
  for (const item of ENGAGEMENT) {
    const said = input.reports.some((r) => r.evaluation_answers?.[item.key] === true)
      || (item.followUp ? reasons.has(item.followUp) : false);
    if (said) {
      lines.push({ label: item.label, points: item.points });
      if (item.key === "visit_interest") visitInterest = true;
    }
  }
  const engPts = Math.min(40, lines.reduce((s, l) => s + l.points, 0));
  const engagement: ScorePart = { points: engPts, max: 40, lines, note: lines.length ? undefined : "No interest signals saved yet" };

  // AI — best analysed recording only.
  let best: { s: number; i: number } | null = null;
  for (const r of input.recordings) {
    const s = r.sentiment ? SENTIMENT[r.sentiment] ?? null : null;
    const i = intentPoints(r.ai_intent) ?? intentPoints(r.ai_temperature);
    if (s === null && i === null) continue;
    const cand = { s: s ?? 0, i: i ?? 0 };
    if (!best || cand.s + cand.i > best.s + best.i) best = cand;
  }
  const ai: ScorePart = best
    ? { points: Math.min(35, best.s + best.i), max: 35, lines: [{ label: "Transcript sentiment", points: best.s }, { label: "Transcript intent", points: best.i }] }
    : { points: 0, max: 35, lines: [], note: "Not analysed yet — counts as 0" };

  const total = duration.points + engagement.points + ai.points;
  return { total, duration, engagement, ai, visitInterest, highPotential: total >= HIGH_POTENTIAL_SCORE || visitInterest };
}

export type ReassignBlockers = { upcomingVisits: number; activeBookings: number };

/** Safeguard: a lead with a confirmed upcoming visit or live booking needs a written bypass reason. */
export function reassignNeedsBypass(b: ReassignBlockers): boolean {
  return b.upcomingVisits > 0 || b.activeBookings > 0;
}

export const MIN_REASON = 10;
