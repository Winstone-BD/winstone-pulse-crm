import { beforeEach, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ assignee: "agent-a", changed: false, error: false, guarded: false, inserts: 0 }));
vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: { from: (table: string) => {
  let updating = false;
  const chain = {
    select: () => chain, eq: (key: string, value: string) => { if (updating && key === "assignee_profile_id") state.guarded = value === "agent-a"; return chain; },
    update: () => { updating = true; return chain; },
    insert: () => { state.inserts++; return chain; },
    maybeSingle: async () => table === "support_tickets" ? { data: { id: "ticket-a", ref: "TKT-1" }, error: null } : updating
      ? { data: state.changed ? null : { id: "conversation-a" }, error: state.error ? { message: "update failed" } : null }
      : { data: { id: "conversation-a", assignee_profile_id: state.assignee, status: "open" }, error: null },
  }; return chain;
} } }));
import { escalateConversation } from "@/lib/support.server";
const input = { conversationId: "conversation-a", reason: "Help needed", requiredAssigneeProfileId: "agent-a" };
beforeEach(() => { state.assignee = "agent-a"; state.changed = false; state.error = false; state.guarded = false; state.inserts = 0; });
it("rechecks ownership before mutation", async () => {
  state.assignee = "agent-b";
  await expect(escalateConversation(input)).rejects.toThrow("must own"); expect(state.inserts).toBe(0); expect(state.guarded).toBe(false);
});
it("guards update by the agent's ownership", async () => {
  await expect(escalateConversation(input)).resolves.toMatchObject({ ref: "TKT-1" }); expect(state.guarded).toBe(true);
});
it("refuses escalation when ownership changes during the update", async () => {
  state.changed = true;
  await expect(escalateConversation(input)).rejects.toThrow("ownership changed"); expect(state.guarded).toBe(true); expect(state.inserts).toBe(0);
});
it("fails closed on an update error", async () => {
  state.error = true;
  await expect(escalateConversation(input)).rejects.toThrow("update failed"); expect(state.inserts).toBe(0);
});