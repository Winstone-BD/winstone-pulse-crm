export type AgentAction = { type: string; label: string; params: Record<string, string | number | null> };

export const NO_ANSWER_MESSAGE = "উত্তর আসেনি — পেজটি রিফ্রেশ করে আবার চেষ্টা করুন";

/**
 * Turns whatever the server returned into a safe turn update. Missing, empty or
 * malformed results become an error message instead of crashing the panel.
 */
export function normalizeAgentResult(
  result: unknown,
): { ok: true; answer: string; facts: string[]; actions: AgentAction[] } | { ok: false; error: string } {
  if (!result || typeof result !== "object") return { ok: false, error: NO_ANSWER_MESSAGE };
  const r = result as { answer?: unknown; facts?: unknown; actions?: unknown };
  if (typeof r.answer !== "string" || !r.answer.trim()) return { ok: false, error: NO_ANSWER_MESSAGE };
  const facts = Array.isArray(r.facts) ? r.facts.filter((f): f is string => typeof f === "string") : [];
  const actions = Array.isArray(r.actions)
    ? (r.actions.filter(
        (a) => a && typeof a === "object" && typeof (a as AgentAction).type === "string" && typeof (a as AgentAction).label === "string",
      ) as AgentAction[]).map((a) => ({ ...a, params: a.params && typeof a.params === "object" ? a.params : {} }))
    : [];
  return { ok: true, answer: r.answer, facts, actions };
}
