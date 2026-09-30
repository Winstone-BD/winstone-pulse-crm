import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Copy, Download, FileText, MessageCircle, Printer, RefreshCw, Save, ShieldCheck } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useAdminToken } from "@/lib/local-session";
import {
  siBrief,
  siEffectiveness,
  siExportPitches,
  siFactStatus,
  siFacts,
  siMyLeads,
  siPitchHistory,
  siRecommend,
  siRecordPitch,
  siSaveFact,
  siSaveTemplate,
  siTemplateStatus,
  siTemplates,
  siVersions,
} from "@/lib/sales-intel.functions";
import {
  FACT_CATEGORIES,
  OBJECTIONS,
  PITCH_ACTIONS,
  PITCH_ACTION_LABEL,
  SI_DOC_VERSION,
  objectionLabel,
  pitchHistoryCsv,
  whatsappUrl,
  type FactCategory,
  type ObjectionCode,
  type PitchAction,
} from "@/lib/sales-intel-rules";

const dh = (iso: string) => new Date(Date.parse(iso)).toLocaleString("en-GB", { timeZone: "Asia/Dhaka", dateStyle: "medium", timeStyle: "short" });
const newId = () => (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`).replace(/-/g, "");
const errMsg = (e: unknown) => (e instanceof Error ? e.message : "ত্রুটি");
const card = "rounded-2xl border border-border bg-card p-4 sm:p-5 shadow-sm";

function EligBadge({ e }: { e: string }) {
  const map: Record<string, string> = { authoritative: "bg-success/15 text-success", review_due: "bg-warning/15 text-warning", unverified: "bg-muted text-muted-foreground", expired: "bg-destructive/15 text-destructive" };
  const label: Record<string, string> = { authoritative: "Verified · published", review_due: "Review due", unverified: "Not verified — excluded", expired: "Expired — excluded" };
  return <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${map[e] ?? ""}`}>{label[e] ?? e}</span>;
}

type BL = { label: string; value: string; group: "fact" | "next_action"; sources: Array<{ kind: string; id: string }> };
function BriefLines({ lines }: { lines: BL[] }) {
  const block = (title: string, hint: string, rows: BL[]) => (
    <div className="mt-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title} <span className="font-normal normal-case">· {hint}</span></p>
      <dl className="mt-2 grid gap-2 sm:grid-cols-2">
        {rows.map((l) => (
          <div key={l.label} className="rounded-xl bg-muted/50 p-3">
            <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{l.label}</dt>
            <dd className="mt-0.5 break-words text-sm">{l.value}</dd>
            <dd className="mt-1 text-[10px] text-muted-foreground">{l.sources.length ? `উৎস: ${[...new Set(l.sources.map((s) => s.kind))].join(", ")} (${l.sources.length})` : "উৎস: নেই"}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
  return (
    <>
      {block("Customer context (facts)", "সংরক্ষিত রেকর্ড", lines.filter((l) => l.group === "fact"))}
      {block("Recommended next action", "নিয়ম-ভিত্তিক", lines.filter((l) => l.group === "next_action"))}
      <p className="mt-3 text-xs text-muted-foreground">Generated suggestion নিচের Smart Pitchbook-এ আলাদাভাবে দেখানো হয় — এটি প্রস্তাব, তথ্য নয়।</p>
    </>
  );
}

/** Read-only AI Sales Brief card for Lead 360 (HQ sees any lead; agents only their own). */
export function SalesBriefCard({ leadId }: { leadId: string }) {
  const adminToken = useAdminToken();
  const fn = useServerFn(siBrief);
  const res = useQuery({ queryKey: ["si-brief", leadId, adminToken], queryFn: () => fn({ data: { adminToken, leadId } }) });
  return (
    <section className={card}>
      <h3 className="text-base font-semibold">AI Sales Brief</h3>
      {res.isLoading && <p className="mt-2 text-sm text-muted-foreground">লোড হচ্ছে…</p>}
      {res.error && <p className="mt-2 text-sm text-destructive">{errMsg(res.error)}</p>}
      {res.data && <BriefLines lines={res.data.lines} />}
    </section>
  );
}

// ---------------- Agent: Smart Pitchbook ----------------
export function PitchbookWorkspace({ fixedLeadId }: { fixedLeadId?: string }) {
  const adminToken = useAdminToken();
  const [q, setQ] = useState("");
  const [leadId, setLeadId] = useState<string | null>(fixedLeadId ?? null);
  const leadsFn = useServerFn(siMyLeads);
  const leads = useQuery({ queryKey: ["si-my-leads", q], queryFn: () => leadsFn({ data: { adminToken, q } }), enabled: !fixedLeadId });
  return (
    <div className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
      {!fixedLeadId && (
        <div className={card}>
          <p className="text-sm font-semibold">আমার লিড</p>
          <Input className="mt-2" placeholder="নাম বা ফোন" value={q} onChange={(e) => setQ(e.target.value)} />
          <div className="mt-3 max-h-[60vh] space-y-1 overflow-y-auto">
            {leads.isLoading && <p className="text-xs text-muted-foreground">লোড হচ্ছে…</p>}
            {leads.error && <p className="text-xs text-destructive">{errMsg(leads.error)}</p>}
            {(leads.data ?? []).map((l) => (
              <button key={l.id} onClick={() => setLeadId(l.id)} className={`w-full rounded-lg px-3 py-2 text-left text-sm transition ${leadId === l.id ? "bg-primary text-primary-foreground" : "hover:bg-accent"}`}>
                <span className="block truncate font-medium">{l.name}</span>
                <span className="block text-xs opacity-80">{l.phone_number}</span>
              </button>
            ))}
            {leads.data?.length === 0 && <p className="text-xs text-muted-foreground">আপনার নামে কোনো লিড নেই।</p>}
          </div>
        </div>
      )}
      <div className="min-w-0 space-y-4">{leadId ? <LeadPitchbook key={leadId} leadId={leadId} /> : <div className={card}><p className="text-sm text-muted-foreground">বাম দিক থেকে একটি লিড বেছে নিন।</p></div>}</div>
    </div>
  );
}

function LeadPitchbook({ leadId }: { leadId: string }) {
  const adminToken = useAdminToken();
  const qc = useQueryClient();
  const briefFn = useServerFn(siBrief);
  const recFn = useServerFn(siRecommend);
  const recordFn = useServerFn(siRecordPitch);
  const brief = useQuery({ queryKey: ["si-brief", leadId], queryFn: () => briefFn({ data: { adminToken, leadId } }) });
  const [objection, setObjection] = useState<ObjectionCode | null>(null);
  const [note, setNote] = useState("");
  const [project, setProject] = useState("");
  const [edited, setEdited] = useState<string | null>(null);
  const [actionIds] = useState(() => new Map<string, string>());
  const rec = useMutation({ mutationFn: (o: ObjectionCode) => recFn({ data: { adminToken, leadId, objection: o, note: note || null } }), onSuccess: () => setEdited(null) });
  const text = edited ?? rec.data?.text ?? "";

  const record = async (action: PitchAction) => {
    if (!objection || !rec.data) return;
    // One client action id per (recommendation, action): retries reuse it, so no duplicates.
    const k = `${rec.data.text.length}:${rec.submittedAt}:${action}:${edited ?? ""}`;
    if (!actionIds.has(k)) actionIds.set(k, newId());
    try {
      const r = await recordFn({ data: { adminToken, leadId, objection, action, clientActionId: actionIds.get(k)!, templateId: rec.data.templateId, generatedText: rec.data.text, finalText: edited, project: project.trim() || null, factIds: rec.data.factIds, grounded: rec.data.grounded, callId: rec.data.lastReportId, followUpId: rec.data.openFollowUpId } });
      qc.invalidateQueries({ queryKey: ["si-history"] });
      return r;
    } catch (e) {
      toast.error(errMsg(e));
      return null;
    }
  };

  return (
    <>
      <section className={card}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-base font-semibold">AI Sales Brief</h3>
          <span className="text-xs text-muted-foreground">শুধু সংরক্ষিত রেকর্ড থেকে</span>
        </div>
        {brief.isLoading && <p className="mt-2 text-sm text-muted-foreground">লোড হচ্ছে…</p>}
        {brief.error && <p className="mt-2 text-sm text-destructive">{errMsg(brief.error)}</p>}
        {brief.data && (
          <>
            <p className="mt-1 text-sm font-medium">{brief.data.lead.name} · {brief.data.lead.phone}</p>
            <BriefLines lines={brief.data.lines} />
          </>
        )}
      </section>

      <section className={card}>
        <h3 className="text-base font-semibold">Smart Pitchbook</h3>
        <p className="mt-1 text-xs text-muted-foreground">গ্রাহকের আপত্তি বেছে নিন</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {OBJECTIONS.map((o) => (
            <button key={o.code} onClick={() => { setObjection(o.code); rec.mutate(o.code); }} className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${objection === o.code ? "border-primary bg-primary text-primary-foreground" : "border-border hover:bg-accent"}`}>
              {o.label}
            </button>
          ))}
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <Input placeholder="নোট (ঐচ্ছিক)" value={note} onChange={(e) => setNote(e.target.value)} />
          <Input placeholder="প্রজেক্ট (বেছে নিলে)" value={project} onChange={(e) => setProject(e.target.value)} />
        </div>
        {rec.isPending && <p className="mt-3 text-sm text-muted-foreground">উত্তর তৈরি হচ্ছে…</p>}
        {rec.error && <p className="mt-3 text-sm text-destructive">{errMsg(rec.error)}</p>}
        {rec.data && objection && (
          <div className="mt-4 space-y-4">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-semibold">Recommended Response</p>
                <Badge variant={rec.data.grounded ? "default" : "secondary"}>{rec.data.grounded ? "AI · verified facts" : "Approved template"}</Badge>
              </div>
              {rec.data.aiNote && <p className="mt-1 text-xs text-warning">{rec.data.aiNote}</p>}
              <Textarea className="mt-2 min-h-32" value={text} onChange={(e) => setEdited(e.target.value)} />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={async () => { await navigator.clipboard.writeText(text); const r = await record(edited ? "edited" : "copied"); if (r) toast.success("কপি হয়েছে ও ইতিহাসে লেখা হয়েছে"); }}><Copy className="size-4" /> Copy Pitch</Button>
              <Button size="sm" variant="outline" onClick={async () => {
                const url = whatsappUrl(rec.data!.lead.phone, text);
                if (!url) { toast.error("ফোন নম্বর WhatsApp-এর জন্য বৈধ নয়"); return; }
                window.open(url, "_blank", "noopener");
                const r = await record("whatsapp_opened");
                if (r) toast.success("WhatsApp খোলা হয়েছে / বার্তা প্রস্তুত — পাঠানো নিশ্চিত নয়");
              }}><MessageCircle className="size-4" /> WhatsApp</Button>
              <Button size="sm" variant="outline" onClick={async () => { const r = await record("saved"); if (r) toast.success(r.duplicate ? "আগেই সংরক্ষিত" : "লিড ইতিহাসে সংরক্ষিত"); }}><Save className="size-4" /> Save to Lead History</Button>
              <Button size="sm" variant="ghost" onClick={() => rec.mutate(objection)}><RefreshCw className="size-4" /> Edit / Regenerate</Button>
            </div>
            <div className="rounded-xl bg-muted/50 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Why this response</p>
              <ul className="mt-1 list-disc space-y-0.5 pl-5 text-sm">{rec.data.why.map((w) => <li key={w} className="break-words">{w}</li>)}</ul>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Supporting Facts</p>
              {rec.data.supportingFacts.length === 0 && <p className="mt-1 text-sm text-muted-foreground">এই আপত্তির জন্য কোনো যাচাই-কৃত তথ্য প্রকাশিত নেই।</p>}
              <div className="mt-2 grid gap-2 md:grid-cols-2">
                {rec.data.supportingFacts.map((f) => (
                  <div key={f.id} className="rounded-xl border border-border p-3 text-sm">
                    <div className="flex flex-wrap items-center justify-between gap-1"><span className="font-medium">{f.metric}</span><EligBadge e={f.eligibility} /></div>
                    <p className="mt-1">{f.value} {f.unit ?? ""} {f.geography ? `· ${f.geography}` : ""}</p>
                    <p className="mt-1 text-xs text-muted-foreground">উৎস: {f.sourceUrl ? <a className="underline" href={f.sourceUrl} target="_blank" rel="noreferrer">{f.source}</a> : f.source} · কার্যকর {f.effectiveDate} · v{f.version}</p>
                    <p className="text-xs text-muted-foreground">রিভিউ {f.reviewDate ?? "—"} · মেয়াদ {f.expiryDate ?? "—"}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </section>
      <PitchHistoryPanel fixedLeadId={leadId} compact />
    </>
  );
}

// ---------------- Pitch History (both scopes) ----------------
type F = { q: string; objection: string; action: string; project: string; outcome: string; from: string; to: string; agentId: string; source: string; templateId: string };
const EMPTY: F = { q: "", objection: "", action: "", project: "", outcome: "", from: "", to: "", agentId: "", source: "", templateId: "" };
const toServer = (f: F, leadId?: string) => ({
  q: f.q || null, objection: (f.objection || null) as ObjectionCode | null, action: (f.action || null) as PitchAction | null, project: f.project || null,
  outcome: (f.outcome || null) as "follow_up" | null, from: f.from || null, to: f.to || null, agentId: f.agentId || null, source: f.source || null, templateId: f.templateId || null, leadId: leadId ?? null,
});

export function PitchHistoryPanel({ fixedLeadId, compact }: { fixedLeadId?: string; compact?: boolean }) {
  const adminToken = useAdminToken();
  const [f, setF] = useState<F>(EMPTY);
  const [cursors, setCursors] = useState<Array<{ at: string; id: string } | null>>([null]);
  const histFn = useServerFn(siPitchHistory);
  const exportFn = useServerFn(siExportPitches);
  const cursor = cursors[cursors.length - 1];
  const res = useQuery({ queryKey: ["si-history", f, cursor, fixedLeadId], queryFn: () => histFn({ data: { adminToken, filters: toServer(f, fixedLeadId), cursor, pageSize: 50 } }) });
  const set = (k: keyof F) => (e: { target: { value: string } }) => { setF({ ...f, [k]: e.target.value }); setCursors([null]); };
  const sel = "h-9 rounded-md border border-input bg-background px-2 text-sm";

  const doExport = async (kind: "csv" | "print"): Promise<void> => {
    try {
      const out = await exportFn({ data: { adminToken, filters: toServer(f, fixedLeadId) } });
      const meta = { filters: toServer(f, fixedLeadId), scope: out.scope, generatedAt: new Date(out.generatedAt), total: out.rows.length };
      if (kind === "csv") {
        const url = URL.createObjectURL(new Blob(["\ufeff" + pitchHistoryCsv(meta, out.rows)], { type: "text/csv;charset=utf-8" }));
        const a = document.createElement("a"); a.href = url; a.download = `pitch-history-${out.generatedAt.slice(0, 10)}.csv`; a.click(); URL.revokeObjectURL(url);
      } else {
        const w = window.open("", "_blank");
        if (!w) { toast.error("পপ-আপ ব্লক হয়েছে"); return; }
        const esc = (s: unknown) => String(s ?? "").replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]!);
        w.document.write(`<html><head><title>Pitch History</title><style>body{font-family:sans-serif;font-size:11px}table{border-collapse:collapse;width:100%}td,th{border:1px solid #999;padding:4px;vertical-align:top}</style></head><body><h2>WINSTONE CRM — Pitch History (${SI_DOC_VERSION})</h2><p>Generated ${esc(dh(out.generatedAt))} (Asia/Dhaka) · Scope: ${esc(out.scope)} · Rows: ${out.rows.length}</p><p>Filters: ${esc(Object.entries(meta.filters).filter(([, v]) => v).map(([k, v]) => `${k}=${v}`).join("; ") || "none")}</p><table><tr><th>Time (Dhaka)</th><th>Lead</th><th>Agent</th><th>Objection</th><th>Action</th><th>Project</th><th>Text</th></tr>${out.rows.map((r) => `<tr><td>${esc(dh(r.created_at))}</td><td>${esc(r.lead_name)}</td><td>${esc(r.agent)}</td><td>${esc(objectionLabel(r.objection_code))}</td><td>${esc(PITCH_ACTION_LABEL[r.action as PitchAction] ?? r.action)}</td><td>${esc(r.project)}</td><td>${esc(r.final_text ?? r.generated_text)}</td></tr>`).join("")}</table></body></html>`);
        w.document.close(); w.print();
      }
    } catch (e) { toast.error(errMsg(e)); }
  };

  return (
    <section className={card}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-base font-semibold">Pitch History</h3>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => doExport("csv")}><Download className="size-4" /> CSV</Button>
          <Button size="sm" variant="outline" onClick={() => doExport("print")}><Printer className="size-4" /> Print/PDF</Button>
        </div>
      </div>
      {!compact && (
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <Input placeholder="লিড, ফোন বা Lead ID" value={f.q} onChange={set("q")} />
          <select className={sel} value={f.objection} onChange={set("objection")} aria-label="Objection"><option value="">সব আপত্তি</option>{OBJECTIONS.map((o) => <option key={o.code} value={o.code}>{o.label}</option>)}</select>
          <select className={sel} value={f.action} onChange={set("action")} aria-label="Action"><option value="">সব অ্যাকশন</option>{PITCH_ACTIONS.map((a) => <option key={a} value={a}>{PITCH_ACTION_LABEL[a]}</option>)}</select>
          <select className={sel} value={f.outcome} onChange={set("outcome")} aria-label="Outcome"><option value="">সব ফলাফল</option><option value="follow_up">→ Follow-up</option><option value="call">→ Subsequent call</option><option value="site_visit">→ Site visit</option><option value="booking">→ Booking</option></select>
          <Input placeholder="প্রজেক্ট" value={f.project} onChange={set("project")} />
          <Input placeholder="লিড সোর্স" value={f.source} onChange={set("source")} />
          <Input type="date" value={f.from} onChange={set("from")} aria-label="From" />
          <Input type="date" value={f.to} onChange={set("to")} aria-label="To" />
        </div>
      )}
      {res.error && <p className="mt-3 text-sm text-destructive">{errMsg(res.error)}</p>}
      <p className="mt-3 text-xs text-muted-foreground">মোট {res.data?.total ?? 0} (ফলাফল ফিল্টার পাতার মধ্যে প্রয়োগ হয়)</p>
      <div className="mt-2 space-y-2">
        {(res.data?.rows ?? []).map((r) => (
          <div key={r.id} className="rounded-xl border border-border p-3 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary">{objectionLabel(r.objection_code)}</Badge>
              <span className="text-xs font-medium">{PITCH_ACTION_LABEL[r.action as PitchAction] ?? r.action}</span>
              <span className="ml-auto text-xs text-muted-foreground">{dh(r.created_at)}</span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">{r.lead_name ?? r.lead_id} · {r.agent ?? "—"}{r.project ? ` · ${r.project}` : ""}{r.fact_ids.length ? ` · ${r.fact_ids.length} fact(s)` : ""}</p>
            <p className="mt-1 line-clamp-3 break-words">{r.final_text ?? r.generated_text}</p>
          </div>
        ))}
        {res.data?.rows.length === 0 && <p className="text-sm text-muted-foreground">কোনো পিচ ইতিহাস নেই।</p>}
      </div>
      <div className="mt-3 flex gap-2">
        <Button size="sm" variant="ghost" disabled={cursors.length < 2} onClick={() => setCursors(cursors.slice(0, -1))}>আগের</Button>
        <Button size="sm" variant="ghost" disabled={!res.data?.nextCursor} onClick={() => res.data?.nextCursor && setCursors([...cursors, res.data.nextCursor])}>পরের</Button>
      </div>
    </section>
  );
}

// ---------------- HQ dashboard / effectiveness ----------------
export function EffectivenessPanel() {
  const adminToken = useAdminToken();
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [windowDays, setWindow] = useState(14);
  const fn = useServerFn(siEffectiveness);
  const res = useQuery({ queryKey: ["si-eff", from, to, windowDays], queryFn: () => fn({ data: { adminToken, filters: { from: from || null, to: to || null }, windowDays } }) });
  const d = res.data;
  const Tile = ({ label, value }: { label: string; value: number | string }) => (
    <div className="rounded-xl bg-muted/50 p-3"><p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p><p className="mt-1 text-2xl font-bold tabular-nums">{value}</p></div>
  );
  const List = ({ title, rows }: { title: string; rows: Array<{ key: string; count: number; label?: string }> }) => (
    <div className="rounded-xl border border-border p-3"><p className="text-sm font-semibold">{title}</p>
      <ul className="mt-2 space-y-1 text-sm">{rows.slice(0, 10).map((r) => <li key={r.key} className="flex justify-between gap-2"><span className="truncate">{r.label ?? r.key}</span><span className="tabular-nums">{r.count}</span></li>)}{rows.length === 0 && <li className="text-muted-foreground">—</li>}</ul>
    </div>
  );
  return (
    <section className={card}>
      <div className="flex flex-wrap items-end gap-2">
        <h3 className="mr-auto text-base font-semibold">Pitch Effectiveness</h3>
        <Input type="date" className="w-40" value={from} onChange={(e) => setFrom(e.target.value)} aria-label="From" />
        <Input type="date" className="w-40" value={to} onChange={(e) => setTo(e.target.value)} aria-label="To" />
        <label className="text-xs">উইন্ডো (দিন) <Input type="number" min={1} max={90} className="w-20" value={windowDays} onChange={(e) => setWindow(Math.max(1, Math.min(90, Number(e.target.value) || 14)))} /></label>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">নির্ধারিত নিয়ম: একই লিডে পিচের পরে {windowDays} দিনের মধ্যে প্রথম ফলো-আপ / কল / সাইট ভিজিট / বুকিং গণনা হয়। এটি সম্পর্ক দেখায়, কারণ নয় (association, not causation)। সাইট ভিজিট ও বুকিং শুধু সংরক্ষিত রিপোর্ট সিগন্যাল থেকে।</p>
      {res.error && <p className="mt-2 text-sm text-destructive">{errMsg(res.error)}</p>}
      {d && (
        <>
          <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-5">
            <Tile label="Total pitches" value={d.total} />
            <Tile label="→ Follow-up" value={d.toFollowUp} />
            <Tile label="→ Next call" value={d.toCall} />
            <Tile label="→ Site visit" value={d.toSiteVisit} />
            <Tile label="→ Booking" value={d.toBooking} />
          </div>
          <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-4">
            <List title="Top objections" rows={d.byObjection.map((r) => ({ ...r, label: objectionLabel(r.key) }))} />
            <List title="Most-used pitches" rows={d.byTemplate} />
            <List title="Usage by agent" rows={d.byAgent} />
            <List title="Usage by project" rows={d.byProject} />
          </div>
          <details className="mt-3 text-sm">
            <summary className="cursor-pointer font-medium">লিংক করা ইভেন্ট ({d.linksTotal})</summary>
            <div className="mt-2 max-h-64 overflow-auto"><table className="w-full min-w-[480px] text-xs"><thead><tr className="text-left text-muted-foreground"><th>Pitch</th><th>Outcome</th><th>Record</th><th>At</th></tr></thead>
              <tbody>{d.links.map((l) => <tr key={`${l.pitchId}-${l.kind}`}><td className="font-mono">{l.pitchId.slice(0, 8)}</td><td>{l.kind}</td><td className="font-mono">{l.outcomeId.slice(0, 8)}</td><td>{dh(l.at)}</td></tr>)}</tbody></table></div>
          </details>
        </>
      )}
    </section>
  );
}

// ---------------- Market intelligence views + admin ----------------
export function FactsBoard({ category, admin }: { category: FactCategory | null; admin: boolean }) {
  const adminToken = useAdminToken();
  const qc = useQueryClient();
  const fn = useServerFn(siFacts);
  const statusFn = useServerFn(siFactStatus);
  const res = useQuery({ queryKey: ["si-facts", category], queryFn: () => fn({ data: { adminToken, category } }) });
  const [edit, setEdit] = useState<Record<string, string> | null>(null);
  const change = async (id: string, to: "verified" | "published" | "expired" | "draft") => {
    try { await statusFn({ data: { adminToken, id, to } }); toast.success("স্ট্যাটাস বদলানো হয়েছে"); qc.invalidateQueries({ queryKey: ["si-facts"] }); } catch (e) { toast.error(errMsg(e)); }
  };
  const title = category ? FACT_CATEGORIES.find((c) => c.code === category)?.label : "Market Facts";
  return (
    <section className={card}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-base font-semibold">{title}</h3>
        {admin && <Button size="sm" onClick={() => setEdit({ category: category ?? "daily_market" })}>নতুন তথ্য</Button>}
      </div>
      {!admin && <p className="mt-1 text-xs text-muted-foreground">শুধু যাচাই ও প্রকাশিত তথ্য দেখানো হয়।</p>}
      {edit && <FactForm initial={edit} onDone={() => { setEdit(null); qc.invalidateQueries({ queryKey: ["si-facts"] }); }} />}
      {res.error && <p className="mt-2 text-sm text-destructive">{errMsg(res.error)}</p>}
      <div className="mt-3 grid gap-2 md:grid-cols-2">
        {(res.data ?? []).map((f) => (
          <div key={f.id} className="rounded-xl border border-border p-3 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-1"><span className="font-medium break-words">{f.metric}</span><EligBadge e={f.eligibility} /></div>
            <p className="mt-1 break-words">{f.value} {f.unit ?? ""}{f.geography ? ` · ${f.geography}` : ""}</p>
            <p className="mt-1 text-xs text-muted-foreground">উৎস: {f.source_url ? <a className="underline" href={f.source_url} target="_blank" rel="noreferrer">{f.source_name}</a> : f.source_name} · কার্যকর {f.effective_date} · v{f.version} · {f.status}</p>
            <p className="text-xs text-muted-foreground">যাচাই {f.verified_by ?? "—"} · রিভিউ {f.review_date ?? "—"} · মেয়াদ {f.expiry_date ?? "—"}</p>
            {admin && (
              <div className="mt-2 flex flex-wrap gap-1">
                {f.status === "draft" && <Button size="sm" variant="outline" onClick={() => change(f.id, "verified")}><ShieldCheck className="size-3.5" /> Verify</Button>}
                {f.status === "verified" && <Button size="sm" variant="outline" onClick={() => change(f.id, "published")}>Publish</Button>}
                {f.status !== "expired" && <Button size="sm" variant="ghost" onClick={() => change(f.id, "expired")}>Expire</Button>}
                <Button size="sm" variant="ghost" onClick={() => setEdit(Object.fromEntries(Object.entries(f).map(([k, v]) => [k, v == null ? "" : String(v)])))}>Edit (new version)</Button>
              </div>
            )}
          </div>
        ))}
        {res.data?.length === 0 && <p className="text-sm text-muted-foreground">এখনো কোনো তথ্য নেই। HQ/IT যাচাই করা তথ্য যোগ করলে এখানে দেখাবে।</p>}
      </div>
    </section>
  );
}

function FactForm({ initial, onDone }: { initial: Record<string, string>; onDone: () => void }) {
  const adminToken = useAdminToken();
  const fn = useServerFn(siSaveFact);
  const [v, setV] = useState<Record<string, string>>({ effective_date: new Date().toISOString().slice(0, 10), ...initial });
  const set = (k: string) => (e: { target: { value: string } }) => setV({ ...v, [k]: e.target.value });
  const n = (k: string) => (v[k]?.trim() ? v[k].trim() : null);
  const save = async () => {
    try {
      await fn({ data: { adminToken, id: n("id"), category: v["category"] as FactCategory, geography: n("geography"), metric: v["metric"] ?? "", value: v["value"] ?? "", unit: n("unit"), source_name: v["source_name"] ?? "", source_url: n("source_url"), effective_date: v["effective_date"]!, review_date: n("review_date"), expiry_date: n("expiry_date"), notes: n("notes") } });
      toast.success("খসড়া হিসেবে সংরক্ষিত — যাচাই ও প্রকাশ করুন");
      onDone();
    } catch (e) { toast.error(errMsg(e)); }
  };
  return (
    <div className="mt-3 grid gap-2 rounded-xl border border-dashed border-border p-3 sm:grid-cols-2">
      <select className="h-9 rounded-md border border-input bg-background px-2 text-sm" value={v["category"]} onChange={set("category")} aria-label="Category">{FACT_CATEGORIES.map((c) => <option key={c.code} value={c.code}>{c.label}</option>)}</select>
      <Input placeholder="Geography (area)" value={v["geography"] ?? ""} onChange={set("geography")} />
      <Input placeholder="Metric *" value={v["metric"] ?? ""} onChange={set("metric")} />
      <Input placeholder="Value *" value={v["value"] ?? ""} onChange={set("value")} />
      <Input placeholder="Unit" value={v["unit"] ?? ""} onChange={set("unit")} />
      <Input placeholder="Source name *" value={v["source_name"] ?? ""} onChange={set("source_name")} />
      <Input placeholder="Source URL" value={v["source_url"] ?? ""} onChange={set("source_url")} />
      <label className="text-xs">Effective date *<Input type="date" value={v["effective_date"] ?? ""} onChange={set("effective_date")} /></label>
      <label className="text-xs">Review date<Input type="date" value={v["review_date"] ?? ""} onChange={set("review_date")} /></label>
      <label className="text-xs">Expiry date<Input type="date" value={v["expiry_date"] ?? ""} onChange={set("expiry_date")} /></label>
      <Textarea className="sm:col-span-2" placeholder="Notes" value={v["notes"] ?? ""} onChange={set("notes")} />
      <div className="flex gap-2 sm:col-span-2"><Button size="sm" onClick={save}>সংরক্ষণ</Button><Button size="sm" variant="ghost" onClick={onDone}>বাতিল</Button></div>
    </div>
  );
}

export function PitchLibraryAdmin() {
  const adminToken = useAdminToken();
  const qc = useQueryClient();
  const list = useServerFn(siTemplates);
  const save = useServerFn(siSaveTemplate);
  const status = useServerFn(siTemplateStatus);
  const res = useQuery({ queryKey: ["si-templates"], queryFn: () => list({ data: { adminToken } }) });
  const [form, setForm] = useState<{ id?: string; objection_code: ObjectionCode; title: string; body: string } | null>(null);
  const grouped = useMemo(() => OBJECTIONS.map((o) => ({ o, rows: (res.data ?? []).filter((t) => t.objection_code === o.code) })), [res.data]);
  const act = async (p: Promise<unknown>) => { try { await p; toast.success("সংরক্ষিত"); qc.invalidateQueries({ queryKey: ["si-templates"] }); } catch (e) { toast.error(errMsg(e)); } };
  return (
    <section className={card}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-base font-semibold">Pitch & Objection Library</h3>
        <Button size="sm" onClick={() => setForm({ objection_code: "price_high", title: "", body: "" })}>নতুন পিচ</Button>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">টেমপ্লেটে কোনো দাম/হার লিখবেন না — সংখ্যা শুধু যাচাই-কৃত Market Facts থেকে আসে। Publish হলে এজেন্টরা ব্যবহার করতে পারে।</p>
      {form && (
        <div className="mt-3 grid gap-2 rounded-xl border border-dashed border-border p-3">
          <select className="h-9 rounded-md border border-input bg-background px-2 text-sm" value={form.objection_code} onChange={(e) => setForm({ ...form, objection_code: e.target.value as ObjectionCode })} aria-label="Objection">{OBJECTIONS.map((o) => <option key={o.code} value={o.code}>{o.label}</option>)}</select>
          <Input placeholder="Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          <Textarea className="min-h-28" placeholder="Pitch text" value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} />
          <div className="flex gap-2"><Button size="sm" onClick={() => act(save({ data: { adminToken, ...form } }).then(() => setForm(null)))}>সংরক্ষণ (খসড়া)</Button><Button size="sm" variant="ghost" onClick={() => setForm(null)}>বাতিল</Button></div>
        </div>
      )}
      {res.error && <p className="mt-2 text-sm text-destructive">{errMsg(res.error)}</p>}
      <div className="mt-3 space-y-3">
        {grouped.map(({ o, rows }) => (
          <div key={o.code}>
            <p className="text-sm font-semibold">{o.label} <span className="text-xs font-normal text-muted-foreground">({rows.length})</span></p>
            {rows.map((t) => {
              const id = t.id; const st = t.status;
              return (
                <div key={id} className="mt-1 rounded-xl border border-border p-3 text-sm">
                  <div className="flex flex-wrap items-center gap-2"><span className="font-medium">{t.title}</span><Badge variant="secondary">{st} · v{t.version}</Badge></div>
                  <p className="mt-1 whitespace-pre-wrap break-words text-muted-foreground">{t.body}</p>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {st === "draft" && <Button size="sm" variant="outline" onClick={() => act(status({ data: { adminToken, id, to: "verified" } }))}>Verify</Button>}
                    {st === "verified" && <Button size="sm" variant="outline" onClick={() => act(status({ data: { adminToken, id, to: "published" } }))}>Publish</Button>}
                    {st !== "expired" && <Button size="sm" variant="ghost" onClick={() => act(status({ data: { adminToken, id, to: "expired" } }))}>Expire</Button>}
                    <Button size="sm" variant="ghost" onClick={() => setForm({ id, objection_code: t.objection_code as ObjectionCode, title: t.title, body: t.body })}>Edit (new version)</Button>
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </section>
  );
}

export function VersionHistoryPanel() {
  const adminToken = useAdminToken();
  const fn = useServerFn(siVersions);
  const res = useQuery({ queryKey: ["si-versions"], queryFn: () => fn({ data: { adminToken } }) });
  return (
    <section className={card}>
      <h3 className="flex items-center gap-2 text-base font-semibold"><FileText className="size-4" /> Version History</h3>
      <p className="mt-1 text-xs text-muted-foreground">প্রতিটি তৈরি, সম্পাদনা, যাচাই, প্রকাশ ও মেয়াদোত্তীর্ণ — স্থায়ী, মুছে ফেলা যায় না।</p>
      {res.error && <p className="mt-2 text-sm text-destructive">{errMsg(res.error)}</p>}
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[560px] text-sm">
          <thead><tr className="text-left text-xs text-muted-foreground"><th className="py-1">Time (Dhaka)</th><th>Type</th><th>Item</th><th>Version</th><th>Action</th><th>By</th></tr></thead>
          <tbody>{(res.data ?? []).map((r) => (
            <tr key={r.id} className="border-t border-border"><td className="py-1">{dh(r.created_at)}</td><td>{r.entity}</td><td className="max-w-[240px] truncate">{r.label}</td><td>v{r.version}</td><td>{r.action}</td><td>{r.actor}</td></tr>
          ))}</tbody>
        </table>
        {res.data?.length === 0 && <p className="mt-2 text-sm text-muted-foreground">এখনো কোনো পরিবর্তন নেই।</p>}
      </div>
    </section>
  );
}
