import { describe, expect, it } from 'vitest';
import { canManageFollowUp, followUpHealth, isOpenFollowUp, validateFollowUpTransition } from '@/lib/follow-up-lifecycle';

describe('canonical follow-up lifecycle', () => {
  const now = Date.parse('2026-10-18T15:51:00Z');
  it.each(['complete', 'cancel', 'reschedule', 'miss'] as const)('%s requires a permanent reason', action => {
    expect(() => validateFollowUpTransition(action, '   ', '2026-10-19T10:00:00Z', now)).toThrow('Reason / outcome is required');
  });
  it('reschedule rejects past and exact-current time', () => {
    for (const at of ['2026-10-18T15:50:00Z', '2026-10-18T15:51:00Z', 'invalid']) expect(() => validateFollowUpTransition('reschedule', 'Customer requested tomorrow', at, now)).toThrow();
    expect(() => validateFollowUpTransition('reschedule', 'Customer requested tomorrow', '2026-10-19T10:00:00Z', now)).not.toThrow();
  });
  it('Dhaka midnight separates due today and upcoming', () => {
    expect(followUpHealth({ status: 'upcoming', scheduled_at: '2026-10-18T17:59:59Z' }, now)).toBe('due_today');
    expect(followUpHealth({ status: 'upcoming', scheduled_at: '2026-10-18T18:00:00Z' }, now)).toBe('upcoming');
  });
  it('elapsed uncompleted follow-up is overdue; missed remains recoverable', () => {
    expect(followUpHealth({ status: 'upcoming', scheduled_at: '2026-10-18T15:50:00Z' }, now)).toBe('overdue');
    expect(isOpenFollowUp('missed')).toBe(true);
  });
  it('terminal follow-ups are not reminder tasks', () => {
    for (const status of ['done', 'completed', 'cancelled', 'rescheduled']) expect(isOpenFollowUp(status)).toBe(false);
    expect(followUpHealth({ status: 'done', scheduled_at: '2026-10-10T10:00:00Z' }, now)).toBe('completed');
  });
  it('agent must own both event and currently assigned lead', () => {
    const caller = { scope: 'agent', readOnly: false, profileId: 'agent-a' };
    expect(canManageFollowUp(caller, 'agent-a', 'agent-a')).toBe(true);
    expect(canManageFollowUp(caller, 'agent-a', 'agent-b')).toBe(false);
    expect(canManageFollowUp(caller, 'agent-b', 'agent-a')).toBe(false);
    expect(canManageFollowUp(caller, 'agent-a', null)).toBe(false);
  });
  it('HQ read-only, anonymous and coordinator cross-agent writes are refused', () => {
    expect(canManageFollowUp({ scope: 'authority', readOnly: true, profileId: null }, 'a', 'a')).toBe(false);
    expect(canManageFollowUp({ scope: 'none', readOnly: false, profileId: null }, 'a', 'a')).toBe(false);
    expect(canManageFollowUp({ scope: 'coordinator', readOnly: false, profileId: 'b' }, 'a', 'a')).toBe(false);
  });
});