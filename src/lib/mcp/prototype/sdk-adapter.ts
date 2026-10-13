// PROTOTYPE — not mounted at /mcp. Re-hosts the existing defineMcp tool
// definitions on the official @modelcontextprotocol/sdk (>=1.31) so the same
// tools, schemas and handlers could run without the mcp-js runtime, while the
// Agent integrations panel keeps reading the mcp-js generated manifest.
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

type AnyTool = {
  name: string; title?: string; description?: string;
  inputSchema: Record<string, any>; annotations?: Record<string, boolean>;
  handler: (input: any, ctx: any) => unknown;
};
type Caller = { isAuthenticated: () => boolean; getUserEmail: () => string | undefined };

export function buildSdkServer(def: { name: string; title?: string; version: string; tools: AnyTool[] }, caller: Caller) {
  const server = new McpServer({ name: def.name, title: def.title, version: def.version });
  for (const t of def.tools) {
    server.registerTool(
      t.name,
      { title: t.title, description: t.description, inputSchema: t.inputSchema, annotations: t.annotations },
      (async (input: unknown, extra: { signal: AbortSignal }) => {
        try {
          return (await t.handler(input, { ...caller, signal: extra.signal })) as any;
        } catch (e) {
          return { isError: true, content: [{ type: "text", text: (e as Error).message }] };
        }
      }) as any,
    );
  }
  return server;
}
