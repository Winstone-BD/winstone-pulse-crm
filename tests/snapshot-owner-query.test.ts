import { expect, it, vi } from "vitest";
vi.mock("@tanstack/react-start", () => ({ createServerFn: () => {
  let validate = (data: unknown) => data;
  const api = { inputValidator(fn: (data: unknown) => unknown) { validate = fn; return api; }, handler(fn: (args: { data: unknown }) => unknown) { return (args: { data: unknown }) => fn({ data: validate(args.data) }); } };
  return api;
} }));
vi.mock("@/lib/access.server", () => ({ resolveCaller: async () => ({ scope: "agent", profile: { id: "agent-1" } }) }));
const ownerFilters: string[] = [];
const lead = { id: "lead-1", assigned_to: "agent-1", assigned_agent_id: "agent-1", updated_at: "2026-10-18" };
vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: { from: (table: string) => {
  const q: Record<string, unknown> = {};
  for (const method of ["select", "eq", "order", "range", "limit"]) q[method] = () => q;
  q.or = (filter: string) => { ownerFilters.push(filter); return q; };
  q.then = (resolve: (value: unknown) => void) => resolve({ data: table === "leads" ? [lead] : [], error: null });
  return q;
} } }));
it("reads both owner columns in one scoped query without duplicating leads", async () => {
  const { getCrmSnapshot } = await import("../src/lib/crm.functions");
  const snapshot = await getCrmSnapshot({ data: { token: null } });
  expect(ownerFilters).toEqual(["assigned_agent_id.eq.agent-1,assigned_to.eq.agent-1"]);
  expect(snapshot.leads).toEqual([lead]);
});