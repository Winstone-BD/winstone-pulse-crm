import { leadOwnerId } from '@/lib/lead-access.server';

/** Resolve current assignment at request time, never from a historic activity actor. */
export async function assignedLeadIds(profileId: string): Promise<Set<string>> {
  const { supabaseAdmin: db } = await import('@/integrations/supabase/client.server');
  const ids = new Set<string>();
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db.from('leads').select('id, assigned_to, assigned_agent_id')
      .or(`assigned_to.eq.${profileId},assigned_agent_id.eq.${profileId}`).order('id').range(from, from + 999);
    if (error) throw new Error(error.message);
    for (const lead of data ?? []) if (leadOwnerId(lead) === profileId) ids.add(lead.id);
    if (!data || data.length < 1000) return ids;
  }
}

export function filterAssignedActivity<T extends { lead_id: string | null }>(rows: T[], ids: Set<string>): T[] {
  return rows.filter(row => Boolean(row.lead_id && ids.has(row.lead_id)));
}

export async function assertAssignedLead(profileId: string, leadId: string | null) {
  if (!leadId) throw new Error('This lead is not assigned to you');
  const { supabaseAdmin: db } = await import('@/integrations/supabase/client.server');
  const { data, error } = await db.from('leads').select('assigned_to, assigned_agent_id').eq('id', leadId).maybeSingle();
  if (error || !data || leadOwnerId(data) !== profileId) throw new Error('This lead is not assigned to you');
}