/** Staging connector test run reports: shared by the test harness (writer) and the in-app history (reader). */
import { safeCsvCell } from "@/lib/csv-safe";

export interface CheckResult {
  tool: string;
  check: string;
  pass: boolean;
  detail?: string;
}
export interface ToolSummary {
  tool: string;
  status: "PASS" | "FAIL";
  passed: number;
  failed: number;
  failures: string[];
}
export interface StagingRunReport {
  version: 1;
  runId: string;
  startedAt: string;
  finishedAt: string;
  appHost: string;
  timeoutMs: number;
  overall: "PASS" | "FAIL";
  tools: ToolSummary[];
  checks: CheckResult[];
}

export function summarize(checks: CheckResult[], listedTools: string[] = []): ToolSummary[] {
  const map = new Map<string, ToolSummary>();
  const get = (tool: string) => {
    let e = map.get(tool);
    if (!e) map.set(tool, (e = { tool, status: "PASS", passed: 0, failed: 0, failures: [] }));
    return e;
  };
  for (const c of checks) {
    const e = get(c.tool);
    if (c.pass) e.passed++;
    else {
      e.failed++;
      e.failures.push(`${c.check}${c.detail ? ` — ${c.detail}` : ""}`);
    }
  }
  for (const t of listedTools) {
    const e = get(t);
    if (e.passed + e.failed === 0) {
      e.failed = 1;
      e.failures.push("no checks ran");
    }
  }
  for (const e of map.values()) e.status = e.failed === 0 ? "PASS" : "FAIL";
  return [...map.values()];
}

export function buildReport(input: Omit<StagingRunReport, "version" | "overall" | "tools"> & { listedTools?: string[] }): StagingRunReport {
  const { listedTools, ...rest } = input;
  const tools = summarize(rest.checks, listedTools);
  return { version: 1, ...rest, tools, overall: tools.length > 0 && tools.every((t) => t.status === "PASS") ? "PASS" : "FAIL" };
}

export function reportToJson(r: StagingRunReport): string {
  return JSON.stringify(r, null, 2);
}

/** One row per check, so a spreadsheet can filter by tool/result. Cells are formula-safe. */
export function reportToCsv(reports: StagingRunReport[]): string {
  const header = ["run_id", "started_at", "finished_at", "app_host", "overall", "tool", "tool_status", "check", "result", "detail"];
  const rows = [header.join(",")];
  for (const r of reports) {
    const status = new Map(r.tools.map((t) => [t.tool, t.status]));
    for (const c of r.checks)
      rows.push(
        [r.runId, r.startedAt, r.finishedAt, r.appHost, r.overall, c.tool, status.get(c.tool) ?? "", c.check, c.pass ? "PASS" : "FAIL", c.detail ?? ""]
          .map(safeCsvCell)
          .join(","),
      );
  }
  return rows.join("\n") + "\n";
}

const isStr = (v: unknown): v is string => typeof v === "string";

/** Validates an imported report file; returns null when it isn't a staging run report. */
export function parseReport(text: string): StagingRunReport | null {
  let v: unknown;
  try {
    v = JSON.parse(text);
  } catch {
    return null;
  }
  const r = v as Partial<StagingRunReport>;
  if (!r || r.version !== 1 || !isStr(r.runId) || !isStr(r.startedAt) || !isStr(r.finishedAt) || !Array.isArray(r.checks)) return null;
  if (Number.isNaN(Date.parse(r.startedAt)) || Number.isNaN(Date.parse(r.finishedAt))) return null;
  const checks: CheckResult[] = [];
  for (const c of r.checks as unknown[]) {
    const x = c as Partial<CheckResult>;
    if (!x || !isStr(x.tool) || !isStr(x.check) || typeof x.pass !== "boolean") return null;
    checks.push({ tool: x.tool.slice(0, 120), check: x.check.slice(0, 200), pass: x.pass, detail: isStr(x.detail) ? x.detail.slice(0, 300) : undefined });
  }
  const listed = Array.isArray(r.tools) ? (r.tools as Partial<ToolSummary>[]).map((t) => t?.tool).filter(isStr) : [];
  return buildReport({
    runId: r.runId.slice(0, 80),
    startedAt: r.startedAt,
    finishedAt: r.finishedAt,
    appHost: isStr(r.appHost) ? r.appHost.slice(0, 200) : "",
    timeoutMs: typeof r.timeoutMs === "number" ? r.timeoutMs : 0,
    checks,
    listedTools: listed,
  });
}
