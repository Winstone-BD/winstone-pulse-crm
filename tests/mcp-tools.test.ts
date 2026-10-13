/**
 * MCP server checks: discovery, auth gate and error handling for every tool.
 *
 * In-process part (always runs): every registered tool is discoverable with its
 * expected schema, and every handler refuses signed-out callers, callers without
 * an email, before touching the database.
 *
 * Live part (opt-in, MCP_LIVE_URL=https://crm.winstonebd.com): unauthenticated
 * calls get 401 + OAuth metadata, and a plain signed-in session token is
 * rejected (the server only accepts OAuth-issued tokens). Executing tools with
 * data needs a real OAuth client connection — see docs/testing.md.
 */
import { describe, expect, it } from "vitest";

import mcp from "@/lib/mcp/index";
import { staffAccessToken } from "./fixtures/staff-session";

type AnyTool = { name: string; inputSchema: Record<string, unknown>; handler: (i: unknown, c: unknown) => unknown };
const tools = ((mcp as unknown as { tools?: AnyTool[] }).tools ?? []) as AnyTool[];
const EXPECTED = ["list_public_property_facts"];

function ctx(opts: { authed: boolean; email?: string }) {
  return { isAuthenticated: () => opts.authed, getUserEmail: () => opts.email, signal: new AbortController().signal };
}

describe("MCP discovery", () => {
  it("registers exactly the existing tools", () => {
    expect(tools.map((t) => t.name).sort()).toEqual(EXPECTED);
  });
  it("keeps list_public_property_facts inputs", () => {
    const t = tools.find((x) => x.name === "list_public_property_facts")!;
    expect(Object.keys(t.inputSchema).sort()).toEqual(["geography", "limit"]);
  });
});

describe.each(tools.map((t) => [t.name, t] as const))("tool %s auth", (_n, tool) => {
  it("rejects signed-out callers", async () => {
    await expect(Promise.resolve().then(() => tool.handler({ limit: 1 }, ctx({ authed: false })))).rejects.toThrow(/Sign in/);
  });
  it("rejects accounts without email", async () => {
    await expect(Promise.resolve().then(() => tool.handler({ limit: 1 }, ctx({ authed: true })))).rejects.toThrow(/no verified email/);
  });
});

const LIVE = process.env["MCP_LIVE_URL"];
describe.skipIf(!LIVE)("live /mcp endpoint", () => {
  const init = { jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "test", version: "1" } } };
  const post = (headers: Record<string, string> = {}) =>
    fetch(`${LIVE}/mcp`, { method: "POST", headers: { "content-type": "application/json", accept: "application/json, text/event-stream", ...headers }, body: JSON.stringify(init) });

  it("returns 401 with OAuth metadata when signed out", async () => {
    const res = await post();
    expect(res.status).toBe(401);
    expect(res.headers.get("www-authenticate") ?? "").toMatch(/resource_metadata/);
    const meta = await fetch(`${LIVE}/.well-known/oauth-protected-resource`);
    expect(meta.ok).toBe(true);
  });

  const token = staffAccessToken();
  it.skipIf(!token)("rejects a plain session token (OAuth client token required)", async () => {
    const res = await post({ authorization: `Bearer ${token}` });
    expect(res.status).toBe(401);
  });
});
