/** JSON-RPC reply parsing for the staging harness. Pure and side-effect free so it can be unit-tested. */
export interface RpcMessage {
  jsonrpc?: string;
  id?: number | string | null;
  result?: { isError?: boolean; tools?: unknown[]; content?: { type: string; text?: string }[] };
  error?: { code: number; message: string };
}

export type ParseOutcome =
  | { kind: "ok"; message: RpcMessage }
  | { kind: "malformed"; detail: string }
  | { kind: "id-mismatch"; detail: string }
  | { kind: "empty"; detail: string };

function isMessage(v: unknown): v is RpcMessage {
  return !!v && typeof v === "object" && !Array.isArray(v) && ("result" in v || "error" in v);
}

function pick(candidates: unknown[], id: number): ParseOutcome {
  const messages = candidates.filter(isMessage);
  if (messages.length === 0) return { kind: "malformed", detail: "no JSON-RPC result or error object" };
  const match = messages.find((m) => m.id === id);
  if (match) return { kind: "ok", message: match };
  return { kind: "id-mismatch", detail: `expected id ${id}, got ${messages.map((m) => JSON.stringify(m.id)).join(", ")}` };
}

/** Parses a plain JSON body (object or batch) or an SSE stream, and only accepts the reply whose id matches. Never throws. */
export function parseRpc(raw: string, id: number): ParseOutcome {
  const body = raw.trim();
  if (!body) return { kind: "empty", detail: "empty response body" };
  if (body.startsWith("{") || body.startsWith("[")) {
    try {
      const v: unknown = JSON.parse(body);
      return pick(Array.isArray(v) ? v : [v], id);
    } catch {
      return { kind: "malformed", detail: "invalid JSON" };
    }
  }
  const events = body.split(/\r?\n\r?\n/);
  const parsed: unknown[] = [];
  let bad = 0;
  for (const evt of events) {
    const data = evt
      .split(/\r?\n/)
      .filter((l) => l.startsWith("data:"))
      .map((l) => l.slice(5).replace(/^ /, ""))
      .join("\n");
    if (!data) continue;
    try {
      parsed.push(JSON.parse(data));
    } catch {
      bad++;
    }
  }
  if (parsed.length === 0) return { kind: "malformed", detail: bad ? "SSE data was not valid JSON" : "no SSE data events" };
  return pick(parsed, id);
}

/** Back-compat helper: the matching message, or null for any non-ok outcome. */
export function parseRpcBody(raw: string, id: number): RpcMessage | null {
  const r = parseRpc(raw, id);
  return r.kind === "ok" ? r.message : null;
}
