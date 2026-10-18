import { beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ granted: true, role: 'agent', active: true }));
vi.mock('@tanstack/react-start/server', () => ({ getRequest: () => new Request('http://localhost', { headers: { authorization: 'Bearer x.y.z' } }) }));
vi.mock('@/lib/admin-gate.server', () => ({ adminTokenScope: () => null }));
vi.mock('@supabase/supabase-js', () => ({ createClient: () => ({
  auth: { getClaims: async () => ({ data: { claims: { sub: 'user-1' } } }) },
  from: () => { const q = { select: () => q, eq: () => q, maybeSingle: async () => ({ data: mocks.granted ? { role: 'executive_hq' } : null }) }; return q; },
}) }));
vi.mock('@/integrations/supabase/client.server', () => ({ supabaseAdmin: { from: () => {
  const q = { select: () => q, eq: () => q, maybeSingle: async () => ({ data: { id: 'profile-1', user_id: 'user-1', role: mocks.role, approval_status: 'approved', is_active: mocks.active } }) }; return q;
} } }));
import { resolveCaller, requireWrite, canDispatch } from '@/lib/access.server';
beforeEach(() => { mocks.granted = true; mocks.role = 'agent'; mocks.active = true; vi.stubEnv('SUPABASE_URL', 'https://example.invalid'); vi.stubEnv('SUPABASE_PUBLISHABLE_KEY', 'sb_publishable_test'); });
it('granted Sales Agent receives HQ oversight but no write or dispatch authority', async () => {
  const c = await resolveCaller(null, { skipMaintenance: true });
  expect(c.scope).toBe('authority'); expect(c.readOnly).toBe(true);
  expect(() => requireWrite(c)).toThrow('view-only'); expect(canDispatch(c)).toBe(false);
  expect(c.profile?.role).toBe('agent');
});
it('HQ grant does not activate an inactive account', async () => {
  mocks.active = false; expect((await resolveCaller(null, { skipMaintenance: true })).scope).toBe('none');
});
it('ungranted agents retain assigned-lead scope', async () => {
  mocks.granted = false; expect((await resolveCaller(null, { skipMaintenance: true })).scope).toBe('agent');
});
it('existing IT admin authority is unchanged', async () => {
  mocks.role = 'admin'; const c = await resolveCaller(null, { skipMaintenance: true }); expect(c.readOnly).toBe(false);
});