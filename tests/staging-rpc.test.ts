import { describe, expect, it } from "vitest";

import { buildReport, parseReport, reportToCsv } from "@/lib/staging-report";
import { parseRpc, parseRpcBody } from "./staging/rpc";

const ok = (id: number) => ({ jsonrpc: "2.0", id, result: { tools: [] } });

describe("staging harness: JSON-RPC parsing", () => {
  it("parses a plain JSON success", () => expect(parseRpc(JSON.stringify(ok(3)), 3)).toMatchObject({ kind: "ok", message: { id: 3 } }));
  it("parses an SSE success, ignoring other events", () => {
    const sse = `event: message\ndata: {"jsonrpc":"2.0","method":"notifications/progress"}\n\nevent: message\ndata: ${JSON.stringify(ok(7))}\n\n`;
    expect(parseRpc(sse, 7)).toMatchObject({ kind: "ok", message: { id: 7 } });
  });
  it("parses CRLF SSE and multi-line data", () => {
    const sse = `data: {"jsonrpc":"2.0",\r\ndata: "id":2,"result":{}}\r\n\r\n`;
    expect(parseRpc(sse, 2).kind).toBe("ok");
  });
  it("keeps RPC errors as messages", () => {
    const r = parseRpc(JSON.stringify({ jsonrpc: "2.0", id: 4, error: { code: -32602, message: "Invalid params" } }), 4);
    expect(r).toMatchObject({ kind: "ok", message: { error: { code: -32602 } } });
  });
  it("picks the matching reply from a JSON batch", () => expect(parseRpc(JSON.stringify([ok(1), ok(5)]), 5)).toMatchObject({ kind: "ok", message: { id: 5 } }));
  it("flags response-ID mismatches (JSON and SSE)", () => {
    expect(parseRpc(JSON.stringify(ok(9)), 1).kind).toBe("id-mismatch");
    expect(parseRpc(`data: ${JSON.stringify(ok(9))}\n\n`, 1).kind).toBe("id-mismatch");
    expect(parseRpcBody(JSON.stringify(ok(9)), 1)).toBeNull();
  });
  it("flags malformed payloads without throwing", () => {
    for (const body of ["{not json", "[1,2", "data: {oops\n\n", "<html>502</html>", JSON.stringify({ hello: 1 }), "data:\n\n"])
      expect(parseRpc(body, 1).kind).toBe("malformed");
  });
  it("flags empty bodies", () => expect(parseRpc("  ", 1).kind).toBe("empty"));
});

describe("staging run reports", () => {
  const base = { runId: "STAGING-1", startedAt: "2026-10-13T04:00:00Z", finishedAt: "2026-10-13T04:01:00Z", appHost: "s.lovable.app", timeoutMs: 15000 };
  it("summarizes per tool and marks listed tools with no checks as FAIL", () => {
    const r = buildReport({ ...base, checks: [{ tool: "a", check: "x", pass: true }, { tool: "b", check: "y", pass: false, detail: "timed out" }], listedTools: ["a", "b", "c"] });
    expect(r.tools.map((t) => [t.tool, t.status])).toEqual([["a", "PASS"], ["b", "FAIL"], ["c", "FAIL"]]);
    expect(r.overall).toBe("FAIL");
  });
  it("round-trips through import validation and rejects junk", () => {
    const r = buildReport({ ...base, checks: [{ tool: "a", check: "x", pass: true }] });
    expect(parseReport(JSON.stringify(r))?.overall).toBe("PASS");
    expect(parseReport("{}")).toBeNull();
    expect(parseReport(JSON.stringify({ ...r, checks: [{ tool: 1 }] }))).toBeNull();
  });
  it("writes formula-safe CSV", () => {
    const csv = reportToCsv([buildReport({ ...base, checks: [{ tool: "a", check: "=HYPERLINK()", pass: false }] })]);
    expect(csv.split("\n")[0]).toContain("run_id");
    expect(csv).toContain("'=HYPERLINK()");
  });
});
