import { beforeEach, describe, expect, it, vi } from 'vitest';
import { transitionFollowUp, replaceReportFollowUp, recoverFollowUp } from '@/lib/follow-up-lifecycle.server';

const mocks = vi.hoisted(() => ({ rpc: vi.fn(), from: vi.fn(), owner: 'agent-a', status: 'missed', at: '2020-01-01T00:00:00Z' }));
vi.mock('@/integrations/supabase/client.server', () => ({ supabaseAdmin: { rpc: mocks.rpc, from: mocks.from } }));
const caller = { scope: 'agent' as const, profile: { id: 'agent-a' }, readOnly: false } as Parameters<typeof transitionFollowUp>[0];
beforeEach(() => {
  vi.clearAllMocks(); mocks.owner = 'agent-a'; mocks.status = 'missed'; mocks.at = '2020-01-01T00:00:00Z';
  mocks.rpc.mockResolvedValue({ data: { ok: true }, error: null });
  mocks.from.mockImplementation(table => {
    const q = { select: vi.fn(() => q), eq: vi.fn(() => q), maybeSingle: vi.fn(async () => ({ data: table === 'leads' ? { assigned_to: mocks.owner, assigned_agent_id: null } : { id: 'event-a', agent_id: 'agent-a', lead_id: 'lead-a', status: mocks.status, scheduled_at: mocks.at }, error: null })) };
    return q;
  });
});
describe('follow-up server path', () => {
  it('completion sends real outcome and never writes the lead', async () => {
    await transitionFollowUp(caller, { eventId: 'event-a', action: 'complete', reason: 'Customer interested, requested site visit.', key: 'request-a' });
    expect(mocks.rpc).toHaveBeenCalledWith('transition_follow_up_atomic', expect.objectContaining({ _actor: 'agent-a', _reason: 'Customer interested, requested site visit.', _action: 'complete', _key: 'request-a' }));
    expect(mocks.from.mock.results.every(result => !('update' in result.value))).toBe(true);
  });
  it('ownership change refuses completion before any mutation', async () => {
    mocks.owner = 'agent-b';
    await expect(transitionFollowUp(caller, { eventId: 'event-a', action: 'complete', reason: 'Customer interested', key: 'request-a' })).rejects.toThrow('not assigned');
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it('blank outcome refuses completion before data access', async () => {
    await expect(transitionFollowUp(caller, { eventId: 'event-a', action: 'complete', reason: ' ', key: 'request-a' })).rejects.toThrow();
    expect(mocks.from).not.toHaveBeenCalled();
  });
  it('report follow-up creation uses one atomic operation with report and lead identity', async () => {
    const patch = { lead_id: 'lead-a', agent_id: 'agent-a', category: 'follow_up', scheduled_at: '2026-10-25T10:00:00Z' };
    await replaceReportFollowUp('agent-a', 'report-a', patch, 'Customer requested tomorrow');
    expect(mocks.rpc).toHaveBeenCalledWith('create_report_follow_up_atomic', { _agent: 'agent-a', _report: 'report-a', _patch: patch, _reason: 'Customer requested tomorrow' });
    expect(mocks.from).not.toHaveBeenCalled();
  });
  const recovery = { eventId: 'event-a', scheduledAt: '2099-10-25T10:00:00Z', reason: 'Missed scheduled contact', nextAction: 'Call at customer requested time', key: 'recovery-a' };
  it('missed recovery appends through atomic RPC without updating the original or lead', async () => {
    await recoverFollowUp(caller, recovery);
    expect(mocks.rpc).toHaveBeenCalledWith('recover_follow_up_atomic', { _event: 'event-a', _actor: 'agent-a', _scheduled_at: recovery.scheduledAt, _reason: recovery.reason, _next_action: recovery.nextAction, _key: 'recovery-a' });
    expect(mocks.from.mock.results.every(result => !('update' in result.value))).toBe(true);
  });
  it('overdue upcoming tasks accept recovery', async () => {
    mocks.status = 'upcoming';
    await recoverFollowUp(caller, recovery);
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
  });
  it('reassigned recovery refuses any mutation', async () => {
    mocks.owner = 'agent-b';
    await expect(recoverFollowUp(caller, recovery)).rejects.toThrow('not assigned');
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it('future tasks cannot be recovered', async () => {
    mocks.at = '2099-01-01T00:00:00Z';
    await expect(recoverFollowUp(caller, recovery)).rejects.toThrow('Only missed or overdue');
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it('terminal tasks cannot be recovered', async () => {
    mocks.status = 'done';
    await expect(recoverFollowUp(caller, recovery)).rejects.toThrow('Only missed or overdue');
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it('recovery requires a next action', async () => {
    await expect(recoverFollowUp(caller, { ...recovery, nextAction: ' ' })).rejects.toThrow('Next action');
    expect(mocks.from).not.toHaveBeenCalled();
  });
  it('read-only HQ cannot recover an agent task', async () => {
    await expect(recoverFollowUp({ ...caller, scope: 'authority', readOnly: true }, recovery)).rejects.toThrow('Authorized agent');
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
});