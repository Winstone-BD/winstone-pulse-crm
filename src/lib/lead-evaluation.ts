/**
 * LOCKED V2 lead evaluation rule (2026-09-30). Do not change the points,
 * bands or priority mapping without an explicit business decision.
 *
 * The agent only records yes/no facts. Score, Hot/Warm/Cold and follow-up
 * priority are always derived here, on the server — never picked by hand.
 * Legacy V1 reports are never rescored with this model.
 */
export const EVALUATION_MODEL = "v2_six_question";

export const EVALUATION_QUESTIONS = [
  { key: "project_interest", points: 15, label: "প্রজেক্টে আগ্রহ দেখিয়েছে?" },
  { key: "asked_price", points: 15, label: "দাম / পেমেন্ট প্ল্যান জিজ্ঞেস করেছে?" },
  { key: "wanted_info", points: 10, label: "ব্রোশিউর / WhatsApp / প্রজেক্ট তথ্য চেয়েছে?" },
  { key: "visit_interest", points: 20, label: "মিটিং / অফিস / সাইট ভিজিটে আগ্রহী?" },
  { key: "decision_30d", points: 20, label: "৩০ দিনের মধ্যে সিদ্ধান্তের সম্ভাবনা?" },
  { key: "wants_follow_up", points: 10, label: "ফলো-আপ চেয়েছে?" },
] as const;

/** English labels, keyed by question key (same six keys as EVALUATION_QUESTIONS). */
export const EVALUATION_QUESTIONS_LABEL_EN: Record<string, string> = {
  project_interest: "Showed interest in the project?",
  asked_price: "Asked about price / payment plan?",
  wanted_info: "Asked for brochure / WhatsApp / project info?",
  visit_interest: "Interested in a meeting / office / site visit?",
  decision_30d: "Likely to decide within 30 days?",
  wants_follow_up: "Requested a follow-up?",
};

export type EvaluationKey = (typeof EVALUATION_QUESTIONS)[number]["key"];
export type EvaluationAnswers = Record<EvaluationKey, boolean>;
export type EvaluationCategory = "hot" | "warm" | "cold";
export type FollowUpPriority = "high" | "medium" | "low";

export const MAX_SCORE = 90;

/** Returns null unless every one of the six questions has a true/false answer. */
export function parseAnswers(raw: unknown): EvaluationAnswers | null {
  if (!raw || typeof raw !== "object") return null;
  const out = {} as EvaluationAnswers;
  for (const q of EVALUATION_QUESTIONS) {
    const v = (raw as Record<string, unknown>)[q.key];
    if (typeof v !== "boolean") return null;
    out[q.key] = v;
  }
  return out;
}

export function scoreAnswers(a: EvaluationAnswers): number {
  return EVALUATION_QUESTIONS.reduce((sum, q) => sum + (a[q.key] ? q.points : 0), 0);
}

export function categoryForScore(score: number): EvaluationCategory {
  if (score <= 20) return "cold";
  if (score <= 50) return "warm";
  return "hot";
}

/** Follow-up is the customer's real future-contact intent, independent of category. */
export function priorityFor(category: EvaluationCategory, followUpPending: boolean): FollowUpPriority | null {
  if (!followUpPending) return null;
  return category === "hot" ? "high" : category === "warm" ? "medium" : "low";
}

export function nextBestAction(category: EvaluationCategory, a: EvaluationAnswers, followUpPending: boolean): string {
  if (category === "hot" && a.visit_interest) return "সাইট ভিজিট / মিটিং নিশ্চিত করুন";
  if (category === "hot") return "আজই দাম ও পেমেন্ট প্ল্যান নিয়ে ফলো-আপ করুন";
  if (a.wanted_info) return "WhatsApp-এ ব্রোশিউর ও প্রজেক্ট তথ্য পাঠান";
  if (followUpPending) return "নির্ধারিত সময়ে ফলো-আপ কল করুন";
  if (category === "warm") return "আগ্রহ বাড়াতে প্রজেক্টের সুবিধা জানিয়ে আবার কল করুন";
  return "নিয়মিত তালিকায় রাখুন";
}

/** Immutable audit payload (stored in append-only lead_events). */
export function evaluationAuditDetail(input: {
  answers: EvaluationAnswers;
  followUpPending: boolean;
  reportId: string;
  recordingId: string | null;
  agentId: string;
  at: string;
}) {
  const r = evaluate(input.answers, input.followUpPending);
  return JSON.stringify({
    rule_version: EVALUATION_MODEL,
    report_id: input.reportId,
    call_id: input.recordingId,
    agent_id: input.agentId,
    answers: input.answers,
    score: r.score,
    category: r.category,
    follow_up: input.followUpPending,
    priority: r.priority,
    at: input.at,
  });
}

export function evaluate(a: EvaluationAnswers, followUpPending: boolean) {
  const score = scoreAnswers(a);
  const category = categoryForScore(score);
  return {
    score,
    category,
    priority: priorityFor(category, followUpPending),
    nextAction: nextBestAction(category, a, followUpPending),
  };
}
