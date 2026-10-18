import { beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ scope: null as string | null }));
vi.mock('@/lib/admin-gate.server', () => ({ adminTokenScope: () => mocks.scope }));
import { requireLeadHub } from '@/lib/access.server';
beforeEach(() => { mocks.scope = null; });
it('an agent session without the dedicated PIN cannot enter LeadHub', async () => {
  await expect(requireLeadHub(null)).rejects.toThrow('LeadHub PIN required');
});
it('ordinary HQ and IT tokens do not inherit LeadHub access', async () => {
  for (const scope of ['hq', 'full']) {
    mocks.scope = scope;
    await expect(requireLeadHub('opaque-token')).rejects.toThrow('LeadHub PIN required');
  }
});
it('only the validated LeadHub token scope permits entry', async () => {
  mocks.scope = 'leadhub';
  await expect(requireLeadHub('opaque-token')).resolves.toBeUndefined();
});