import { leadOwner } from "@/lib/lead-owner";

export function requireHqLeadReview(scope: string, owner: string | null, agentId: string, eligible: boolean) {
  if (scope !== "authority") throw new Error("HQ/IT access required");
  if (!eligible || owner !== agentId) throw new Error("Lead ownership or agent availability changed; refresh before sending");
}

export function assignedAgentLeads<T extends { assigned_to?: string | null; assigned_agent_id?: string | null }>(leads: T[], agentId: string) {
  return leads.filter(lead => leadOwner(lead) === agentId);
}