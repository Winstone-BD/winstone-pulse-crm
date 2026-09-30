/** Browser-safe constants and helpers for the head lead database. */

/** Stable source identifier retained for historical compatibility; UI calls this LeadHub Nexus. */
export const HEAD_DATABASE_SOURCE = "head_database";

/** How many more pool leads the next full daily round needs (0 = ready). */
export function leadsNeededForNextRound(poolCount: number, agentCount: number, perAgent: number) {
  return Math.max(0, agentCount * perAgent - Math.max(0, poolCount));
}
