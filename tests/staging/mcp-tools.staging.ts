/**
 * STAGING-ONLY end-to-end check of every MCP tool on an isolated backend.
 * Seeds clearly labelled synthetic market_facts, then calls /mcp with a real
 * OAuth token obtained through the consent screen on the staging app.
 *
 * STAGING_E2E=1 STAGING_CONFIRM=<ref> SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=...
 * STAGING_APP_URL=https://<staging-app> STAGING_MCP_TOKEN=<oauth token> \
 *   bunx vitest run --config vitest.staging.config.ts tests/staging/mcp-tools.staging.ts
 */
import { createClient } from "@supabase/supabase-js";
import { beforeAll, describe, expect, it } from "vitest";
import { assertStaging } from "./guard";

const supabaseUrl = assertStaging(); // throws before any write on non-staging
const app = process.env["STAGING_APP_URL"];
const token = process.env["STAGING_MCP_TOKEN"];
if (!app || !token) throw new Error("[staging] STAGING_APP_URL and STAGING_MCP_TOKEN are required");
const TAG = `STAGING:${Date.now()}`;

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
});

const facts = (r: any) => JSON.parse(r.json.result.content[0].text).facts.filter((f: any) => f.metric?.startsWith(TAG));

describe("MCP on staging", () => {
  it("rejects unauthenticated calls", async () => expect((await rpc("tools/list", {}, "")).status).toBe(401));
  it("lists exactly the existing tools", async () => {
    const r = await rpc("tools/list", {});
    expect(r.json.result.tools.map((t: any) => t.name)).toEqual(["list_public_property_facts"]);
  });
  it("returns only published, unexpired fixtures", async () => {
    expect(facts(await rpc("tools/call", { name: "list_public_property_facts", arguments: { limit: 100 } }))).toHaveLength(3);
  });
  it("filters by geography", async () => {
    expect(facts(await rpc("tools/call", { name: "list_public_property_facts", arguments: { geography: "Uttara", limit: 100 } }))).toHaveLength(1);
  });
  it("rejects invalid input", async () => {
    const r = await rpc("tools/call", { name: "list_public_property_facts", arguments: { limit: 0 } });
    expect(r.json.result?.isError ?? !!r.json.error).toBe(true);
  });
});
