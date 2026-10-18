import { beforeEach, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({ readOnly: true, scope: 'authority', db: vi.fn() }));
vi.mock('@tanstack/react-start', () => ({ createServerFn: () => {
  const chain = { inputValidator: (_validator: unknown) => chain, handler: (fn: (input: unknown) => unknown) => fn };
  return chain;
} }));
vi.mock('@/lib/access.server', () => ({
  resolveCaller: async () => ({ scope: state.scope, readOnly: state.readOnly, userId: 'user-a' }),
  requireAuthority: (c: { scope: string }) => { if (c.scope !== 'authority') throw new Error('Master PIN required'); },
  requireWrite: (c: { readOnly: boolean }) => { if (c.readOnly) throw new Error('view-only'); },
  requireBookingReviewer: (c: { readOnly: boolean }) => { if (c.readOnly) throw new Error('view-only'); },
}));
vi.mock('@/integrations/supabase/client.server', () => ({ supabaseAdmin: { from: state.db } }));
import { setMigrationChecklistItem } from '@/lib/migration-checklist.functions';
import { setRuntimeIssueStatus, runHealthCheckNow } from '@/lib/runtime-errors.functions';
import { reviewBooking } from '@/lib/bookings.functions';
beforeEach(() => { state.readOnly = true; state.scope = 'authority'; state.db.mockClear(); });
// The mocked Start wrapper exposes the real handler, not RPC; no live DB writes.
async function invoke(fn: unknown, data: unknown) { return (fn as (input: { data: unknown }) => Promise<unknown>)({ data }); }
it('read-only HQ cannot change migration settings', async () => {
  await expect(invoke(setMigrationChecklistItem, { id: 'audit' })).rejects.toThrow('view-only');
  expect(state.db).not.toHaveBeenCalled();
});
it('read-only HQ cannot resolve runtime issues', async () => {
  await expect(invoke(setRuntimeIssueStatus, { issueId: 'issue-a', status: 'resolved' })).rejects.toThrow('view-only');
  expect(state.db).not.toHaveBeenCalled();
});
it('read-only HQ cannot run a health check that records issues', async () => {
  await expect(invoke(runHealthCheckNow, {})).rejects.toThrow('view-only');
  expect(state.db).not.toHaveBeenCalled();
});
it('booking review applies the distinct reviewer guard before any write', async () => {
  await expect(invoke(reviewBooking, { id: 'booking-a', decision: 'approved' })).rejects.toThrow('view-only');
  expect(state.db).not.toHaveBeenCalled();
});
