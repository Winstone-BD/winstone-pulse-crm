import { beforeEach, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ scope: "authority", writes: [] as { table: string; value: unknown }[], audit: vi.fn() }));
vi.mock("@tanstack/react-start", () => ({ createServerFn: () => {
  let validate = (data: unknown) => data;
  const api = { inputValidator(fn: typeof validate) { validate = fn; return api; }, handler(fn: (args: { data: unknown }) => unknown) { return (args: { data: unknown }) => fn({ data: validate(args.data) }); } };
  return api;
} }));
vi.mock("@/lib/access.server", () => ({ resolveCaller: async () => ({ scope: state.scope, readOnly: true, profile: null }) }));
vi.mock("@/lib/audit.server", () => ({ logAudit: state.audit }));
const agentId = "00000000-0000-4000-8000-000000000001";
const leadId = "00000000-0000-4000-8000-000000000002";
vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: { from(table: string) {
  const result = table === "leads" ? { id: leadId, name: "Synthetic buyer", assigned_to: agentId } : table === "profiles" ? { id: agentId, is_active: true, approval_status: "approved", role: "agent" } : { id: "notice-1" };
  const q: Record<string, unknown> = {};
  for (const method of ["select", "eq", "maybeSingle", "single"]) q[method] = () => q;
  q.insert = (value: unknown) => { state.writes.push({ table, value }); return q; };
  q.then = (resolve: (value: unknown) => void) => resolve({ data: result, error: null });
  return q;
} } }));
beforeEach(() => { state.scope = "authority"; state.writes = []; state.audit.mockClear(); });
it("HQ review appends only notice, recipient and event, never edits lead ownership/status", async () => {
  const { sendHqLeadReview } = await import("../src/lib/hq-lead-review.functions");
  expect(await sendHqLeadReview({ data: { leadId, agentId, comment: "Review received", adminToken: null } })).toEqual({ noticeId: "notice-1" });
  expect(state.writes.map(row => row.table)).toEqual(["it_notices", "it_notice_recipients", "lead_events"]);
  expect(state.writes[1]?.value).toEqual({ notice_id: "notice-1", profile_id: agentId });
  expect(state.audit).toHaveBeenCalledWith(expect.objectContaining({ action: "hq_lead_review", entityId: leadId }));
});
it("signed-out caller is rejected before any delivery write", async () => {
  state.scope = "none";
  const { sendHqLeadReview } = await import("../src/lib/hq-lead-review.functions");
  await expect(sendHqLeadReview({ data: { leadId, agentId, comment: "Review received" } })).rejects.toThrow("HQ/IT access required");
  expect(state.writes).toEqual([]);
});