import { describe, it, expect, vi, beforeEach } from "vitest";

// createServerFn passthrough: .inputValidator(v).handler(h) → callable(h(validated)).
vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => {
    let validate = (i: unknown) => i;
    const api = {
      inputValidator(v: (i: unknown) => unknown) { validate = v; return api; },
      handler(h: (a: { data: unknown }) => unknown) { return (a: { data?: unknown } = {}) => h({ data: validate(a.data) }); },
    };
    return api;
  },
}));

const caller = vi.fn();
vi.mock("@/lib/sales-intel.server", () => ({ siCaller: (t: unknown) => caller(t) }));
vi.mock("@/lib/audit.server", () => ({ logAudit: vi.fn(async () => undefined) }));

const signed: string[] = [];
const rows = () => [{ id: "p1", name: "Tower", status: "active", image_url: "storage:project-photos/p1.jpg" }];
function q(result: unknown) {
  const b: Record<string, unknown> = {};
  for (const op of ["select", "order", "eq", "is", "gte", "limit"]) b[op] = () => b;
  b.then = (res: (v: unknown) => void) => res(result);
  return b;
}
vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: {
    from: (t: string) => q(t === "project_catalog" ? { data: rows(), error: null } : { data: [] }),
    storage: { from: (bucket: string) => ({ createSignedUrl: async (path: string, ttl: number) => {
      signed.push(`${bucket}/${path}@${ttl}`);
      return { data: { signedUrl: `https://x/storage/v1/object/sign/${bucket}/${path}?token=t` } };
    } }) },
  },
}));

beforeEach(() => { signed.length = 0; caller.mockReset(); });

describe("project photo links", () => {
  it("staff (agent or HQ) receive a short-lived signed link", async () => {
    const { listProjects } = await import("@/lib/projects.functions");
    for (const scope of ["agent", "authority"] as const) {
      caller.mockResolvedValueOnce({ scope, agentId: "a1", readOnly: false, actor: "x" });
      const r = await listProjects({ data: { adminToken: null } });
      expect(r.projects[0].image_url).toContain("/object/sign/project-photos/");
    }
    expect(signed).toEqual(["project-photos/p1.jpg@120", "project-photos/p1.jpg@120"]);
  });

  it("a signed-in user who is not approved staff gets no projects and no links", async () => {
    const { listProjects } = await import("@/lib/projects.functions");
    caller.mockRejectedValueOnce(new Error("not staff"));
    const r = await listProjects({ data: { adminToken: "bogus" } });
    expect(r.projects).toEqual([]);
    expect(signed).toEqual([]);
  });

  it("no browser-side download rule exists for the bucket", async () => {
    const { readdirSync, readFileSync } = await import("node:fs");
    const files = readdirSync("supabase/migrations").map((f) => readFileSync(`supabase/migrations/${f}`, "utf8"));
    const last = files.map((s) => /CREATE POLICY[^;]*project-photos/i.test(s) ? "create" : /DROP POLICY[^;]*(project.photos|project photos)/i.test(s) ? "drop" : null).filter(Boolean).pop();
    expect(last === undefined || last === "drop").toBe(true);
  });
});
