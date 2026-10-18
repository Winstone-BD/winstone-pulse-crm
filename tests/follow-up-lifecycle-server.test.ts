import { beforeEach, describe, expect, it, vi } from 'vitest';
import { transitionFollowUp, replaceReportFollowUp } from '@/lib/follow-up-lifecycle.server';

const mocks = vi.hoisted(() => ({ rpc: vi.fn(), from: vi.fn(), owner: 'agent-a' }));
vi.mock('@/integrations/supabase/client.server', () => ({ supabaseAdmin: { rpc: mocks.rpc, from: mocks.from } }));
const caller = { scope: 'agent' as const, profile: { id: 'agent-a' }, readOnly: false } as Parameters<typeof transitionFollowUp>[0];
beforeEach(() => {
  vi.clearAllMocks(); mocks.owner = 'agent-a';
  mocks.rpc.mockResolvedValue({ data: { ok: true }, error: null });
  mocks.from.mockImplementation(table => {
    const q = { select: vi.fn(() => q), eq: vi.fn(() => q), maybeSingle: vi.fn(async () => ({ data: table === 'leads' ? { assigned_to: mocks.owner, assigned_agent_id: null } : { id: 'event-a', agent_id: 'agent-a', lead_id: 'lead-a' }, error: null })) };
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
});