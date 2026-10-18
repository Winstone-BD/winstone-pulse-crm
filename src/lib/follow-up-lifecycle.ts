import { dhakaDay } from '@/lib/lead-groups';

export type FollowUpAction = 'complete' | 'reschedule' | 'cancel' | 'miss';
export type FollowUpHealth = 'overdue' | 'due_today' | 'completed' | 'upcoming' | 'rescheduled' | 'cancelled';
export function isOpenFollowUp(status: string) {
  return ['upcoming', 'due', 'missed'].includes(status);
}
export function followUpHealth(row: { status: string; scheduled_at: string }, now = Date.now()): FollowUpHealth {
  if (['done', 'completed'].includes(row.status)) return 'completed';
  if (row.status === 'rescheduled') return 'rescheduled';
  if (['cancelled', 'canceled'].includes(row.status)) return 'cancelled';
  if (row.status === 'missed' || Date.parse(row.scheduled_at) < now) return 'overdue';
  return dhakaDay(row.scheduled_at) === dhakaDay(now) ? 'due_today' : 'upcoming';
}
export function validateFollowUpTransition(action: FollowUpAction, reason: string, scheduledAt?: string | null, now = Date.now()) {
  if (!reason.trim()) throw new Error('Reason / outcome is required');
  if (action === 'reschedule' && (!scheduledAt || !Number.isFinite(Date.parse(scheduledAt)) || Date.parse(scheduledAt) <= now)) {
    throw new Error('Choose a future date and time');
  }
}
export function canManageFollowUp(caller: { scope: string; readOnly: boolean; profileId: string | null }, eventAgentId: string | null, leadOwnerId: string | null) {
  if (caller.readOnly || caller.scope === 'none') return false;
  if (caller.scope === 'authority') return true;
  return Boolean(caller.profileId && caller.profileId === eventAgentId && caller.profileId === leadOwnerId);
}