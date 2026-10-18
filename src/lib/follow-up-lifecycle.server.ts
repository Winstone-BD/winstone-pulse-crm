import { canManageFollowUp, validateFollowUpTransition, type FollowUpAction } from '@/lib/follow-up-lifecycle';
import { leadOwnerId } from '@/lib/lead-access.server';
import type { Caller } from '@/lib/access.server';

export async function transitionFollowUp(caller: Caller, input: { eventId: string; action: FollowUpAction; reason: string; scheduledAt?: string | null | undefined; key: string }) {
  validateFollowUpTransition(input.action, input.reason, input.scheduledAt);
  const { supabaseAdmin: db } = await import('@/integrations/supabase/client.server');
  const { data: event, error } = await db.from('follow_up_events').select('id, agent_id, lead_id').eq('id', input.eventId).maybeSingle();
  if (error || !event) throw new Error('Follow-up not found');
  const { data: lead } = await db.from('leads').select('assigned_to, assigned_agent_id').eq('id', event.lead_id).maybeSingle();
  if (!canManageFollowUp({ scope: caller.scope, readOnly: caller.readOnly, profileId: caller.profile?.id ?? null }, event.agent_id, leadOwnerId(lead))) throw new Error('This follow-up is not assigned to you');
  const { data, error: failure } = await db.rpc('transition_follow_up_atomic', { _event: event.id, ...(caller.profile ? { _actor: caller.profile.id } : {}), _action: input.action, _reason: input.reason.trim(), ...(input.scheduledAt ? { _scheduled_at: input.scheduledAt } : {}), _key: input.key });
  if (failure) throw new Error(failure.message);
  return data;
}

/** Saved report intent creates a new task; never overwrites its predecessor. */
export async function replaceReportFollowUp(agentId: string, reportId: string, patch: import('@/integrations/supabase/types').Database['public']['Tables']['follow_up_events']['Insert'], reason: string) {
  const { supabaseAdmin: db } = await import('@/integrations/supabase/client.server');
  const { data, error } = await db.rpc('create_report_follow_up_atomic', { _agent: agentId, _report: reportId, _patch: patch, _reason: reason });
  if (error) throw new Error(error.message);
  return data;
}

/** Recovery appends a linked task and action; the missed/overdue original stays unchanged. */
export async function recoverFollowUp(caller: Caller, input: { eventId: string; reason: string; nextAction: string; scheduledAt: string; key: string }) {
  validateFollowUpTransition('reschedule', input.reason, input.scheduledAt);
  if (!input.nextAction.trim()) throw new Error('Next action is required');
  if (caller.readOnly || caller.scope === 'none' || !caller.profile) throw new Error('Authorized agent required');
  const { supabaseAdmin: db } = await import('@/integrations/supabase/client.server');
  const { data: event, error } = await db.from('follow_up_events').select('id, agent_id, lead_id, status, scheduled_at').eq('id', input.eventId).maybeSingle();
  if (error || !event) throw new Error('Follow-up not found');
  if (event.agent_id !== caller.profile.id) throw new Error('This follow-up is not assigned to you');
  await (await import('@/lib/assigned-lead-scope.server')).assertAssignedLead(caller.profile.id, event.lead_id);
  if (!['upcoming', 'due', 'missed'].includes(event.status) || Date.parse(event.scheduled_at) > Date.now()) throw new Error('Only missed or overdue follow-ups can be recovered');
  const { data, error: failure } = await db.rpc('recover_follow_up_atomic', { _event: event.id, _actor: caller.profile.id, _scheduled_at: input.scheduledAt, _reason: input.reason.trim(), _next_action: input.nextAction.trim(), _key: input.key });
  if (failure) throw new Error(failure.message);
  return data;
}
