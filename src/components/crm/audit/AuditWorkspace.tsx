import { useNavigate } from "@tanstack/react-router";
import { AlertTriangle, CheckCircle2, ChevronDown, CircleDot, Download, Link2, Printer, Search, ShieldAlert, X } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  STALE_AFTER_DAYS, auditAgeDays, countResults, filterItems, itemNumber, itemTitle,
  qualifierMeaning, resultKind, resultOptions, resultQualifier, type AuditItem,
} from "@/lib/audit-report-view";
import { AUDIT_COMMIT, AUDIT_DATE, AUDIT_ITEMS, AUDIT_PDF_PATH, AUDIT_SECTIONS, DOC_VERSION } from "@/lib/handover-docs";

const scope = AUDIT_SECTIONS.find((s) => s.id === "scope");
const notVerified = AUDIT_SECTIONS.find((s) => s.id === "ops");
const reference = AUDIT_SECTIONS.filter((s) => s.id !== "scope" && s.id !== "ops");

function ResultBadge({ result }: { result: string }) {
  const k = resultKind(result);
  const Icon = k === "pass" ? CheckCircle2 : k === "qualified" ? CircleDot : AlertTriangle;
  const cls = k === "pass"
    ? "border-success/30 bg-success/10 text-success"
    : k === "qualified" ? "border-warning/40 bg-warning/10 text-warning-foreground" : "border-destructive/30 bg-destructive/10 text-destructive";
  return (
    <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-md border px-2 py-0.5 text-xs font-semibold ${cls}`}>
      <Icon className="h-3.5 w-3.5" aria-hidden />{result}
    </span>
  );
}

export function AuditWorkspace({ q, result, item }: { q: string; result: string; item: string }) {
  const navigate = useNavigate({ from: "/audit-report" });
  const lastFocus = useRef<HTMLElement | null>(null);
  const [openRef, setOpenRef] = useState<string | null>(null);
  const counts = countResults(AUDIT_ITEMS);
  const options = resultOptions(AUDIT_ITEMS);
  const safeResult = options.includes(result) ? result : "";
  const rows = filterItems(AUDIT_ITEMS, q.slice(0, 100), safeResult);
  const selected = AUDIT_ITEMS.find((i) => itemNumber(i.item) === item) ?? null;
  const age = auditAgeDays(AUDIT_DATE);
  const stale = age !== null && age > STALE_AFTER_DAYS;

  const setSearch = (patch: Partial<{ q: string; result: string; item: string }>) =>
    navigate({ search: (prev) => ({ ...prev, ...patch }), replace: true });
  const open = (i: AuditItem, el: HTMLElement) => { lastFocus.current = el; setSearch({ item: itemNumber(i.item) }); };
  const close = () => { setSearch({ item: "" }); setTimeout(() => lastFocus.current?.focus(), 0); };

  const copyLink = async (i: AuditItem) => {
    const url = `${window.location.origin}/audit-report?item=${itemNumber(i.item)}`;
    try { await navigator.clipboard.writeText(url); toast.success("Link copied"); } catch { toast.error("Could not copy the link"); }
  };

  return (
    <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 print:py-0">
      <header className="border-b border-border pb-5">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Winstone CRM · Audit</p>
        <div className="mt-1 flex flex-wrap items-end justify-between gap-3">
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Production Readiness Audit</h1>
          <div className="flex gap-2 print:hidden">
            <Button variant="outline" size="sm" asChild><a href={AUDIT_PDF_PATH} download><Download className="h-4 w-4" aria-hidden />PDF</a></Button>
            <Button variant="outline" size="sm" onClick={() => window.print()}><Printer className="h-4 w-4" aria-hidden />Print</Button>
          </div>
        </div>
        {scope ? <p className="mt-2 max-w-3xl text-sm text-muted-foreground">{scope.body[0]}</p> : null}
        <p className="mt-2 text-xs text-muted-foreground">
          Documented audit date <time className="font-medium text-foreground">{AUDIT_DATE}</time> · Version {AUDIT_COMMIT} · Document {DOC_VERSION}. This is a fixed audit record, not a live run.
        </p>
        <dl className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            ["Findings", counts.total],
            ["Full PASS", counts.pass],
            ["Qualified PASS", counts.qualified],
            ["Not passed", counts.other],
          ].map(([k, v]) => (
            <div key={k} className="rounded-lg border border-border bg-card px-3 py-2">
              <dt className="text-xs text-muted-foreground">{k}</dt>
              <dd className="text-lg font-semibold tabular-nums">{v}</dd>
            </div>
          ))}
        </dl>
        {stale ? (
          <p role="status" className="mt-3 flex items-start gap-2 rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-sm">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            This audit is {age} days old. Changes made since then are not covered by these results.
          </p>
        ) : null}
      </header>

      <section aria-labelledby="register" className="mt-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="register" className="text-lg font-semibold">Findings register</h2>
          <div className="flex w-full flex-wrap gap-2 sm:w-auto print:hidden">
            <label className="relative flex-1 sm:w-64 sm:flex-none">
              <span className="sr-only">Search findings</span>
              <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" aria-hidden />
              <Input value={q} onChange={(e) => setSearch({ q: e.target.value })} placeholder="Search item or evidence" className="pl-8" />
            </label>
            <label>
              <span className="sr-only">Filter by result</span>
              <select value={safeResult} onChange={(e) => setSearch({ result: e.target.value })}
                className="h-10 rounded-md border border-input bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <option value="">All results</option>
                {options.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            </label>
          </div>
        </div>
        <p className="mt-1 text-xs text-muted-foreground" aria-live="polite">{rows.length} of {counts.total} findings</p>

        {rows.length === 0 ? (
          <div className="mt-4 rounded-lg border border-dashed border-border p-8 text-center">
            <p className="font-medium">No findings match your search.</p>
            <Button variant="outline" size="sm" className="mt-3" onClick={() => setSearch({ q: "", result: "" })}>Clear filters</Button>
          </div>
        ) : (
          <>
            <ul className="mt-3 space-y-2 md:hidden">
              {rows.map((i) => (
                <li key={i.item}>
                  <button type="button" onClick={(e) => open(i, e.currentTarget)}
                    className="w-full rounded-lg border border-border bg-card p-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-medium"><span className="text-muted-foreground">{itemNumber(i.item)}.</span> {itemTitle(i.item)}</span>
                    </div>
                    <div className="mt-2"><ResultBadge result={i.result} /></div>
                    <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{i.evidence}</p>
                  </button>
                </li>
              ))}
            </ul>
            <div className="mt-3 hidden overflow-hidden rounded-lg border border-border md:block">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr><th scope="col" className="w-12 px-3 py-2">No.</th><th scope="col" className="px-3 py-2">Finding</th><th scope="col" className="px-3 py-2">Result</th><th scope="col" className="px-3 py-2">Evidence</th></tr>
                </thead>
                <tbody>
                  {rows.map((i) => (
                    <tr key={i.item} tabIndex={0} aria-label={`Open finding ${i.item}`}
                      onClick={(e) => open(i, e.currentTarget)}
                      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(i, e.currentTarget); } }}
                      className="cursor-pointer border-t border-border align-top hover:bg-muted/40 focus-visible:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring">
                      <td className="px-3 py-2.5 tabular-nums text-muted-foreground">{itemNumber(i.item)}</td>
                      <td className="px-3 py-2.5 font-medium">{itemTitle(i.item)}</td>
                      <td className="px-3 py-2.5"><ResultBadge result={i.result} /></td>
                      <td className="px-3 py-2.5 text-muted-foreground"><span className="line-clamp-2 print:line-clamp-none">{i.evidence}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>

      {notVerified ? (
        <section aria-labelledby="nv" className="mt-6 rounded-lg border border-warning/40 bg-warning/5 p-4">
          <h2 id="nv" className="flex items-center gap-2 font-semibold"><ShieldAlert className="h-4 w-4" aria-hidden />{notVerified.title}</h2>
          {notVerified.body.map((p, n) => <p key={n} className="mt-2 text-sm leading-relaxed">{p}</p>)}
        </section>
      ) : null}

      <section aria-labelledby="ref" className="mt-6">
        <h2 id="ref" className="text-lg font-semibold">Reference</h2>
        <div className="mt-2 divide-y divide-border rounded-lg border border-border">
          {reference.map((s) => (
            <details key={s.id} open={openRef === s.id} onToggle={(e) => { if ((e.target as HTMLDetailsElement).open) setOpenRef(s.id); }} className="group">
              <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring">
                {s.title}<ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" aria-hidden />
              </summary>
              <div className="px-4 pb-4">
                {s.body.map((p, n) => <p key={n} className="mt-2 text-sm leading-relaxed">{p}</p>)}
                {s.table ? (
                  <div className="table-scroll mt-3">
                    <table className="w-full min-w-[480px] text-sm">
                      <thead><tr>{(s.table[0] ?? []).map((h) => <th key={h} className="border-b border-border p-2 text-left text-xs text-muted-foreground">{h}</th>)}</tr></thead>
                      <tbody>{s.table.slice(1).map((r, n) => <tr key={n}>{r.map((c, j) => <td key={j} className="border-b border-border p-2 align-top">{c}</td>)}</tr>)}</tbody>
                    </table>
                  </div>
                ) : null}
              </div>
            </details>
          ))}
        </div>
      </section>

      <Sheet open={!!selected} onOpenChange={(o) => { if (!o) close(); }}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-lg">
          {selected ? (
            <>
              <SheetHeader>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Finding {itemNumber(selected.item)}</p>
                <SheetTitle>{itemTitle(selected.item)}</SheetTitle>
                <SheetDescription asChild><div><ResultBadge result={selected.result} /></div></SheetDescription>
              </SheetHeader>
              <div className="mt-5 space-y-5 text-sm">
                {qualifierMeaning(resultQualifier(selected.result)) ? (
                  <section><h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">What this result means</h3>
                    <p className="mt-1">{qualifierMeaning(resultQualifier(selected.result))}</p></section>
                ) : null}
                <section><h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Evidence</h3>
                  <p className="mt-1 leading-relaxed">{selected.evidence}</p></section>
                <section><h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Recorded</h3>
                  <dl className="mt-1 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
                    <dt className="text-muted-foreground">Audit date</dt><dd>{AUDIT_DATE}</dd>
                    <dt className="text-muted-foreground">Version</dt><dd>{AUDIT_COMMIT}</dd>
                    <dt className="text-muted-foreground">Source</dt><dd>Audit report document {DOC_VERSION}</dd>
                    <dt className="text-muted-foreground">Reviewer notes</dt><dd className="text-muted-foreground">Not recorded</dd>
                  </dl></section>
                {resultKind(selected.result) !== "pass" && notVerified ? (
                  <p className="rounded-md border border-warning/40 bg-warning/5 p-3 text-xs">See "{notVerified.title}" on this page for the limits of this result.</p>
                ) : null}
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => copyLink(selected)}><Link2 className="h-4 w-4" aria-hidden />Copy link</Button>
                  <Button variant="ghost" size="sm" onClick={close}><X className="h-4 w-4" aria-hidden />Close</Button>
                </div>
              </div>
            </>
          ) : null}
        </SheetContent>
      </Sheet>
    </main>
  );
}
