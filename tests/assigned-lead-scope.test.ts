import { beforeEach, expect, it, vi } from 'vitest';
import { assignedLeadIds, assertAssignedLead, filterAssignedActivity } from '@/lib/assigned-lead-scope.server';
const mocks = vi.hoisted(() => ({ from: vi.fn(), rows: [] as { id: string; assigned_to: string | null; assigned_agent_id: string | null }[], failure: null as null | { message: string } }));
vi.mock('@/integrations/supabase/client.server', () => ({ supabaseAdmin: { from: mocks.from } }));
beforeEach(() => {
  mocks.failure = null;
  mocks.rows = [{ id: 'own', assigned_to: 'agent-a', assigned_agent_id: 'agent-a' }, { id: 'fallback', assigned_to: null, assigned_agent_id: 'agent-a' }, { id: 'transferred', assigned_to: 'agent-b', assigned_agent_id: 'agent-a' }, { id: 'pool', assigned_to: null, assigned_agent_id: null }];
  mocks.from.mockImplementation(() => {
    const q = { select: () => q, or: () => q, order: () => q, eq: () => q, range: async () => ({ data: mocks.rows, error: mocks.failure }), maybeSingle: async () => ({ data: mocks.rows[2], error: mocks.failure }) };
    return q;
  });
});
it('current owner wins over historic alternate assignment', async () => {
  expect([...await assignedLeadIds('agent-a')]).toEqual(['own', 'fallback']);
});
it('follow-up, activity and customer-history responses hide foreign and unassigned lead rows', () => {
  const rows = [{ lead_id: 'own', id: 1 }, { lead_id: 'transferred', id: 2 }, { lead_id: null, id: 3 }, { lead_id: 'pool', id: 4 }];
  expect(filterAssignedActivity(rows, new Set(['own']))).toEqual([{ lead_id: 'own', id: 1 }]);
});
it('single-record read/write checks refuse reassigned leads', async () => {
  await expect(assertAssignedLead('agent-a', 'transferred')).rejects.toThrow('not assigned');
});
it('failed ownership lookup fails closed', async () => {
  mocks.failure = { message: 'unavailable' };
  await expect(assignedLeadIds('agent-a')).rejects.toThrow('unavailable');
});