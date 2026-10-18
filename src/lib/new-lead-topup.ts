/** Pure rule: how many NEW leads each agent still needs to reach the daily target. */
export const NEW_LEAD_TARGET = 50;

export function newLeadNeeds(
  agents: { id: string; name: string }[],
  newToday: Map<string, number>,
  target = NEW_LEAD_TARGET,
): { agentId: string; name: string; have: number; need: number }[] {
  return agents.map((a) => {
    const have = newToday.get(a.id) ?? 0;
    return { agentId: a.id, name: a.name, have, need: Math.max(0, target - have) };
  });
}

/** Same plan? (agent → need) — the confirm step refuses if anything moved since Preview. */
export function samePlan(a: Record<string, number>, b: Record<string, number>): boolean {
  const ka = Object.keys(a), kb = Object.keys(b);
  return ka.length === kb.length && ka.every((k) => b[k] === a[k]);
}
