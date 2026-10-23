import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  caller: { scope: "agent", readOnly: false, profile: { id: "agent-a", name: "Agent" } },
  assignee: "agent-a" as string | null,
  accessError: false,
  customerFilter: "",
  writes: [] as Array<{ table: string; patch: Record<string, unknown> }>,
  configReads: 0,
  escalations: 0,
  phoneSeconds: null as number | null,
  channel: "call",
  leadOwner: "agent-a" as string | null,
  allowSubmit: false,
}));
vi.mock("@tanstack/react-start", () => ({ createServerFn: () => {
  const chain = { inputValidator: () => chain, middleware: () => chain, handler: (fn: unknown) => fn };
  return chain;
} }));
vi.mock("@/lib/access.server", () => ({ resolveCaller: async () => state.caller }));
vi.mock("@/integrations/supabase/auth-middleware", () => ({ requireSupabaseAuth: {} }));
vi.mock("@/lib/ai-model.server", () => ({ getAiModelChoice: async () => { state.configReads++; return "gemini"; } }));
vi.mock("@/lib/service-bill-review.server", () => ({ currentServiceBill: async () => { state.configReads++; return { bill_id: "bill-a", amount: 35.29 }; } }));
vi.mock("@/lib/support.server", () => ({ escalateConversation: async () => { state.escalations++; return { ref: "TKT-1" }; } }));
vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: { from: (table: string) => {
  let selection = "";
  let filter = "";
  const result = () => {
    if (table === "support_conversations") {
      if (state.accessError) return { data: null, error: { message: "lookup failed" } };
      const allowed = state.assignee === null || state.assignee === "agent-a";
      return { data: filter && !allowed ? [] : [{ id: "conversation-a", customer_id: "customer-a", status: "open", subject: "Own", assignee_profile_id: state.assignee }], error: null };
    }
    if (table === "support_customers") return { data: [{ id: "customer-a" }], error: null };
    if (table === "call_recordings") return { data: [], error: null };
    if (table === "call_reports" && state.allowSubmit) return { data: [{ id: "report-a" }], error: null };
    return { data: [], error: null };
  };
  const chain = {
    select: (s: string) => { selection = s; return chain; },
    eq: () => chain, neq: () => chain, gte: () => chain, order: () => chain, limit: () => chain,
    in: (_key: string, ids: string[]) => { if (table === "support_customers") state.customerFilter = ids.join(","); return chain; },
    or: (s: string) => { filter = s; return chain; },
    update: (patch: Record<string, unknown>) => { state.writes.push({ table, patch }); if (table === "call_reports" && !state.allowSubmit) throw new Error("captured submission"); return chain; },
    insert: (patch: Record<string, unknown>) => { state.writes.push({ table, patch }); return chain; },
    maybeSingle: async () => {
      if (table === "call_reports") return { data: { id: "report-a", agent_id: "agent-a", lead_id: "lead-a", recording_id: "recording-a", channel: state.channel, connected: true, duration_seconds: 9000, created_at: "2026-10-19T00:00:00Z" }, error: null };
      if (table === "leads") return { data: { assigned_to: state.leadOwner, name: "Lead", phone_number: "01700000000", status: "pending" }, error: null };
      if (table === "call_recordings") return { data: state.phoneSeconds === null ? { duration_seconds: 9000, call_source: "web_manual" } : { duration_seconds: state.phoneSeconds, call_source: "android_sim", created_at: "2026-10-19T00:01:00Z" }, error: null };
      const r = result();
      return { ...r, data: r.data?.[0] ?? null };
    },
    then: (resolve: (value: unknown) => unknown) => Promise.resolve(result()).then(resolve),
  };
  void selection;
  return chain;
} } }));

import { getAiModel } from "@/lib/ai-features.functions";
import { getServiceBillAlert } from "@/lib/service-bill-review.functions";
import { addSupportNote, escalateSupportConversation, listSupportCustomers, updateSupportCustomer } from "@/lib/support-staff.functions";
import { addProjectNote, addSalesUpdate, importProjects, saveProject } from "@/lib/projects.functions";
import { submitCallReport } from "@/lib/call-reports.server";
import { countsTowardScore } from "@/lib/top-performer.server";

const invoke = (fn: unknown, data: unknown = {}) => (fn as (input: { data: unknown }) => Promise<unknown>)({ data });
beforeEach(() => {
  state.caller = { scope: "agent", readOnly: false, profile: { id: "agent-a", name: "Agent" } };
  state.assignee = "agent-a"; state.accessError = false; state.writes = []; state.configReads = 0;
  state.escalations = 0; state.customerFilter = ""; state.phoneSeconds = null; state.channel = "call";
  state.leadOwner = "agent-a"; state.allowSubmit = false;
});

describe("private reads authenticate before accessing data", () => {
  for (const [name, fn] of [["AI model", getAiModel], ["bill alert", getServiceBillAlert]] as const) {
    it(`${name} rejects anonymous callers`, async () => {
      state.caller.scope = "none";
      await expect(invoke(fn)).rejects.toThrow("Sign in required");
      expect(state.configReads).toBe(0);
    });
    it(`${name} keeps approved staff reads`, async () => {
      await invoke(fn); expect(state.configReads).toBe(1);
    });
  }
});
describe("support access follows own or unassigned conversations", () => {
  for (const assignee of ["agent-a", null]) it(`allows customer update for ${assignee ?? "unassigned"} work`, async () => {
    state.assignee = assignee;
    await invoke(updateSupportCustomer, { customerId: "customer-a", name: "Updated" });
    expect(state.writes).toEqual([{ table: "support_customers", patch: { name: "Updated" } }]);
  });
  it("rejects foreign customer updates and customer-only notes", async () => {
    state.assignee = "agent-b";
    await expect(invoke(updateSupportCustomer, { customerId: "customer-b" })).rejects.toThrow("not available");
    await expect(invoke(addSupportNote, { customerId: "customer-b", body: "note" })).rejects.toThrow("not available");
    expect(state.writes).toEqual([]);
  });
  it("fails closed when assignment lookup fails", async () => {
    state.accessError = true;
    await expect(invoke(updateSupportCustomer, { customerId: "customer-a" })).rejects.toThrow("not available");
    expect(state.writes).toEqual([]);
  });
  it("foreign customers are absent from the list", async () => {
    state.assignee = "agent-b";
    await expect(invoke(listSupportCustomers)).resolves.toEqual({ customers: [] });
  });
  it("lists accessible customer IDs only", async () => {
    await invoke(listSupportCustomers); expect(state.customerFilter).toBe("customer-a");
  });
  it("denies escalation of another agent's conversation", async () => {
    state.assignee = "agent-b";
    await expect(invoke(escalateSupportConversation, { conversationId: "conversation-b" })).rejects.toThrow("another agent");
    expect(state.escalations).toBe(0);
  });
  it("denies escalation of unassigned work until the agent owns it", async () => {
    state.assignee = null;
    await expect(invoke(escalateSupportConversation, { conversationId: "conversation-a", reason: "Help needed" })).rejects.toThrow("must own");
    expect(state.escalations).toBe(0);
  });
  it("permits escalation of the agent's own conversation", async () => {
    await invoke(escalateSupportConversation, { conversationId: "conversation-a", reason: "Help needed" });
    expect(state.escalations).toBe(1);
  });
  it("preserves support lead escalation of unassigned conversations", async () => {
    state.caller.scope = "coordinator"; state.assignee = null;
    await invoke(escalateSupportConversation, { conversationId: "conversation-a", reason: "Help needed" });
    expect(state.escalations).toBe(1);
  });
  it("authority keeps customer edit access", async () => {
    state.caller.scope = "authority"; state.assignee = "agent-b";
    await invoke(updateSupportCustomer, { customerId: "customer-b", name: "Updated" });
    expect(state.writes).toHaveLength(1);
  });
});
describe("read-only HQ cannot write project or support data", () => {
  for (const [name, fn, data] of [
    ["project import", importProjects, { rows: [] }], ["project save", saveProject, {}],
    ["owner note", addProjectNote, { party: "land_owner", note: "note" }],
    ["sales update", addSalesUpdate, {}], ["customer update", updateSupportCustomer, {}],
    ["escalation", escalateSupportConversation, {}],
  ] as const) it(`blocks ${name} before writes`, async () => {
    state.caller.scope = "authority"; state.caller.readOnly = true;
    await expect(invoke(fn, data)).rejects.toThrow(/view-only/);
    expect(state.writes).toEqual([]); expect(state.escalations).toBe(0);
  });
});
describe("report submission verifies only phone-measured duration", () => {
  const input = { reportId: "report-a", agentId: "agent-a", category: "interested", summary: "Requested details", temperature: "warm", grade: "B", direction: "outgoing", callStatus: "connected", durationSeconds: 9000, followUpNeeded: false, noFollowUpReason: "info_completed" };
  it("a forged web time and connected claim do not earn verification", async () => {
    await expect(submitCallReport(input)).rejects.toThrow("captured submission");
    expect(state.writes[0]?.patch.connection_verified).toBe(false);
  });
  it("phone sync supplies both verified duration and sync timestamp", async () => {
    state.phoneSeconds = 95;
    await expect(submitCallReport(input)).rejects.toThrow("captured submission");
    expect(state.writes[0]?.patch).toMatchObject({ connection_verified: true, duration_seconds: 95, duration_source: "phone_sync", duration_synced_at: "2026-10-19T00:01:00Z" });
  });
  it("WhatsApp typed time remains unverified even with a linked phone row", async () => {
    state.phoneSeconds = 95; state.channel = "whatsapp";
    await expect(submitCallReport(input)).rejects.toThrow("captured submission");
    expect(state.writes[0]?.patch).toMatchObject({ connection_verified: false, duration_source: "whatsapp_entered" });
  });
  it("a lead reassigned before submit still closes the report without touching the lead", async () => {
    state.allowSubmit = true; state.leadOwner = "agent-b";
    const result = await submitCallReport(input) as { ok: boolean; reassigned: boolean };
    expect(result.ok).toBe(true);
    expect(result.reassigned).toBe(true);
    const tables = state.writes.map((w) => w.table);
    expect(tables).toContain("call_reports");
    expect(tables).not.toContain("leads");
    expect(tables).not.toContain("follow_up_events");
    expect(tables).not.toContain("lead_classifications");
  });
  it("a lead still owned by the agent keeps the normal lead update", async () => {
    state.allowSubmit = true;
    const result = await submitCallReport(input) as { ok: boolean; reassigned: boolean };
    expect(result.ok).toBe(true);
    expect(result.reassigned).toBe(false);
    expect(state.writes.map((w) => w.table)).toContain("leads");
  });
  it("new null verification cannot bypass ranking while historical reports remain eligible", () => {
    expect(countsTowardScore({ connection_verified: null, submitted_at: "2026-10-19T00:00:00Z" })).toBe(false);
    expect(countsTowardScore({ connection_verified: null, submitted_at: "2026-10-01T00:00:00Z" })).toBe(true);
  });
});