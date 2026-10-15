import { describe, it, expect, vi, beforeEach } from "vitest";

// Records every database call the push module makes.
const calls: { table: string; op: string; arg?: unknown }[] = [];
const tokenRows = [{ token: "tok-own", platform: "android", profile_id: "me" }];

function builder(table: string) {
  const b: Record<string, unknown> = {};
  const chain = (op: string) => (arg?: unknown) => { calls.push({ table, op, arg }); return b; };
  for (const op of ["select", "update", "eq", "is"]) b[op] = chain(op);
  b.insert = (arg: unknown) => { calls.push({ table, op: "insert", arg }); return Promise.resolve({ error: null }); };
  b.in = (col: string, ids: string[]) => { calls.push({ table, op: "in", arg: ids }); return { is: () => Promise.resolve({ data: tokenRows.filter((r) => ids.includes(r.profile_id)) }) }; };
  b.then = (res: (v: unknown) => void) => res({ error: null });
  return b;
}
vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: { from: (t: string) => builder(t) } }));

const fetchMock = vi.fn(async (_url: string, init: { body: string }) => ({ ok: false, status: 404, text: async () => '{"error":{"details":[{"errorCode":"UNREGISTERED"}]}}', init }));

beforeEach(() => {
  calls.length = 0;
  fetchMock.mockClear();
  vi.stubGlobal("fetch", fetchMock);
  process.env["LOVABLE_API_KEY"] = "test-key";
  process.env["FIREBASE_MESSAGING_API_KEY"] = "test-conn";
});

const base = { eventKey: "dry:1", kind: "test", payload: { title: "t", body: "b" } };

describe("push dry run", () => {
  it("never writes a delivery record or revokes a token, even on a dead-token reply", async () => {
    const { sendPush } = await import("@/lib/push.server");
    await sendPush({ ...base, profileIds: ["me"], dryRun: true });
    const writes = calls.filter((c) => c.op === "insert" || c.op === "update");
    expect(writes).toEqual([]);
    expect(calls.some((c) => c.table === "push_deliveries")).toBe(false);
  });

  it("only targets the requester's own devices and validates without delivering", async () => {
    const { sendPush } = await import("@/lib/push.server");
    await sendPush({ ...base, profileIds: ["me"], dryRun: true });
    expect(calls.find((c) => c.op === "in")?.arg).toEqual(["me"]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.validate_only).toBe(true);
    expect(body.message.token).toBe("tok-own");
  });

  it("refuses a dry run aimed at more than one person", async () => {
    const { sendPush } = await import("@/lib/push.server");
    const r = await sendPush({ ...base, profileIds: ["me", "someone-else"], dryRun: true });
    expect(r.skipped).toBe("dry_run_single_profile_only");
    expect(calls).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
