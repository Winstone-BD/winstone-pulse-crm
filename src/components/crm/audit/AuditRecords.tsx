import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Archive, FileDown, FileText } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { addRemediationEvent, getAuditRecords, persistAuditFindings, REMEDIATION_ACTIONS } from "@/lib/audit-findings.functions";
import { itemNumber, itemTitle, type AuditItem } from "@/lib/audit-report-view";
import { AUDIT_COMMIT, AUDIT_DATE, DOC_VERSION } from "@/lib/handover-docs";
import { useAdminToken } from "@/lib/local-session";

export type RemediationEvent = { id: string; finding_key: string; action: string; note: string; actor_name: string; actor_scope: string; created_at: string };

export const ACTION_LABEL: Record<string, string> = {
  noted: "Noted", in_progress: "In progress", fixed: "Fixed", verified: "Verified", reopened: "Reopened", wont_fix: "Won't fix",
};
const SCOPE_LABEL: Record<string, string> = { hq: "Executive HQ", it: "IT Console", admin: "Admin" };
const fmt = (iso: string) => new Date(iso).toLocaleString("en-GB", { timeZone: "Asia/Dhaka", dateStyle: "medium", timeStyle: "short" }) + " (Dhaka)";
const keyOf = (no: string) => `${AUDIT_COMMIT}#${no}`;

export function useAuditRecords() {
  const adminToken = useAdminToken();
  const fn = useServerFn(getAuditRecords);
  return useQuery({ queryKey: ["audit-records", adminToken], queryFn: () => fn({ data: { adminToken } }), retry: 1 });
}

export function eventsFor(events: RemediationEvent[], item: AuditItem) {
  return events.filter((e) => e.finding_key === keyOf(itemNumber(item.item)));
}

/** Header strip: persistence status + permanent snapshot button (HQ/IT only). */
export function PersistBar({ total }: { total: number }) {
  const adminToken = useAdminToken();
  const qc = useQueryClient();
  const rec = useAuditRecords();
  const persist = useServerFn(persistAuditFindings);
  const m = useMutation({
    mutationFn: () => persist({ data: { adminToken } }),
    onSuccess: () => { toast.success("Findings saved permanently"); void qc.invalidateQueries({ queryKey: ["audit-records"] }); },
    onError: (e) => toast.error((e as Error).message),
  });
  if (rec.isPending) return <p className="mt-3 text-xs text-muted-foreground">Checking saved audit records…</p>;
  if (rec.isError) return <p role="alert" className="mt-3 text-xs text-destructive">Saved audit records could not be loaded.</p>;
  if (!rec.data.allowed) return <p className="mt-3 text-xs text-muted-foreground">Sign in as HQ or IT to see the saved record and remediation timeline.</p>;
  const saved = rec.data.persisted;
  const first = saved.reduce<string | null>((m2, r) => (!m2 || r.captured_at < m2 ? r.captured_at : m2), null);
  return (
    <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-xs print:hidden">
      <Archive className="h-4 w-4 text-muted-foreground" aria-hidden />
      {saved.length >= total
        ? <span>All {total} findings are saved permanently{first ? ` since ${fmt(first)} by ${saved[0]?.captured_by}` : ""}. They cannot be edited or deleted.</span>
        : <span>{saved.length} of {total} findings saved permanently.</span>}
      {saved.length < total ? (
        <Button size="sm" className="ml-auto" disabled={m.isPending} onClick={() => m.mutate()}>{m.isPending ? "Saving…" : "Save findings permanently"}</Button>
      ) : null}
    </div>
  );
}

/** Append-only remediation timeline inside the finding detail. */
export function RemediationTimeline({ item }: { item: AuditItem }) {
  const adminToken = useAdminToken();
  const qc = useQueryClient();
  const rec = useAuditRecords();
  const add = useServerFn(addRemediationEvent);
  const [action, setAction] = useState<(typeof REMEDIATION_ACTIONS)[number]>("noted");
  const [note, setNote] = useState("");
  const m = useMutation({
    mutationFn: () => add({ data: { adminToken, itemNo: itemNumber(item.item), action, note } }),
    onSuccess: () => { setNote(""); toast.success("Step added to the timeline"); void qc.invalidateQueries({ queryKey: ["audit-records"] }); },
    onError: (e) => toast.error((e as Error).message),
  });
  const h = <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Remediation timeline</h3>;
  if (rec.isPending) return <section>{h}<p className="mt-1 text-muted-foreground">Loading…</p></section>;
  if (rec.isError) return <section>{h}<p role="alert" className="mt-1 text-destructive">Timeline could not be loaded.</p></section>;
  if (!rec.data.allowed) return <section>{h}<p className="mt-1 text-muted-foreground">Visible to HQ and IT only.</p></section>;
  const saved = rec.data.persisted.some((p) => p.finding_key === keyOf(itemNumber(item.item)));
  const evs = eventsFor(rec.data.events, item);
  return (
    <section>
      {h}
      {evs.length === 0 ? <p className="mt-1 text-muted-foreground">No remediation steps recorded yet.</p> : (
        <ol className="mt-2 space-y-3 border-l border-border pl-4">
          {evs.map((e) => (
            <li key={e.id} className="relative">
              <span className="absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-background bg-primary" aria-hidden />
              <p className="font-medium">{ACTION_LABEL[e.action] ?? e.action} · <span className="font-normal">{e.actor_name}</span> <span className="text-muted-foreground">({SCOPE_LABEL[e.actor_scope] ?? e.actor_scope})</span></p>
              <p className="text-xs text-muted-foreground"><time dateTime={e.created_at}>{fmt(e.created_at)}</time></p>
              <p className="mt-1 whitespace-pre-wrap">{e.note}</p>
            </li>
          ))}
        </ol>
      )}
      {saved ? (
        <form className="mt-3 space-y-2 rounded-lg border border-border p-3 print:hidden" onSubmit={(e) => { e.preventDefault(); if (note.trim()) m.mutate(); }}>
          <label className="block text-xs font-medium">Step
            <select value={action} onChange={(e) => setAction(e.target.value as typeof action)} className="mt-1 h-9 w-full rounded-md border border-input bg-background px-2 text-sm">
              {REMEDIATION_ACTIONS.map((a) => <option key={a} value={a}>{ACTION_LABEL[a]}</option>)}
            </select>
          </label>
          <label className="block text-xs font-medium">What was done
            <textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} rows={3} required className="mt-1 w-full rounded-md border border-input bg-background p-2 text-sm" />
          </label>
          <p className="text-[11px] text-muted-foreground">Steps are permanent — they cannot be edited or deleted. Your name and the time are recorded automatically.</p>
          <Button type="submit" size="sm" disabled={!note.trim() || m.isPending}>{m.isPending ? "Saving…" : "Add step"}</Button>
        </form>
      ) : <p className="mt-2 text-xs text-muted-foreground">Save the findings permanently (top of page) before adding steps.</p>}
    </section>
  );
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

function findingHtml(i: AuditItem, evs: RemediationEvent[] | null) {
  const tl = evs === null ? "<p><em>Remediation timeline visible to HQ/IT only.</em></p>"
    : evs.length === 0 ? "<p>No remediation steps recorded.</p>"
    : `<ol>${evs.map((e) => `<li><b>${esc(ACTION_LABEL[e.action] ?? e.action)}</b> — ${esc(e.actor_name)} (${esc(SCOPE_LABEL[e.actor_scope] ?? e.actor_scope)}), ${esc(fmt(e.created_at))}<br>${esc(e.note)}</li>`).join("")}</ol>`;
  return `<section><h2>Finding ${esc(itemNumber(i.item))}. ${esc(itemTitle(i.item))}</h2><p><b>Result:</b> ${esc(i.result)}</p><p><b>Evidence:</b> ${esc(i.evidence)}</p><h3>Remediation timeline</h3>${tl}</section>`;
}

function openReport(title: string, body: string) {
  const w = window.open("", "_blank");
  if (!w) { toast.error("Allow pop-ups to open the report"); return; }
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title><style>body{font:14px/1.5 system-ui,sans-serif;max-width:780px;margin:32px auto;padding:0 16px}h1{font-size:22px}section{border-top:1px solid #ccc;padding-top:12px;margin-top:16px;break-inside:avoid}</style></head><body><h1>${esc(title)}</h1><p>Audit date ${esc(AUDIT_DATE)} · Version ${esc(AUDIT_COMMIT)} · Document ${esc(DOC_VERSION)} · Generated ${esc(fmt(new Date().toISOString()))}</p>${body}<script>window.onload=()=>window.print()</script></body></html>`);
  w.document.close();
}

/** Report buttons. `events` is null when the viewer cannot see the timeline. */
export function FindingReportButton({ item }: { item: AuditItem }) {
  const rec = useAuditRecords();
  const evs = rec.data?.allowed ? eventsFor(rec.data.events, item) : null;
  return <Button variant="outline" size="sm" onClick={() => openReport(`Audit finding ${itemNumber(item.item)} — Winstone CRM`, findingHtml(item, evs))}><FileText className="h-4 w-4" aria-hidden />Finding report</Button>;
}

export function AllReportsButtons({ rows }: { rows: AuditItem[] }) {
  const rec = useAuditRecords();
  const all = rec.data?.allowed ? rec.data.events : null;
  const csv = () => {
    const q = (s: string) => `"${s.replace(/"/g, '""')}"`;
    const lines = [["No", "Finding", "Result", "Evidence", "Latest step", "Latest by", "Latest at"].join(",")];
    for (const i of rows) {
      const last = all ? eventsFor(all, i).at(-1) : undefined;
      lines.push([itemNumber(i.item), itemTitle(i.item), i.result, i.evidence, last ? ACTION_LABEL[last.action] ?? last.action : "", last?.actor_name ?? "", last ? fmt(last.created_at) : ""].map((v) => q(String(v))).join(","));
    }
    const url = URL.createObjectURL(new Blob(["\uFEFF" + lines.join("\n")], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a"); a.href = url; a.download = `winstone-audit-findings-${AUDIT_COMMIT}.csv`; a.click(); URL.revokeObjectURL(url);
  };
  return (
    <>
      <Button variant="outline" size="sm" onClick={csv}><FileDown className="h-4 w-4" aria-hidden />CSV</Button>
      <Button variant="outline" size="sm" onClick={() => openReport("Audit findings — Winstone CRM", rows.map((i) => findingHtml(i, all ? eventsFor(all, i) : null)).join(""))}><FileText className="h-4 w-4" aria-hidden />Findings report</Button>
    </>
  );
}
