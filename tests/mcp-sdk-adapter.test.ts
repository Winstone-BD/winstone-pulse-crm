// Compatibility test: the SDK adapter prototype advertises exactly what the
// Agent integrations panel manifest advertises, and enforces the same auth.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import mcp from "@/lib/mcp/index";
import { buildSdkServer } from "@/lib/mcp/prototype/sdk-adapter";

const manifest = JSON.parse(readFileSync(".lovable/mcp/manifest.json", "utf8"));
const def = mcp as any;

async function connect(authed: boolean, email?: string) {
  const server = buildSdkServer(def, { isAuthenticated: () => authed, getUserEmail: () => email });
  const [a, b] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "compat-test", version: "0" });
  await Promise.all([server.connect(a), client.connect(b)]);
  return client;
}

describe("SDK adapter vs panel manifest", () => {
  it("lists the same tools, titles, annotations and input fields", async () => {
    const { tools } = await (await connect(false)).listTools();
    const want = manifest.mcp.tools;
    expect(tools.map((t) => t.name).sort()).toEqual(want.map((t: any) => t.name).sort());
    for (const w of want) {
      const t = tools.find((x) => x.name === w.name)!;
      expect(t.title).toBe(w.title);
      expect(t.description).toBe(w.description);
      expect(t.annotations).toMatchObject(w.annotations);
      expect(Object.keys(t.inputSchema.properties ?? {}).sort()).toEqual(Object.keys(w.inputSchema.properties).sort());
    }
  });
  it("refuses signed-out callers on every tool", async () => {
    const c = await connect(false);
    for (const w of manifest.mcp.tools) {
      const r: any = await c.callTool({ name: w.name, arguments: { limit: 1 } });
      expect(r.isError).toBe(true);
    }
  });
  it("rejects invalid input", async () => {
    const r: any = await (await connect(true, "x@y.z")).callTool({ name: "list_public_property_facts", arguments: { limit: 0 } });
    expect(r.isError).toBe(true);
  });
});
