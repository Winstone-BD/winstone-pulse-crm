import { canManageFollowUp, validateFollowUpTransition, type FollowUpAction } from '@/lib/follow-up-lifecycle';
import { leadOwnerId } from '@/lib/lead-access.server';
import type { Caller } from '@/lib/access.server';

export async function transitionFollowUp(caller: Caller, input: { eventId: string; action: FollowUpAction; reason: string; scheduledAt?: string | null; key: string }) {
  validateFollowUpTransition(input.action, input.reason, input.scheduledAt);
  const { supabaseAdmin: db } = await import('@/integrations/supabase/client.server');
  const { data: event, error } = await db.from('follow_up_events').select('id, agent_id, lead_id').eq('id', input.eventId).maybeSingle();
  if (error || !event) throw new Error('Follow-up not found');
  const { data: lead } = await db.from('leads').select('assigned_to, assigned_agent_id').eq('id', event.lead_id).maybeSingle();
  if (!canManageFollowUp({ scope: caller.scope, readOnly: caller.readOnly, profileId: caller.profile?.id ?? null }, event.agent_id, leadOwnerId(lead))) throw new Error('This follow-up is not assigned to you');
  const { data, error: failure } = await db.rpc('transition_follow_up_atomic', { _event: event.id, _actor: caller.profile?.id ?? undefined, _action: input.action, _reason: input.reason.trim(), _scheduled_at: input.scheduledAt ?? undefined, _key: input.key });
  if (failure) throw new Error(failure.message);
  return data;
}

/** Saved report intent creates a new task; never overwrites its predecessor. */
export async function replaceReportFollowUp(agentId: string, reportId: string, patch: import('@/integrations/supabase/types').Database['public']['Tables']['follow_up_events']['Insert'], reason: string) {
  const { supabaseAdmin: db } = await import('@/integrations/supabase/client.server');
  const key = `report:${reportId}`;
  const { data: existing } = await db.from('follow_up_events').select('id').eq('idempotency_key', key).maybeSingle();
  if (existing) return existing.id;
  const { data: open, error } = await db.from('follow_up_events').select('id').eq('lead_id', patch.lead_id).eq('agent_id', agentId).in('status', ['upcoming', 'due', 'missed']);
  if (error) throw new Error(error.message);
  // Supersede prior intent with an explicit reason; each original stays intact.
  for (const event of open ?? []) {
    const { error: failure } = await db.rpc('transition_follow_up_atomic', { _event: event.id, _actor: agentId, _action: 'cancel', _reason: reason, _key: crypto.randomUUID() });
    if (failure) throw new Error(failure.message);
  }
  const { data: created, error: failure } = await db.from('follow_up_events').insert({ ...patch, idempotency_key: key }).select('id').single();
  if (failure) throw new Error(failure.message);
  return created.id;
}