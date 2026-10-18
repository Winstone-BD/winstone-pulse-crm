import { beforeEach, expect, it, vi } from "vitest";
const s = vi.hoisted(() => ({ status: "invited", actor: "recipient", verified: true, tokenUser: "architect", passwordUpdates: 0, transitions: [] as string[] }));
vi.mock("@tanstack/react-start", () => ({ createServerFn: () => {
  const chain = { middleware() { return chain; }, inputValidator() { return chain; }, handler(fn: (arg: unknown) => unknown) { return (arg: { data?: unknown }) => fn({ ...arg, context: { userId: s.actor, supabase: { auth: { getUser: async () => ({ data: { user: { email: "synthetic@example.test", email_confirmed_at: s.verified ? "2026-10-18" : null } } }) } } } }); } };
  return chain;
} }));
vi.mock("@/integrations/supabase/auth-middleware", () => ({ requireSupabaseAuth: {} }));
vi.mock("@/lib/access.server", () => ({ resolveCaller: async () => ({ scope: "authority", readOnly: false }) }));
vi.mock("@/lib/admin-gate.server", () => ({ itAccountTokenUser: () => s.tokenUser }));
vi.mock("@/lib/maintenance.server", () => ({ architectFromRequest: async () => ({ userId: "architect" }) }));
vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: {
  from() { const q: Record<string, unknown> = {}; for (const method of ["select", "eq", "single", "maybeSingle"]) q[method] = () => q;
    q.then = (resolve: (arg: unknown) => void) => resolve({ data: { id: "00000000-0000-4000-8000-000000000001", status: s.status, user_id: "recipient", email: "synthetic@example.test" }, error: null }); return q; },
  auth: { admin: { getUserById: async () => ({ data: { user: { email: "synthetic@example.test", email_confirmed_at: s.verified ? "2026-10-18" : null } } }), updateUserById: async () => { s.passwordUpdates++; return { error: null }; } } },
  rpc: async (_name: string, input: { _action: string }) => { s.transitions.push(input._action); return { error: null }; },
} }));
beforeEach(() => { s.status = "invited"; s.actor = "recipient"; s.verified = true; s.tokenUser = "architect"; s.passwordUpdates = 0; s.transitions = []; });
it("authenticated recipient password setup never grants a role", async () => {
  const { setInvitedItPassword } = await import("../src/lib/it-provisioning.functions");
  await setInvitedItPassword({ data: { password: "synthetic-test-only" } });
  expect(s.passwordUpdates).toBe(1); expect(s.transitions).toEqual(["password_set"]);
});
it("unverified recipient cannot set password or advance", async () => {
  s.verified = false;
  const { setInvitedItPassword } = await import("../src/lib/it-provisioning.functions");
  await expect(setInvitedItPassword({ data: { password: "synthetic-test-only" } })).rejects.toThrow("Verify");
  expect(s.passwordUpdates).toBe(0); expect(s.transitions).toEqual([]);
});
it("Architect approval is separate from role assignment", async () => {
  s.actor = "architect"; s.status = "password_set";
  const { decideItOnboarding } = await import("../src/lib/it-provisioning.functions");
  await decideItOnboarding({ data: { id: "00000000-0000-4000-8000-000000000001", action: "approve", token: "synthetic", confirmed: true } });
  expect(s.transitions).toEqual(["approve"]);
  s.status = "approved";
  await decideItOnboarding({ data: { id: "00000000-0000-4000-8000-000000000001", action: "assign_role", token: "synthetic", confirmed: true } });
  expect(s.transitions).toEqual(["approve", "assign_role"]);
});
it("another user's IT token cannot approve", async () => {
  s.actor = "architect"; s.tokenUser = "other"; s.status = "password_set";
  const { decideItOnboarding } = await import("../src/lib/it-provisioning.functions");
  await expect(decideItOnboarding({ data: { id: "00000000-0000-4000-8000-000000000001", action: "approve", token: "synthetic", confirmed: true } })).rejects.toThrow("Architect");
  expect(s.transitions).toEqual([]);
});