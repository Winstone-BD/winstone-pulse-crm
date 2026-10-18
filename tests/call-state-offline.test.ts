import { beforeEach, describe, expect, it, vi } from "vitest";

const fixture = vi.hoisted(() => ({
  rows: new Map<string, Record<string, unknown>>(),
  reports: [] as Record<string, unknown>[],
  agent: "agent-1",
}));
vi.mock("@tanstack/react-router", () => ({ createFileRoute: () => (config: unknown) => config }));
vi.mock("@/lib/device-auth.server", () => ({ resolveApiCaller: async () => ({ kind: "device", profile: { id: fixture.agent, name: "Synthetic", phone: null }, device: { id: "device-1" } }) }));
vi.mock("@/lib/lead-events.server", () => ({ logLeadEvent: async () => {} }));
vi.mock("@/lib/call-jobs.server", () => ({ recordSyncEvent: async () => {} }));
vi.mock("@/lib/call-reports.server", () => ({ openCallReport: async (input: Record<string, unknown>) => { fixture.reports.push(input); return { id: "report-1" }; } }));
vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: { from(table: string) {
    const filters: [string, unknown][] = [];
    let patch: Record<string, unknown> | null = null;
    let insert: Record<string, unknown> | null = null;
    const finish = () => {
      if (table === "leads") return { data: { id: "11111111-1111-4111-8111-111111111111", phone_number: "01700000000", assigned_to: "agent-1", assigned_agent_id: "agent-1" }, error: null };
      if (table !== "call_recordings") return { data: null, error: null };
      if (insert) {
        const row = { id: "recording-1", created_at: new Date().toISOString(), ...insert };
        fixture.rows.set(String(row.id), row);
        return { data: row, error: null };
      }
      const row = [...fixture.rows.values()].find(r => filters.every(([key, value]) => r[key] === value));
      if (row && patch) Object.assign(row, patch);
      return { data: row ?? null, error: null };
    };
    const chain = {
      select: (_?: string) => chain,
      eq: (key: string, value: unknown) => { filters.push([key, value]); return chain; },
      is: (key: string, value: unknown) => { filters.push([key, value]); return chain; },
      in: () => chain,
      update: (data: Record<string, unknown>) => { patch = data; return chain; },
      insert: (data: Record<string, unknown>) => { insert = data; return chain; },
      maybeSingle: async () => finish(),
      single: async () => finish(),
      then: (resolve: (value: ReturnType<typeof finish>) => unknown) => Promise.resolve(finish()).then(resolve),
    };
    return chain;
  } },
}));

import { Route } from "@/routes/api/public/agent/call-state";
// Mock router returns the configuration instead of registering a real route.
const config = Route as unknown as { server: { handlers: { POST: (input: { request: Request }) => Promise<Response> } } };
async function push(state: string, seconds = 0, at = "2026-10-18T07:00:00Z") {
  return config.server.handlers.POST({ request: new Request("http://localhost/api/public/agent/call-state", { method: "POST", body: JSON.stringify({ call_uid: "synthetic-call", lead_id: "11111111-1111-4111-8111-111111111111", state, duration_seconds: seconds, at }) }) });
}
beforeEach(() => { fixture.rows.clear(); fixture.reports.length = 0; fixture.agent = "agent-1"; vi.useFakeTimers(); vi.setSystemTime("2026-10-18T08:00:00Z"); });
describe("Android offline endpoint", () => {
  it("preserves 600 seconds on replay and passes the separate claim to the report", async () => {
    expect((await push("initiated")).status).toBe(200);
    vi.advanceTimersByTime(2000);
    expect((await push("completed", 600)).status).toBe(200);
    const row = fixture.rows.get("recording-1");
    expect(row?.device_reported_duration_seconds).toBe(600);
    expect(row?.duration_seconds).toBe(62);
    expect(fixture.reports[0]?.deviceReportedDurationSeconds).toBe(600);
    expect(fixture.reports[0]?.durationSeconds).toBe(62);
  });
  it("completion-first and backdated timestamps cannot grant trusted minutes", async () => {
    expect((await push("completed", 600, "2020-01-01T00:00:00Z")).status).toBe(200);
    expect(fixture.rows.get("recording-1")?.duration_seconds).toBe(0);
    expect(fixture.rows.get("recording-1")?.device_reported_duration_seconds).toBe(600);
    await push("initiated");
    expect(fixture.rows.get("recording-1")?.call_status).toBe("completed");
    vi.advanceTimersByTime(3600000);
    await push("completed", 86400, "2099-01-01T00:00:00Z");
    expect(fixture.rows.get("recording-1")?.duration_seconds).toBe(0);
    expect(fixture.rows.get("recording-1")?.device_reported_duration_seconds).toBe(600);
  });
  it("refuses an existing call owned by another agent", async () => {
    fixture.rows.set("recording-1", { id: "recording-1", external_call_id: "synthetic-call", agent_id: "other", lead_id: "11111111-1111-4111-8111-111111111111" });
    expect((await push("completed", 600)).status).toBe(403);
    expect(fixture.reports).toHaveLength(0);
  });
});