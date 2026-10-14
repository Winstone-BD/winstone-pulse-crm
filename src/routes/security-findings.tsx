import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, ShieldAlert } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/crm/AppShell";
import { PageHeader } from "@/components/crm/PageHeader";
import { RoleGate } from "@/components/crm/RoleGate";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAdminToken } from "@/lib/local-session";
import { addScanReport, listSecurityFindings, updateFinding } from "@/lib/security-findings.functions";

export const Route = createFileRoute("/security-findings")({
  head: () => ({
    meta: [
      { title: "Security findings — Winstone Pulse" },
      { name: "description", content: "Manually recorded scanner reports with new-finding flags for HQ / IT." },
      { property: "og:title", content: "Security findings — Winstone Pulse" },
      { property: "og:description", content: "Track scanner reports and newly entered security findings." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Page,
});

const when = (iso: string) => new Date(iso).toLocaleString("en-GB", { timeZone: "Asia/Dhaka", dateStyle: "medium", timeStyle: "short" });
const LEVEL: Record<string, string> = { error: "bg-destructive/15 text-destructive", warn: "bg-warning/15 text-warning", info: "bg-info/15 text-info" };

function Page() {
  return (
    <AppShell>
      <RoleGate surface="hq" allow={["authority"]} icon={<ShieldAlert className="size-7" />}
        title="Security findings" description="Only HQ / IT can view and record scanner reports.">
        <Dashboard />
      </RoleGate>
    </AppShell>
  );
}

function Dashboard() {
  const adminToken = useAdminToken();
  const qc = useQueryClient();
  const list = useServerFn(listSecurityFindings);
  const add = useServerFn(addScanReport);
  const upd = useServerFn(updateFinding);
  const q = useQuery({ queryKey: ["security-findings"], queryFn: () => list({ data: { adminToken } }) });

  const [scanner, setScanner] = useState("");
  const [scannedAt, setScannedAt] = useState(() => new Date().toISOString().slice(0, 16));
  const [status, setStatus] = useState<"complete" | "incomplete" | "failed">("complete");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState("");
  const [fScanner, setFScanner] = useState("all");
  const [fLevel, setFLevel] = useState("all");
  const [fStatus, setFStatus] = useState("all");
  const [fNew, setFNew] = useState(false);

  const save = useMutation({
    mutationFn: () => {
      const findings = lines.split("\n").map((l) => l.trim()).filter(Boolean).map((l) => {
        const [level, key, ...rest] = l.split("|").map((s) => s.trim());
        const lv = (["error", "warn", "info"].includes(level ?? "") ? level : "warn") as "error" | "warn" | "info";
        return { level: lv, finding_key: key || l.slice(0, 200), title: rest.join(" | ") || key || l };
      });
      return add({ data: { adminToken, scanner, scanned_at: new Date(scannedAt).toISOString(), status, notes, findings } });
    },
    onSuccess: (r) => {
      toast.success(r.newCount ? `Report saved — ${r.newCount} new finding(s) flagged` : "Report saved — no new findings");
      setScanner(""); setNotes(""); setLines("");
      qc.invalidateQueries({ queryKey: ["security-findings"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const act = useMutation({
    mutationFn: (v: { id: string; status?: "open" | "fixed" | "ignored"; acknowledge?: boolean }) => upd({ data: { adminToken, ...v } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["security-findings"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const reports = q.data?.reports ?? [];
  const findings = q.data?.findings ?? [];
  const scannerOf = new Map(reports.map((r) => [r.id, r.scanner]));
  // Counts are per unique finding ID (latest entry wins); history keeps every entry.
  const latest = new Map<string, (typeof findings)[number]>();
  for (const f of findings) if (!latest.has(f.finding_key)) latest.set(f.finding_key, f);
  const open = [...latest.values()].filter((f) => f.status === "open");
  const fresh = findings.filter((f) => f.is_new && f.status === "open");
  const scanners = [...new Set(reports.map((r) => r.scanner))].sort();
  const shown = findings.filter((f) =>
    (fScanner === "all" || scannerOf.get(f.report_id) === fScanner) &&
    (fLevel === "all" || f.level === fLevel) &&
    (fStatus === "all" || f.status === fStatus) &&
    (!fNew || (f.is_new && f.status === "open")));
  const sel = "h-9 rounded-md border border-input bg-background px-2 text-sm";
  const latestByScanner = Object.values(
    reports.reduce<Record<string, (typeof reports)[number]>>((a, r) => { if (!a[r.scanner]) a[r.scanner] = r; return a; }, {}),
  );

  return (
    <div className="space-y-4">
      <PageHeader title="Security findings" description="Record each scanner report by hand. Findings never seen before are flagged NEW." />

      <div className="grid gap-3 sm:grid-cols-4">
        {[["New", fresh.length], ["Open (unique)", open.length], ["Critical open", open.filter((f) => f.level === "error").length], ["Reports", reports.length]].map(([l, v]) => (
          <div key={l as string} className="rounded-lg border border-border bg-card p-3">
            <div className="text-xs text-muted-foreground">{l}</div>
            <div className="text-2xl font-semibold text-foreground">{v}</div>
          </div>
        ))}
      </div>

      {fresh.length > 0 && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-foreground">
          {fresh.length} newly entered finding(s) need review.
        </div>
      )}

      <section className="rounded-lg border border-border bg-card p-4 space-y-3">
        <h2 className="font-semibold text-foreground">Scanner status</h2>
        {latestByScanner.length === 0 ? <p className="text-sm text-muted-foreground">No reports recorded yet.</p> : (
          <ul className="space-y-1 text-sm">
            {latestByScanner.map((r) => (
              <li key={r.id} className="flex flex-wrap justify-between gap-2">
                <span className="text-foreground">{r.scanner}</span>
                <span className={r.status === "complete" ? "text-success" : "text-warning"}>{r.status} · {when(r.scanned_at)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-lg border border-border bg-card p-4 space-y-3">
        <h2 className="font-semibold text-foreground">Add scanner report</h2>
        <div className="grid gap-2 sm:grid-cols-3">
          <Input placeholder="Scanner name" value={scanner} onChange={(e) => setScanner(e.target.value)} />
          <Input type="datetime-local" value={scannedAt} onChange={(e) => setScannedAt(e.target.value)} />
          <select className="h-10 rounded-md border border-input bg-background px-3 text-sm" value={status} onChange={(e) => setStatus(e.target.value as typeof status)}>
            <option value="complete">Complete</option><option value="incomplete">Incomplete</option><option value="failed">Failed</option>
          </select>
        </div>
        <Input placeholder="Notes (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} />
        <textarea className="min-h-28 w-full rounded-md border border-input bg-background p-2 text-sm"
          placeholder={"One finding per line: level | finding id | title\nwarn | lov_finding_123 | Bucket readable by any user"}
          value={lines} onChange={(e) => setLines(e.target.value)} />
        <Button disabled={!scanner.trim() || save.isPending} onClick={() => save.mutate()}>
          {save.isPending && <Loader2 className="size-4 animate-spin" />} Save report
        </Button>
      </section>

      <section className="rounded-lg border border-border bg-card p-4 space-y-2">
        <h2 className="font-semibold text-foreground">Findings</h2>
        <div className="flex flex-wrap items-center gap-2">
          <select aria-label="Scanner" className={sel} value={fScanner} onChange={(e) => setFScanner(e.target.value)}>
            <option value="all">All scanners</option>{scanners.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <select aria-label="Severity" className={sel} value={fLevel} onChange={(e) => setFLevel(e.target.value)}>
            <option value="all">All severities</option><option value="error">Error</option><option value="warn">Warning</option><option value="info">Info</option>
          </select>
          <select aria-label="Status" className={sel} value={fStatus} onChange={(e) => setFStatus(e.target.value)}>
            <option value="all">All statuses</option><option value="open">Open</option><option value="fixed">Fixed</option><option value="ignored">Ignored</option>
          </select>
          <label className="flex items-center gap-1.5 text-sm text-foreground">
            <input type="checkbox" checked={fNew} onChange={(e) => setFNew(e.target.checked)} /> New only
          </label>
          <span className="text-xs text-muted-foreground">{shown.length} of {findings.length}</span>
        </div>
        {q.isLoading ? <Loader2 className="size-5 animate-spin" /> : q.error ? (
          <p className="text-sm text-destructive">{(q.error as Error).message}</p>
        ) : findings.length === 0 ? <p className="text-sm text-muted-foreground">No findings recorded.</p> : shown.length === 0 ? <p className="text-sm text-muted-foreground">No findings match these filters.</p> : (
          <ul className="divide-y divide-border">
            {shown.map((f) => (
              <li key={f.id} className="py-2 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded px-1.5 py-0.5 text-xs ${LEVEL[f.level]}`}>{f.level}</span>
                    {f.is_new && f.status === "open" && <span className="rounded bg-primary/15 px-1.5 py-0.5 text-xs text-primary">NEW</span>}
                    <span className="text-xs text-muted-foreground">{f.status}</span>
                  </div>
                  <div className="text-sm text-foreground break-words">{f.title}</div>
                  <div className="text-xs text-muted-foreground break-all">{f.finding_key} · {when(f.created_at)} · {f.entered_by}</div>
                </div>
                <div className="flex gap-1">
                  {f.is_new && <Button size="sm" variant="outline" onClick={() => act.mutate({ id: f.id, acknowledge: true })}>Seen</Button>}
                  {f.status !== "fixed" && <Button size="sm" variant="outline" onClick={() => act.mutate({ id: f.id, status: "fixed", acknowledge: true })}>Fixed</Button>}
                  {f.status !== "open" && <Button size="sm" variant="ghost" onClick={() => act.mutate({ id: f.id, status: "open" })}>Reopen</Button>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
