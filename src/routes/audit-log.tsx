import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { DatabaseBackup, Download, History, Loader2, RotateCcw, ShieldAlert, Sparkles } from "lucide-react";
import { listSecurityAudit, type SecurityGroup } from "@/lib/security-audit.functions";
import { useState } from "react";
import { toast } from "sonner";

import { AiTeamSummary } from "@/components/crm/AiTeamSummary";
import { AppShell } from "@/components/crm/AppShell";
import { PageHeader } from "@/components/crm/PageHeader";
import { RoleGate } from "@/components/crm/RoleGate";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  diffCrmRecord, downloadCrmBackup, listCrmBackups, listRecordAudit, restoreCrmRecord, runCrmBackupNow,
} from "@/lib/crm-backup.functions";
import { useAdminToken } from "@/lib/local-session";

export const Route = createFileRoute("/audit-log")({
  head: () => ({
    meta: [
      { title: "Audit log & backups — Winstone Pulse" },
      { name: "description", content: "Who created, edited or archived each CRM record, plus daily backups and safe single-record restore." },
      { property: "og:title", content: "Audit log & backups — Winstone Pulse" },
      { property: "og:description", content: "CRM change history, daily backups and safe restore." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Page,
});

const TABLES: Record<string, string> = {
  leads: "Lead", call_reports: "Call report", follow_up_events: "Follow-up",
  bookings: "Booking", site_visits: "Site visit", profiles: "Staff profile", crm_backups: "Backup",
};
const ACTION_STYLE: Record<string, string> = {
  created: "bg-success/15 text-success", edited: "bg-info/15 text-info",
  archived: "bg-warning/15 text-warning", restored: "bg-primary/15 text-primary",
};
const dhaka = (ms: number) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dhaka" }).format(new Date(ms));
const when = (iso: string) => new Date(iso).toLocaleString("en-GB", { timeZone: "Asia/Dhaka", dateStyle: "medium", timeStyle: "short" });
const short = (v: unknown) => { const s = v == null ? "—" : typeof v === "string" ? v : JSON.stringify(v); return s.length > 60 ? `${s.slice(0, 60)}…` : s; };
const csv = (v: unknown) => { const s = String(v ?? ""); return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };

function Page() {
  const [tab, setTab] = useState<"log" | "security" | "backups" | "ai">("log");
  return (
    <AppShell>
      <RoleGate surface="hq" allow={["authority"]} icon={<History className="size-7" />}
        title="Audit log & backups" description="Only HQ / IT can view the full change history and backups. Master PIN required.">
        <div className="space-y-4">
          <PageHeader title="Audit log & backups" description="Every create, edit and archive — who and when. Entries are permanent." />
          <div className="flex flex-wrap gap-2">
            <Button variant={tab === "log" ? "default" : "outline"} size="sm" onClick={() => setTab("log")}><History className="size-4" /> Audit log</Button>
            <Button variant={tab === "security" ? "default" : "outline"} size="sm" onClick={() => setTab("security")}><ShieldAlert className="size-4" /> Security</Button>
            <Button variant={tab === "backups" ? "default" : "outline"} size="sm" onClick={() => setTab("backups")}><DatabaseBackup className="size-4" /> Backups</Button>
            <Button variant={tab === "ai" ? "default" : "outline"} size="sm" onClick={() => setTab("ai")}><Sparkles className="size-4" /> AI</Button>
          </div>
          {tab === "log" ? <AuditLog /> : tab === "security" ? <SecurityLog /> : tab === "backups" ? <Backups /> : <AiTeamSummary />}
        </div>
      </RoleGate>
    </AppShell>
  );
}

function AuditLog() {
  const adminToken = useAdminToken();
  const list = useServerFn(listRecordAudit);
  const [from, setFrom] = useState(dhaka(Date.now() - 6 * 86_400_000));
  const [to, setTo] = useState(dhaka(Date.now()));
  const [table, setTable] = useState("");
  const [action, setAction] = useState("");
  const [recordId, setRecordId] = useState("");
  const [page, setPage] = useState(0);
  const q = useQuery({
    queryKey: ["record-audit", from, to, table, action, recordId.trim(), page, adminToken ? "pin" : "s"],
    queryFn: () => list({ data: { adminToken, from, to, table: table || null, action: (action || null) as never, recordId: recordId.trim() || null, page } }),
    placeholderData: (p) => p,
  });
  const rows = q.data?.rows ?? [];
  const who = (id: string | null) => (id ? q.data?.names[id] || "Staff" : "System");

  const exportCsv = () => {
    const lines = [["When (Dhaka)", "Who", "Record type", "Record", "Action", "Changes"].join(",")];
    for (const r of rows) lines.push([when(r.at), who(r.actor_id), TABLES[r.table_name] ?? r.table_name, r.record_id, r.action, JSON.stringify(r.changes)].map(csv).join(","));
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([lines.join("\n")], { type: "text/csv" }));
    a.download = `audit-log-${from}-to-${to}.csv`;
    a.click();
  };

  return (
    <section className="space-y-3 rounded-xl border border-border bg-card p-4">
      <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
        <Input type="date" aria-label="From" value={from} onChange={(e) => { setFrom(e.target.value); setPage(0); }} />
        <Input type="date" aria-label="To" value={to} onChange={(e) => { setTo(e.target.value); setPage(0); }} />
        <select aria-label="Record type" className="h-9 rounded-md border border-input bg-background px-2 text-sm" value={table} onChange={(e) => { setTable(e.target.value); setPage(0); }}>
          <option value="">All records</option>
          {Object.entries(TABLES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select aria-label="Action" className="h-9 rounded-md border border-input bg-background px-2 text-sm" value={action} onChange={(e) => { setAction(e.target.value); setPage(0); }}>
          <option value="">All actions</option>
          {["created", "edited", "archived", "restored"].map((a) => <option key={a} value={a}>{a.charAt(0).toUpperCase() + a.slice(1)}</option>)}
        </select>
        <Input placeholder="Record ID" aria-label="Record ID" value={recordId} onChange={(e) => { setRecordId(e.target.value); setPage(0); }} />
        <Button variant="outline" onClick={exportCsv} disabled={!rows.length}><Download className="size-4" /> CSV</Button>
      </div>

      {q.isPending ? (
        <p className="flex items-center gap-2 py-8 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" /> Loading history…</p>
      ) : q.isError ? (
        <p role="alert" className="py-8 text-sm text-destructive">Couldn't load the audit log. {(q.error as Error).message}</p>
      ) : !rows.length ? (
        <p className="py-8 text-center text-sm text-muted-foreground">No changes in this period. New changes are recorded from today onward.</p>
      ) : (
        <ul className="divide-y divide-border">
          {rows.map((r) => (
            <li key={r.id} className="grid gap-1 py-2.5 text-sm md:grid-cols-[10rem_9rem_8rem_1fr]">
              <span className="text-muted-foreground">{when(r.at)}</span>
              <span className="font-semibold">{who(r.actor_id)}</span>
              <span><span className={`rounded px-2 py-0.5 text-xs font-bold uppercase ${ACTION_STYLE[r.action] ?? "bg-muted"}`}>{r.action}</span></span>
              <div className="min-w-0">
                <p className="truncate"><span className="font-medium">{TABLES[r.table_name] ?? r.table_name}</span> <span className="font-mono text-xs text-muted-foreground">{r.record_id}</span></p>
                {r.action === "edited" || r.action === "archived" ? (
                  <ul className="mt-0.5 space-y-0.5 text-xs text-muted-foreground">
                    {Object.entries(r.changes as Record<string, { from: unknown; to: unknown }>).slice(0, 6).map(([k, v]) => (
                      <li key={k} className="truncate"><span className="font-semibold text-foreground">{k}</span>: {short(v?.from)} → {short(v?.to)}</li>
                    ))}
                  </ul>
                ) : r.action === "restored" || r.table_name === "crm_backups" ? (
                  <p className="text-xs text-muted-foreground">{short(r.changes)}</p>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
      <div className="flex justify-between">
        <Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>Newer</Button>
        <Button size="sm" variant="outline" disabled={rows.length < 100} onClick={() => setPage((p) => p + 1)}>Older</Button>
      </div>
    </section>
  );
}

const GROUP_LABEL: Record<SecurityGroup, string> = {
  access: "Sign-ins & PIN attempts", accounts: "Accounts & roles", devices: "Devices & SIMs",
  pins: "PINs & floor lock", billing: "Billing & unlocks", data: "Exports & settings",
};
const RISKY = new Set(["coordinator_pin_failed", "agent_login_failed", "agent_login_locked", "pin_revealed", "role_changed", "device_revoked", "migration_export", "unlock_approved"]);

function SecurityLog() {
  const adminToken = useAdminToken();
  const list = useServerFn(listSecurityAudit);
  const [from, setFrom] = useState(dhaka(Date.now() - 6 * 86_400_000));
  const [to, setTo] = useState(dhaka(Date.now()));
  const [group, setGroup] = useState<SecurityGroup | "">("");
  const [page, setPage] = useState(0);
  const q = useQuery({
    queryKey: ["security-audit", from, to, group, page, adminToken ? "pin" : "s"],
    queryFn: () => list({ data: { adminToken, from, to, group: group || null, page } }),
    placeholderData: (p) => p,
  });
  const rows = q.data?.rows ?? [];
  const exportCsv = () => {
    const lines = [["When (Dhaka)", "Who", "Action", "Target", "Details"].join(",")];
    for (const r of rows) lines.push([when(r.created_at), r.actor_label ?? "System", r.action, `${r.entity_type}${r.entity_id ? ` ${r.entity_id}` : ""}`, JSON.stringify(r.metadata)].map(csv).join(","));
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob(["\ufeff" + lines.join("\n")], { type: "text/csv" }));
    a.download = `security-log-${from}-to-${to}.csv`;
    a.click();
  };
  return (
    <section className="space-y-3 rounded-xl border border-border bg-card p-4">
      <p className="text-sm text-muted-foreground">Sign-ins, failed PIN attempts, role and account changes, device changes, PIN reveals, billing unlocks and data exports. Entries are permanent.</p>
      <div className="grid gap-2 sm:grid-cols-4">
        <Input type="date" aria-label="From" value={from} onChange={(e) => { setFrom(e.target.value); setPage(0); }} />
        <Input type="date" aria-label="To" value={to} onChange={(e) => { setTo(e.target.value); setPage(0); }} />
        <select aria-label="Category" className="h-9 rounded-md border border-input bg-background px-2 text-sm" value={group} onChange={(e) => { setGroup(e.target.value as SecurityGroup | ""); setPage(0); }}>
          <option value="">All categories</option>
          {(Object.keys(GROUP_LABEL) as SecurityGroup[]).map((g) => <option key={g} value={g}>{GROUP_LABEL[g]}</option>)}
        </select>
        <Button variant="outline" onClick={exportCsv} disabled={!rows.length}><Download className="size-4" /> CSV</Button>
      </div>
      {q.isPending ? (
        <p className="flex items-center gap-2 py-8 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" /> Loading security log…</p>
      ) : q.isError ? (
        <p role="alert" className="py-8 text-sm text-destructive">Couldn't load the security log. {(q.error as Error).message}</p>
      ) : !rows.length ? (
        <p className="py-8 text-center text-sm text-muted-foreground">No security actions in this period.</p>
      ) : (
        <ul className="divide-y divide-border">
          {rows.map((r) => (
            <li key={r.id} className="grid gap-1 py-2.5 text-sm md:grid-cols-[10rem_9rem_14rem_1fr]">
              <span className="text-muted-foreground">{when(r.created_at)}</span>
              <span className="font-semibold">{r.actor_label || "System"}</span>
              <span><span className={`rounded px-2 py-0.5 text-xs font-bold uppercase ${RISKY.has(r.action) ? "bg-destructive/15 text-destructive" : "bg-muted"}`}>{r.action.replace(/_/g, " ")}</span></span>
              <p className="min-w-0 truncate text-xs text-muted-foreground"><span className="font-medium text-foreground">{r.entity_type}</span>{r.entity_id ? ` ${r.entity_id}` : ""} · {short(r.metadata)}</p>
            </li>
          ))}
        </ul>
      )}
      <div className="flex justify-between">
        <Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>Newer</Button>
        <Button size="sm" variant="outline" disabled={rows.length < 100} onClick={() => setPage((p) => p + 1)}>Older</Button>
      </div>
    </section>
  );
}

function Backups() {
  const adminToken = useAdminToken();
  const qc = useQueryClient();
  const list = useServerFn(listCrmBackups);
  const runNow = useServerFn(runCrmBackupNow);
  const download = useServerFn(downloadCrmBackup);
  const q = useQuery({ queryKey: ["crm-backups", adminToken ? "pin" : "s"], queryFn: () => list({ data: { adminToken } }) });
  const make = useMutation({
    mutationFn: () => runNow({ data: { adminToken } }),
    onSuccess: (r) => { toast.success(r.skipped ? "Today's backup already exists" : "Backup saved"); void qc.invalidateQueries({ queryKey: ["crm-backups"] }); },
    onError: (e: Error) => toast.error(e.message),
  });
  const get = useMutation({
    mutationFn: (date: string) => download({ data: { adminToken, date } }),
    onSuccess: (r) => { window.location.href = r.url; },
    onError: (e: Error) => toast.error(e.message),
  });
  const backups = q.data?.backups ?? [];

  return (
    <div className="space-y-4">
      <section className="space-y-3 rounded-xl border border-border bg-card p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="font-bold">Daily backups</h2>
            <p className="text-xs text-muted-foreground">Saved automatically every night at 11:30 PM Dhaka · last 30 days kept · each download is logged.</p>
          </div>
          <Button onClick={() => make.mutate()} disabled={make.isPending}>
            {make.isPending ? <Loader2 className="size-4 animate-spin" /> : <DatabaseBackup className="size-4" />} Back up now
          </Button>
        </div>
        {q.isPending ? (
          <p className="flex items-center gap-2 py-6 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" /> Loading backups…</p>
        ) : q.isError ? (
          <p role="alert" className="text-sm text-destructive">{(q.error as Error).message}</p>
        ) : !backups.length ? (
          <p className="py-6 text-center text-sm text-muted-foreground">No backups yet. Press "Back up now" or wait for tonight's run.</p>
        ) : (
          <ul className="divide-y divide-border">
            {backups.map((b) => {
              const counts = b.counts as Record<string, number>;
              return (
                <li key={b.backup_date} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
                  <div>
                    <p className="font-semibold">{b.backup_date} <span className={`ml-1 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${b.status === "done" ? "bg-success/15 text-success" : b.status === "failed" ? "bg-destructive/15 text-destructive" : "bg-warning/15 text-warning"}`}>{b.status}</span></p>
                    <p className="text-xs text-muted-foreground">{Object.entries(counts).map(([k, v]) => `${TABLES[k] ?? k}: ${v.toLocaleString()}`).join(" · ") || b.error}</p>
                  </div>
                  <Button size="sm" variant="outline" disabled={b.status !== "done" || get.isPending} onClick={() => get.mutate(b.backup_date)}>
                    <Download className="size-4" /> Download
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </section>
      <RestoreRecord dates={backups.filter((b) => b.status === "done").map((b) => b.backup_date)} />
      <p className="rounded-xl border border-border bg-card p-4 text-xs text-muted-foreground">
        Full database rollback is not available inside the CRM: it would erase every agent's work after the backup time. For an emergency, contact Lovable support; your daily downloads are the safety copy.
      </p>
    </div>
  );
}

function RestoreRecord({ dates }: { dates: string[] }) {
  const adminToken = useAdminToken();
  const diff = useServerFn(diffCrmRecord);
  const restore = useServerFn(restoreCrmRecord);
  const [date, setDate] = useState("");
  const [table, setTable] = useState<"leads" | "call_reports">("leads");
  const [id, setId] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const d = useMutation({
    mutationFn: () => diff({ data: { adminToken, date: date || dates[0], table, id: id.trim() } }),
    onSuccess: () => setPicked([]),
    onError: (e: Error) => toast.error(e.message),
  });
  const r = useMutation({
    mutationFn: () => restore({ data: { adminToken, date: date || dates[0], table, id: id.trim(), fields: picked } }),
    onSuccess: (res) => { toast.success(`Restored: ${res.restored.join(", ")}`); d.mutate(); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <section className="space-y-3 rounded-xl border border-border bg-card p-4">
      <div>
        <h2 className="font-bold">Restore one record</h2>
        <p className="text-xs text-muted-foreground">Compare a lead or call report with a backup and bring back only the fields you pick. Nothing is deleted; assignment and history never change.</p>
      </div>
      <div className="grid gap-2 sm:grid-cols-4">
        <select aria-label="Backup date" className="h-9 rounded-md border border-input bg-background px-2 text-sm" value={date || dates[0] || ""} onChange={(e) => setDate(e.target.value)}>
          {dates.length ? dates.map((x) => <option key={x} value={x}>{x}</option>) : <option value="">No backups yet</option>}
        </select>
        <select aria-label="Record type" className="h-9 rounded-md border border-input bg-background px-2 text-sm" value={table} onChange={(e) => setTable(e.target.value as never)}>
          <option value="leads">Lead</option><option value="call_reports">Call report</option>
        </select>
        <Input placeholder="Record ID" aria-label="Record ID to restore" value={id} onChange={(e) => setId(e.target.value)} />
        <Button variant="outline" disabled={!dates.length || id.trim().length < 36 || d.isPending} onClick={() => d.mutate()}>
          {d.isPending ? <Loader2 className="size-4 animate-spin" /> : null} Compare
        </Button>
      </div>
      {d.data ? (!d.data.found || !d.data.exists ? (
        <p className="text-sm text-warning">{!d.data.found ? "This record isn't in that backup." : "This record no longer exists."}</p>
      ) : !d.data.fields.length ? (
        <p className="text-sm text-success">No differences — the record matches the backup.</p>
      ) : (
        <div className="space-y-2">
          <div className="table-scroll">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-xs text-muted-foreground"><th className="p-1.5" /><th className="p-1.5">Field</th><th className="p-1.5">Backup</th><th className="p-1.5">Today</th></tr></thead>
              <tbody>
                {d.data.fields.map((f) => (
                  <tr key={f.field} className="border-t border-border">
                    <td className="p-1.5">
                      <input type="checkbox" aria-label={`Restore ${f.field}`} disabled={!f.restorable} checked={picked.includes(f.field)}
                        onChange={(e) => setPicked((p) => (e.target.checked ? [...p, f.field] : p.filter((x) => x !== f.field)))} />
                    </td>
                    <td className="p-1.5 font-medium">{f.field}{!f.restorable && <span className="ml-1 text-[10px] text-muted-foreground">(locked)</span>}</td>
                    <td className="p-1.5 text-muted-foreground">{short(f.backup)}</td>
                    <td className="p-1.5">{short(f.current)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Button disabled={!picked.length || r.isPending} onClick={() => r.mutate()}>
            {r.isPending ? <Loader2 className="size-4 animate-spin" /> : <RotateCcw className="size-4" />} Restore {picked.length || ""} field{picked.length === 1 ? "" : "s"}
          </Button>
        </div>
      )) : null}
    </section>
  );
}
