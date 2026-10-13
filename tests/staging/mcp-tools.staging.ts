/**
 * STAGING-ONLY end-to-end check of EVERY MCP tool on an isolated backend.
 *
 * Flow once the user provides an isolated staging app and approves sign-in:
 *   1. Seeds clearly labelled synthetic market_facts (tagged STAGING:<ts>).
 *   2. Discovers tools via tools/list — never hardcoded.
 *   3. Runs per-tool checks (auth, execution, filtering, error handling).
 *   4. Prints a per-tool PASS/FAIL summary table at the end.
 *
 * Run:
 *   STAGING_E2E=1 STAGING_CONFIRM=<ref> SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=...
 *   STAGING_APP_URL=https://<staging-app> STAGING_MCP_TOKEN=<oauth token> \
 *   bunx vitest run --config vitest.staging.config.ts tests/staging/mcp-tools.staging.ts
 */
import { createClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { assertStaging } from "./guard";

const supabaseUrl = assertStaging(); // throws before any write on non-staging
const app = process.env["STAGING_APP_URL"];
const token = process.env["STAGING_MCP_TOKEN"];
if (!app || !token) throw new Error("[staging] STAGING_APP_URL and STAGING_MCP_TOKEN are required");
const TAG = `STAGING:${Date.now()}`;

interface ToolDef {
  name: string;
  inputSchema?: { properties?: Record<string, unknown>; required?: string[] };
}

const results: { tool: string; check: string; pass: boolean; detail?: string }[] = [];
function record(tool: string, check: string, pass: boolean, detail?: string) {
  results.push({ tool, check, pass, detail });
}

async function rpc(method: string, params: unknown, auth = token) {
  const res = await fetch(`${app}/mcp`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
      ...(auth ? { authorization: `Bearer ${auth}` } : {}),
    },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  const body = await res.text();
  const json = body.startsWith("{") ? JSON.parse(body) : JSON.parse(body.split("data: ").pop()!.trim());
  return { status: res.status, json };
}

function callTool(name: string, args: Record<string, unknown>) {
  return rpc("tools/call", { name, arguments: args });
}

/** Build minimal valid arguments for a tool from its input schema. */
function validArgs(tool: ToolDef): Record<string, unknown> {
  const args: Record<string, unknown> = {};
  for (const [key, schema] of Object.entries(tool.inputSchema?.properties ?? {})) {
    const t = (schema as { type?: string }).type;
    if (t === "number" || t === "integer") args[key] = 100;
    else if (t === "boolean") args[key] = true;
    else args[key] = "Uttara"; // string filters match a seeded fixture
  }
  return args;
}

/** Build an argument set that must fail validation (violate one constraint). */
function invalidArgs(tool: ToolDef): Record<string, unknown> | null {
  const props = tool.inputSchema?.properties ?? {};
  for (const [key, schema] of Object.entries(props)) {
    const s = schema as { type?: string; minimum?: number };
    if ((s.type === "number" || s.type === "integer") && s.minimum !== undefined) {
      return { ...validArgs(tool), [key]: s.minimum - 1 };
    }
  }
  return null;
}

function toolFacts(r: Awaited<ReturnType<typeof rpc>>) {
  return JSON.parse(r.json.result.content[0].text).facts.filter((f: { metric?: string }) => f.metric?.startsWith(TAG));
}

let tools: ToolDef[] = [];

beforeAll(async () => {
  const db = createClient(supabaseUrl, process.env["SUPABASE_SERVICE_ROLE_KEY"]!, { auth: { persistSession: false } });
  const today = new Date().toISOString().slice(0, 10);
  const base = { category: "project_property", source_name: "STAGING FIXTURE", value: "1", effective_date: today };
  const { error } = await db.from("market_facts").insert([
    { ...base, metric: `${TAG} a`, geography: "Dhaka - Bashundhara", status: "published", verified_at: new Date().toISOString() },
    { ...base, metric: `${TAG} b`, geography: "Dhaka - Uttara", status: "published", verified_at: new Date().toISOString() },
    { ...base, metric: `${TAG} c`, geography: "Chattogram", status: "published", verified_at: new Date().toISOString() },
    { ...base, metric: `${TAG} draft`, geography: "Dhaka - Uttara", status: "draft" },
    { ...base, metric: `${TAG} expired`, geography: "Dhaka - Uttara", status: "published", verified_at: new Date().toISOString(), expiry_date: "2000-01-01" },
  ] as never);
  if (error) throw error;

  const listed = await rpc("tools/list", {});
  tools = listed.json.result.tools;
  if (!Array.isArray(tools) || tools.length === 0) throw new Error("[staging] tools/list returned no tools");
});

afterAll(() => {
  const byTool = new Map<string, { pass: number; fail: number; failures: string[] }>();
  for (const r of results) {
    const e = byTool.get(r.tool) ?? { pass: 0, fail: 0, failures: [] };
    if (r.pass) e.pass++;
    else {
      e.fail++;
      e.failures.push(`${r.check}${r.detail ? ` — ${r.detail}` : ""}`);
    }
    byTool.set(r.tool, e);
  }
  console.log("\n===== MCP STAGING SUMMARY =====");
  for (const [tool, e] of byTool) {
    console.log(`${e.fail === 0 ? "PASS" : "FAIL"}  ${tool}  (${e.pass} passed, ${e.fail} failed)`);
    for (const f of e.failures) console.log(`       ✗ ${f}`);
  }
  console.log("================================\n");
});

describe("MCP on staging — auth", () => {
  it("rejects unauthenticated calls", async () => {
    const r = await rpc("tools/list", {}, "");
    record("(server)", "unauthenticated rejected", r.status === 401, `status ${r.status}`);
    expect(r.status).toBe(401);
  });
  it("rejects a bogus token", async () => {
    const r = await rpc("tools/list", {}, "bogus-token");
    record("(server)", "bogus token rejected", r.status === 401, `status ${r.status}`);
    expect(r.status).toBe(401);
  });
});

describe("MCP on staging — per-tool checks", () => {
  it("every discovered tool executes and handles errors", async () => {
    for (const tool of tools) {
      // 1. Executes with valid arguments
      const ok = await callTool(tool.name, validArgs(tool));
      const okPass = ok.status === 200 && !ok.json.error && !ok.json.result?.isError;
      record(tool.name, "executes with valid args", okPass, okPass ? undefined : JSON.stringify(ok.json).slice(0, 200));
      expect(okPass).toBe(true);

      // 2. Returns only published, unexpired fixture rows (3 of 5 seeded)
      if (tool.name === "list_public_property_facts") {
        const rows = toolFacts(ok);
        record(tool.name, "returns only published unexpired fixtures", rows.length === 3, `got ${rows.length}`);
        expect(rows).toHaveLength(3);

        const filtered = toolFacts(await callTool(tool.name, { geography: "Uttara", limit: 100 }));
        record(tool.name, "geography filter works", filtered.length === 1, `got ${filtered.length}`);
        expect(filtered).toHaveLength(1);
      }

      // 3. Rejects invalid input, when the schema has a violatable constraint
      const bad = invalidArgs(tool);
      if (bad) {
        const r = await callTool(tool.name, bad);
        const rejected = (r.json.result?.isError ?? false) || !!r.json.error;
        record(tool.name, "invalid input rejected", rejected, rejected ? undefined : JSON.stringify(r.json).slice(0, 200));
        expect(rejected).toBe(true);
      }

      // 4. Unknown tool name is an error, not a crash
      const unknown = await callTool(`${tool.name}__nope`, {});
      const unknownRejected = (unknown.json.result?.isError ?? false) || !!unknown.json.error;
      record("(server)", "unknown tool rejected", unknownRejected, unknownRejected ? undefined : JSON.stringify(unknown.json).slice(0, 200));
      expect(unknownRejected).toBe(true);
    }
  });
});
