/**
 * STAGING-ONLY end-to-end check of every MCP tool returned by tools/list.
 *
 * Order (fails closed at each step):
 *   1. assertStaging(): opt-in + confirmed staging ref + allow-listed staging app host.
 *   2. verifyAppBackend(): the app's published sign-in issuer is that same staging ref.
 *   3. Seeds synthetic market_facts whose metric AND geography carry a unique TAG.
 *   4. Discovers tools via tools/list and runs generic checks on each one,
 *      plus fixture checks for tools this suite knows the data contract of.
 *   5. afterAll: deletes only rows whose metric starts with this run's TAG,
 *      then prints a per-tool PASS/FAIL summary.
 *
 * Prerequisite: the OAuth-approved test account's email must be on the staging
 * IT Console allow-list (app_config.mcpAllowedEmails), otherwise tools refuse.
 *
 * Run:
 *   STAGING_E2E=1 SUPABASE_URL=https://<ref>.supabase.co STAGING_CONFIRM=<ref> \
 *   SUPABASE_SERVICE_ROLE_KEY=<staging key> STAGING_APP_URL=https://<staging-app> \
 *   STAGING_APP_ALLOWLIST=<staging-app-host> STAGING_MCP_TOKEN=<oauth access token> \
 *   bunx vitest run --config vitest.staging.config.ts tests/staging/mcp-tools.staging.ts
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { assertStaging, verifyAppBackend } from "./guard";

const { supabaseUrl, ref, appUrl } = assertStaging(); // throws before anything else
const token = process.env["STAGING_MCP_TOKEN"];
const serviceKey = process.env["SUPABASE_SERVICE_ROLE_KEY"];
if (!token || !serviceKey) throw new Error("[staging] STAGING_MCP_TOKEN and SUPABASE_SERVICE_ROLE_KEY are required");

/** Per-request timeout; one hung call fails that check only. */
const TIMEOUT_MS = Math.max(1000, Number(process.env["STAGING_MCP_TIMEOUT_MS"] ?? 15000) || 15000);

const TAG = `STAGING-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

interface ToolDef {
  name: string;
  inputSchema?: { properties?: Record<string, JsonSchema>; required?: string[] };
}
interface JsonSchema {
  type?: string | string[];
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
}
interface RpcReply {
  status: number;
  json: { id?: number; result?: { isError?: boolean; tools?: ToolDef[]; content?: { type: string; text?: string }[] }; error?: { code: number; message: string } } | null;
  raw: string;
  timedOut?: boolean;
}

const results: { tool: string; check: string; pass: boolean; detail?: string }[] = [];
function record(tool: string, check: string, pass: boolean, detail?: string) {
  results.push({ tool, check, pass, detail });
  return pass;
}

let nextId = 1;
/** Parses a plain JSON body or an SSE stream (picks the message with our id). Never throws on bad bodies. */
export function parseRpcBody(raw: string, id: number): RpcReply["json"] {
  const tryParse = (s: string) => {
    try {
      return JSON.parse(s) as RpcReply["json"];
    } catch {
      return null;
    }
  };
  const trimmed = raw.trim();
  if (trimmed.startsWith("{")) return tryParse(trimmed);
  const messages = trimmed
    .split(/\r?\n\r?\n/)
    .map((evt) => evt.split(/\r?\n/).filter((l) => l.startsWith("data:")).map((l) => l.slice(5).trimStart()).join("\n"))
    .filter(Boolean)
    .map(tryParse)
    .filter((m): m is NonNullable<RpcReply["json"]> => !!m);
  return messages.find((m) => m.id === id) ?? null;
}

async function rpc(method: string, params: unknown, auth: string | null = token!): Promise<RpcReply> {
  const id = nextId++;
  try {
    const res = await fetch(`${appUrl}/mcp`, {
      method: "POST",
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: {
        "content-type": "application/json",
        accept: "application/json, text/event-stream",
        ...(auth ? { authorization: `Bearer ${auth}` } : {}),
      },
      body: JSON.stringify({ jsonrpc: "2.0", id, method, params }),
    });
    const raw = await res.text();
    return { status: res.status, json: parseRpcBody(raw, id), raw: raw.slice(0, 300) };
  } catch (e) {
    const name = (e as Error).name;
    const why = name === "TimeoutError" || name === "AbortError" ? `timed out after ${TIMEOUT_MS} ms` : `network error: ${(e as Error).message}`;
    return { status: 0, json: null, raw: `${method} ${why}`, timedOut: name === "TimeoutError" || name === "AbortError" };
  }
}

const callTool = (name: string, args: Record<string, unknown>) => rpc("tools/call", { name, arguments: args });
const isRejected = (r: RpcReply) => !r.timedOut && r.status !== 0 && (r.status >= 400 || !!r.json?.error || r.json?.result?.isError === true);
const succeeded = (r: RpcReply) => r.status === 200 && !!r.json?.result && !r.json.error && r.json.result.isError !== true;

const typeOf = (s: JsonSchema) => (Array.isArray(s.type) ? s.type[0] : s.type);

/** Only required arguments, filled from schema bounds. Optional args keep their server defaults. */
function minimalArgs(tool: ToolDef): Record<string, unknown> {
  const args: Record<string, unknown> = {};
  const props = tool.inputSchema?.properties ?? {};
  for (const key of tool.inputSchema?.required ?? []) {
    const s = props[key] ?? {};
    const t = typeOf(s);
    if (t === "number" || t === "integer") args[key] = s.minimum ?? 1;
    else if (t === "boolean") args[key] = false;
    else args[key] = "x".repeat(Math.max(s.minLength ?? 1, 1));
  }
  return args;
}

/** One argument set per violatable constraint advertised in the schema. */
function invalidArgSets(tool: ToolDef): { label: string; args: Record<string, unknown> }[] {
  const out: { label: string; args: Record<string, unknown> }[] = [];
  for (const [key, s] of Object.entries(tool.inputSchema?.properties ?? {})) {
    const t = typeOf(s);
    if ((t === "number" || t === "integer") && s.minimum !== undefined) out.push({ label: `${key} below minimum`, args: { ...minimalArgs(tool), [key]: s.minimum - 1 } });
    if ((t === "number" || t === "integer") && s.maximum !== undefined) out.push({ label: `${key} above maximum`, args: { ...minimalArgs(tool), [key]: s.maximum + 1 } });
    if (t === "integer") out.push({ label: `${key} not an integer`, args: { ...minimalArgs(tool), [key]: 1.5 } });
    if (t === "string" && s.maxLength !== undefined) out.push({ label: `${key} too long`, args: { ...minimalArgs(tool), [key]: "x".repeat(s.maxLength + 1) } });
  }
  out.push({ label: "undeclared argument", args: { ...minimalArgs(tool), __staging_unknown__: 1 } });
  return out;
}

function taggedFacts(r: RpcReply): { metric: string; geography: string }[] {
  const textPart = r.json?.result?.content?.find((c) => c.type === "text")?.text ?? "{}";
  const parsed = JSON.parse(textPart) as { facts?: { metric?: string; geography?: string }[] };
  return (parsed.facts ?? []).filter((f) => f.metric?.startsWith(TAG)) as { metric: string; geography: string }[];
}

/** Data-contract checks for tools whose implementation we know (src/lib/mcp/tools). */
const FIXTURE_CHECKS: Record<string, (name: string) => Promise<void>> = {
  // Implementation: category=project_property, status=published, verified_at not null,
  // expiry null or >= today, optional geography ILIKE %value% (trimmed, 2..100 chars), limit 1..100.
  async list_public_property_facts(name) {
    const all = taggedFacts(await callTool(name, { geography: TAG, limit: 100 }));
    const metrics = all.map((f) => f.metric).sort();
    const expected = [`${TAG} published-a`, `${TAG} published-b`, `${TAG} published-c`];
    expect(record(name, "only published, verified, unexpired fixtures", JSON.stringify(metrics) === JSON.stringify(expected), metrics.join(","))).toBe(true);

    const uttara = taggedFacts(await callTool(name, { geography: `${TAG} Dhaka - Uttara`, limit: 100 }));
    expect(record(name, "geography substring filter", uttara.length === 1 && uttara[0]!.metric === `${TAG} published-b`, `got ${uttara.length}`)).toBe(true);

    const caseInsensitive = taggedFacts(await callTool(name, { geography: `${TAG} dhaka - uttara`.toLowerCase(), limit: 100 }));
    expect(record(name, "geography filter is case-insensitive", caseInsensitive.length === 1, `got ${caseInsensitive.length}`)).toBe(true);

    const short = await callTool(name, { geography: "x" });
    expect(record(name, "geography shorter than 2 chars rejected", isRejected(short), short.raw)).toBe(true);
  },
};

let db: SupabaseClient | null = null;
let tools: ToolDef[] = [];

beforeAll(async () => {
  await verifyAppBackend(appUrl, ref); // app must sign in against the confirmed staging backend
  db = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
  const now = new Date().toISOString();
  const today = now.slice(0, 10);
  const base = { category: "project_property", source_name: "STAGING FIXTURE", value: "1", effective_date: today };
  const { error } = await db.from("market_facts").insert([
    { ...base, metric: `${TAG} published-a`, geography: `${TAG} Dhaka - Bashundhara`, status: "published", verified_at: now },
    { ...base, metric: `${TAG} published-b`, geography: `${TAG} Dhaka - Uttara`, status: "published", verified_at: now },
    { ...base, metric: `${TAG} published-c`, geography: `${TAG} Chattogram`, status: "published", verified_at: now },
    { ...base, metric: `${TAG} draft`, geography: `${TAG} Dhaka - Uttara`, status: "draft" },
    { ...base, metric: `${TAG} unverified`, geography: `${TAG} Dhaka - Uttara`, status: "published" },
    { ...base, metric: `${TAG} expired`, geography: `${TAG} Dhaka - Uttara`, status: "published", verified_at: now, expiry_date: "2000-01-01" },
  ]);
  if (error) throw new Error(`[staging] fixture insert failed: ${error.message}`);

  const listed = await rpc("tools/list", {});
  const list = listed.json?.result?.tools;
  if (!succeeded(listed) || !Array.isArray(list) || list.length === 0) throw new Error(`[staging] tools/list failed: ${listed.raw}`);
  tools = list;
}, 60_000);

afterAll(async () => {
  // Cleanup runs only because the module-level guard already passed; scoped to this run's TAG.
  if (db) {
    const { error, count } = await db.from("market_facts").delete({ count: "exact" }).like("metric", `${TAG}%`);
    console.log(error ? `[staging] cleanup failed: ${error.message} — rows tagged ${TAG} remain` : `[staging] cleanup removed ${count ?? 0} rows tagged ${TAG}`);
  }
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
  for (const t of tools) if (!byTool.has(t.name)) byTool.set(t.name, { pass: 0, fail: 1, failures: ["no checks ran"] });
  console.log("\n===== MCP STAGING SUMMARY =====");
  for (const [tool, e] of byTool) {
    console.log(`${e.fail === 0 ? "PASS" : "FAIL"}  ${tool}  (${e.pass} passed, ${e.fail} failed)`);
    for (const f of e.failures) console.log(`       x ${f}`);
  }
  console.log("================================\n");
});

describe("MCP on staging — auth", () => {
  it("rejects unauthenticated calls", async () => {
    const r = await rpc("tools/list", {}, null);
    expect(record("(server)", "unauthenticated rejected with 401", r.status === 401, `status ${r.status}`)).toBe(true);
  });
  it("rejects a bogus token", async () => {
    const r = await rpc("tools/list", {}, "bogus-token");
    expect(record("(server)", "bogus token rejected with 401", r.status === 401, `status ${r.status}`)).toBe(true);
  });
  it("rejects an unknown tool name", async () => {
    const r = await callTool(`staging_unknown_${TAG}`, {});
    expect(record("(server)", "unknown tool rejected", isRejected(r), r.raw)).toBe(true);
  });
});

describe("MCP on staging — every listed tool", () => {
  it("executes, validates input, and meets its data contract", { timeout: 0 }, async () => {
    for (const tool of tools) {
      // Error isolation: anything thrown or hung inside one tool's checks is
      // recorded against that tool, and the loop moves on to the next tool.
      try {
        const ok = await callTool(tool.name, minimalArgs(tool));
        record(tool.name, "executes with minimal valid args", succeeded(ok), succeeded(ok) ? undefined : ok.raw);

        for (const bad of invalidArgSets(tool)) {
          const r = await callTool(tool.name, bad.args);
          record(tool.name, `rejects ${bad.label}`, isRejected(r), isRejected(r) ? undefined : r.raw);
        }

        const fixture = FIXTURE_CHECKS[tool.name];
        if (fixture) {
          try {
            await fixture(tool.name);
          } catch (e) {
            record(tool.name, "fixture checks", false, (e as Error).message.slice(0, 200));
          }
        } else {
          record(tool.name, "data contract", false, "no fixture check written for this tool — add one to FIXTURE_CHECKS");
        }
      } catch (e) {
        record(tool.name, "checks aborted", false, (e as Error).message.slice(0, 200));
      }
    }
    expect(results.filter((r) => !r.pass)).toEqual([]);
  });
});
