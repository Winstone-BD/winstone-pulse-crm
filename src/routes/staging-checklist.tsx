import { createFileRoute } from "@tanstack/react-router";
import { CheckCircle2, Circle, ClipboardCheck, Copy, Download, History, Loader2, ShieldAlert, Trash2, Upload } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/crm/AppShell";
import { RoleGate } from "@/components/crm/RoleGate";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { checkStagingUrl } from "@/lib/staging-check";
import { parseReport, reportToCsv, reportToJson, type StagingRunReport } from "@/lib/staging-report";
import { checkStagingIsolation } from "@/lib/staging-check.functions";

export const Route = createFileRoute("/staging-checklist")({
  head: () => ({
    meta: [
      { title: "Staging setup checklist — Winstone Pulse" },
      { name: "description", content: "Track staging database isolation, connector approval and readiness before running connector tests." },
      { property: "og:title", content: "Staging setup checklist — Winstone Pulse" },
      { property: "og:description", content: "Readiness checklist for isolated connector testing." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: StagingChecklistPage,
});

const KEY = "winstone-staging-checklist-v1";
type State = {
  url: string;
  isolation: "separate" | "live" | "unknown" | "invalid" | null;
  isolationDetail: string;
  checkedAt: string | null;
  allowListed: boolean;
  approved: boolean;
};
const EMPTY: State = { url: "", isolation: null, isolationDetail: "", checkedAt: null, allowListed: false, approved: false };

function StagingChecklistPage() {
  return (
    <AppShell>
      <RoleGate allow={["authority"]} icon={<ClipboardCheck className="size-7" />} title="Staging setup checklist" description="Executive HQ / IT only — sign in.">
        <Checklist />
      </RoleGate>
    </AppShell>
  );
}

function Step({ done, title, children }: { done: boolean; title: string; children: React.ReactNode }) {
  return (
    <li className="flex gap-3 rounded-lg border border-border bg-card p-4">
      {done ? <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-primary" /> : <Circle className="mt-0.5 size-5 shrink-0 text-muted-foreground" />}
      <div className="min-w-0 flex-1 space-y-2">
        <p className="font-medium">{title}</p>
        {children}
      </div>
    </li>
  );
}

function Checklist() {
  const [s, setS] = useState<State>(EMPTY);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) setS({ ...EMPTY, ...(JSON.parse(raw) as Partial<State>) });
    } catch {
      /* ignore corrupt local state */
    }
  }, []);
  const save = (next: Partial<State>) =>
    setS((prev) => {
      const merged = { ...prev, ...next };
      localStorage.setItem(KEY, JSON.stringify(merged));
      return merged;
    });

  const urlCheck = s.url ? checkStagingUrl(s.url) : null;
  const urlOk = urlCheck?.ok === true;
  const isolated = urlOk && s.isolation === "separate";
  const ready = isolated && s.allowListed && s.approved;
  const host = urlCheck?.ok ? urlCheck.host : "<staging-host>";
  const command = [
    "STAGING_E2E=1 SUPABASE_URL=https://<staging-ref>.supabase.co STAGING_CONFIRM=<staging-ref> \\",
    "SUPABASE_SERVICE_ROLE_KEY=<staging key> STAGING_MCP_TOKEN=<oauth token> \\",
    `STAGING_APP_URL=${urlCheck?.ok ? urlCheck.origin : "https://<staging-host>"} STAGING_APP_ALLOWLIST=${host} \\`,
    "STAGING_MCP_TIMEOUT_MS=15000 \\",
    "bunx vitest run --config vitest.staging.config.ts tests/staging/mcp-tools.staging.ts",
  ].join("\n");

  async function runCheck() {
    setBusy(true);
    try {
      const r = await checkStagingIsolation({ data: { url: s.url } });
      save({ isolation: r.verdict, isolationDetail: r.detail, checkedAt: new Date().toISOString() });
    } catch {
      toast.error("Check failed — sign in again and retry.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4 p-4">
      <header className="space-y-1">
        <h1 className="text-xl font-semibold">Staging setup checklist</h1>
        <p className="text-sm text-muted-foreground">
          Complete every step before running connector tests. Progress is saved on this device only; nothing is written to the CRM.
        </p>
      </header>
      <section aria-label="Readiness" className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ["Address", urlOk],
          ["Separate database", isolated],
          ["Approved list", s.allowListed],
          ["Connector approved", s.approved],
        ].map(([label, done]) => (
          <div key={String(label)} className="rounded-lg border border-border bg-card p-3">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className={`text-sm font-medium ${done ? "text-primary" : "text-muted-foreground"}`}>{done ? "Done" : "Not done"}</p>
          </div>
        ))}
        <div className={`col-span-2 rounded-lg border p-3 sm:col-span-4 ${ready ? "border-primary bg-primary/10" : "border-border bg-muted"}`}>
          <p className="text-sm font-semibold">
            {ready ? "Ready to run connector tests" : `Not ready — ${[urlOk, isolated, s.allowListed, s.approved].filter(Boolean).length} of 4 steps complete`}
          </p>
          {s.isolation === "live" && <p className="text-sm text-destructive">Blocked: the staging copy uses the live database.</p>}
        </div>
      </section>
      <ol className="space-y-3">
        <Step done={urlOk} title="1. Staging app address">
          <Input
            value={s.url}
            placeholder="https://your-staging-copy.lovable.app"
            onChange={(e) => save({ url: e.target.value, isolation: null, isolationDetail: "", checkedAt: null })}
          />
          {urlCheck && !urlCheck.ok && <p className="text-sm text-destructive">{urlCheck.reason}</p>}
        </Step>
        <Step done={isolated} title="2. Database isolation">
          <p className="text-sm text-muted-foreground">Reads the staging app's public sign-in details and confirms it uses a different database from the live CRM.</p>
          <Button size="sm" variant="outline" disabled={!urlOk || busy} onClick={runCheck}>
            {busy && <Loader2 className="size-4 animate-spin" />} Check isolation
          </Button>
          {s.isolation && (
            <p className={`flex items-start gap-1.5 text-sm ${s.isolation === "separate" ? "text-primary" : "text-destructive"}`}>
              {s.isolation !== "separate" && <ShieldAlert className="mt-0.5 size-4 shrink-0" />}
              {s.isolationDetail}
              {s.checkedAt && <span className="text-muted-foreground"> ({new Date(s.checkedAt).toLocaleString()})</span>}
            </p>
          )}
        </Step>
        <Step done={s.allowListed} title="3. Test account on the staging approved list">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={s.allowListed} onChange={(e) => save({ allowListed: e.target.checked })} />
            In the staging copy's IT Console, the test account's email is on the Agent integrations approved list.
          </label>
        </Step>
        <Step done={s.approved} title="4. Connector sign-in approved in staging">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={s.approved} onChange={(e) => save({ approved: e.target.checked })} />
            The test account signed in and approved the connector on the staging approval screen.
          </label>
        </Step>
        <Step done={ready} title="5. Ready to run connector tests">
          {ready ? (
            <>
              <pre className="overflow-x-auto rounded-md bg-muted p-3 text-xs">{command}</pre>
              <Button size="sm" variant="outline" onClick={() => void navigator.clipboard.writeText(command).then(() => toast.success("Copied"))}>
                <Copy className="size-4" /> Copy command
              </Button>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Finish steps 1–4. Step 2 must show a separate database.</p>
          )}
        </Step>
      </ol>
      <Button variant="ghost" size="sm" onClick={() => { localStorage.removeItem(KEY); setS(EMPTY); }}>
        Reset checklist
      </Button>
      <RunHistory />
    </div>
  );
}

const HISTORY_KEY = "winstone-staging-runs-v1";
const MAX_RUNS = 50;

function download(name: string, body: string, type: string) {
  const url = URL.createObjectURL(new Blob([body], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function RunHistory() {
  const [runs, setRuns] = useState<StagingRunReport[]>([]);
  const [open, setOpen] = useState<string | null>(null);
  useEffect(() => {
    try {
      const raw = JSON.parse(localStorage.getItem(HISTORY_KEY) ?? "[]") as unknown[];
      setRuns(raw.map((r) => parseReport(JSON.stringify(r))).filter((r): r is StagingRunReport => !!r));
    } catch {
      /* ignore corrupt history */
    }
  }, []);
  const persist = (next: StagingRunReport[]) => {
    const sorted = [...next].sort((a, b) => b.startedAt.localeCompare(a.startedAt)).slice(0, MAX_RUNS);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(sorted));
    setRuns(sorted);
  };

  async function importFiles(files: FileList | null) {
    if (!files) return;
    let added = 0;
    let bad = 0;
    const next = [...runs];
    for (const f of Array.from(files)) {
      if (f.size > 2_000_000) { bad++; continue; }
      const r = parseReport(await f.text());
      if (!r) { bad++; continue; }
      const i = next.findIndex((x) => x.runId === r.runId);
      if (i >= 0) next[i] = r;
      else next.push(r);
      added++;
    }
    persist(next);
    if (added) toast.success(`Saved ${added} run${added > 1 ? "s" : ""}`);
    if (bad) toast.error(`${bad} file${bad > 1 ? "s were" : " was"} not a staging test report`);
  }

  return (
    <section className="space-y-3 pt-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-lg font-semibold"><History className="size-5" /> Run history</h2>
        <div className="flex flex-wrap gap-2">
          <Button asChild size="sm" variant="outline">
            <label className="cursor-pointer">
              <Upload className="size-4" /> Add report
              <input type="file" accept=".json,application/json" multiple className="sr-only" onChange={(e) => { void importFiles(e.target.files); e.target.value = ""; }} />
            </label>
          </Button>
          <Button size="sm" variant="outline" disabled={!runs.length} onClick={() => download("staging-connector-runs.json", JSON.stringify(runs, null, 2), "application/json")}>
            <Download className="size-4" /> All JSON
          </Button>
          <Button size="sm" variant="outline" disabled={!runs.length} onClick={() => download("staging-connector-runs.csv", reportToCsv(runs), "text/csv")}>
            <Download className="size-4" /> All CSV
          </Button>
        </div>
      </div>
      <p className="text-sm text-muted-foreground">Each test run saves a report file in the staging-reports folder. Add it here to keep its history on this device.</p>
      {runs.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">No test runs saved yet.</p>
      ) : (
        <ul className="space-y-2">
          {runs.map((r) => (
            <li key={r.runId} className="rounded-lg border border-border bg-card p-3">
              <button type="button" className="flex w-full flex-wrap items-center justify-between gap-2 text-left" onClick={() => setOpen(open === r.runId ? null : r.runId)}>
                <span className="min-w-0">
                  <span className="block text-sm font-medium">{new Date(r.startedAt).toLocaleString()}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {r.appHost} · {Math.round((Date.parse(r.finishedAt) - Date.parse(r.startedAt)) / 1000)}s · {r.tools.length} tool{r.tools.length === 1 ? "" : "s"}
                  </span>
                </span>
                <span className={`rounded px-2 py-0.5 text-xs font-semibold ${r.overall === "PASS" ? "bg-primary/15 text-primary" : "bg-destructive/15 text-destructive"}`}>{r.overall}</span>
              </button>
              {open === r.runId && (
                <div className="mt-3 space-y-2">
                  {r.tools.map((t) => (
                    <div key={t.tool} className="text-sm">
                      <p><span className={t.status === "PASS" ? "text-primary" : "text-destructive"}>{t.status}</span> <span className="font-medium">{t.tool}</span> ({t.passed} passed, {t.failed} failed)</p>
                      {t.failures.map((f) => <p key={f} className="pl-4 text-xs text-destructive break-words">x {f}</p>)}
                    </div>
                  ))}
                  <div className="flex flex-wrap gap-2 pt-1">
                    <Button size="sm" variant="outline" onClick={() => download(`${r.runId}.json`, reportToJson(r), "application/json")}><Download className="size-4" /> JSON</Button>
                    <Button size="sm" variant="outline" onClick={() => download(`${r.runId}.csv`, reportToCsv([r]), "text/csv")}><Download className="size-4" /> CSV</Button>
                    <Button size="sm" variant="ghost" onClick={() => persist(runs.filter((x) => x.runId !== r.runId))}><Trash2 className="size-4" /> Remove</Button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
