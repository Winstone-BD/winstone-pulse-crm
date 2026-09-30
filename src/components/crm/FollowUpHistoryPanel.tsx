import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight, FileDown, FileSpreadsheet, RotateCcw } from "lucide-react";
import { Fragment, useMemo, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { listFollowUpHistory, type FollowUpHistoryRow } from "@/lib/follow-up-history.functions";
import { useAdminToken } from "@/lib/local-session";

const STATE_LABEL: Record<FollowUpHistoryRow["state"], string> = {
  active: "চলমান",
  overdue: "সময় পেরিয়েছে",
  stopped: "যোগাযোগ বন্ধ",
};

const fmt = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleString("bn-BD", {
        timeZone: "Asia/Dhaka",
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })
    : "—";

const todayDhaka = () => new Date(Date.now() + 6 * 3600_000).toISOString().slice(0, 10);
const shiftDays = (d: string, n: number) =>
  new Date(new Date(`${d}T00:00:00Z`).getTime() + n * 86400_000).toISOString().slice(0, 10);

type Filters = {
  from: string;
  to: string;
  search: string;
  agent: string;
  state: string;
  temperature: string;
  minFollowUps: number;
  day: string | null;
  sort: "next" | "most" | "last" | "overdue";
};

const defaults = (): Filters => ({
  from: shiftDays(todayDhaka(), -60),
  to: shiftDays(todayDhaka(), 60),
  search: "",
  agent: "",
  state: "",
  temperature: "",
  minFollowUps: 0,
  day: null,
  sort: "next",
});

const COLUMNS = [
  "গ্রাহক", "ফোন", "এজেন্ট", "ফলো-আপ সেট", "সম্পন্ন", "বাকি", "সময় পেরিয়েছে",
  "যোগাযোগ", "সংযুক্ত", "প্রথম ফলো-আপ", "শেষ যোগাযোগ", "পরের ফলো-আপ", "অবস্থা", "বন্ধের সময়", "বন্ধের কারণ",
];

const toCells = (r: FollowUpHistoryRow) => [
  r.customer, r.phone, r.agentName, r.followUpsSet, r.followUpsDone, r.followUpsOpen, r.overdue,
  r.contacts, r.connected, fmt(r.firstFollowUpAt), fmt(r.lastContactAt), fmt(r.nextFollowUpAt),
  STATE_LABEL[r.state], fmt(r.stoppedAt), r.stopReason ?? "",
];

const esc = (v: unknown) =>
  String(v ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

export function FollowUpHistoryPanel() {
  const adminToken = useAdminToken();
  const fetchHistory = useServerFn(listFollowUpHistory);
  const [f, setF] = useState<Filters>(defaults);
  const [open, setOpen] = useState<string | null>(null);
  const [month, setMonth] = useState(() => todayDhaka().slice(0, 7));
  const patch = (next: Partial<Filters>) => setF((p) => ({ ...p, ...next }));

  const query = useQuery({
    queryKey: ["follow-up-history", adminToken ? "pin" : "session", f.from, f.to],
    queryFn: () => fetchHistory({ data: { adminToken, from: f.from, to: f.to } }),
  });
  const all = query.data?.rows ?? [];
  const agents = useMemo(
    () => [...new Map(all.filter((r) => r.agentId).map((r) => [r.agentId!, r.agentName])).entries()],
    [all],
  );

  const rows = useMemo(() => {
    const s = f.search.trim().toLowerCase();
    const list = all.filter(
      (r) =>
        (!s || r.customer.toLowerCase().includes(s) || r.phone.includes(s) || (r.stopReason ?? "").toLowerCase().includes(s)) &&
        (!f.agent || r.agentId === f.agent) &&
        (!f.state || r.state === f.state) &&
        (!f.temperature || (r.temperature ?? "").toLowerCase() === f.temperature) &&
        r.followUpsSet >= f.minFollowUps &&
        (!f.day || r.scheduledDays.includes(f.day)),
    );
    const key = (r: FollowUpHistoryRow) =>
      f.sort === "most" ? -r.followUpsSet
      : f.sort === "overdue" ? -r.overdue
      : f.sort === "last" ? -(r.lastContactAt ? Date.parse(r.lastContactAt) : 0)
      : r.nextFollowUpAt ? Date.parse(r.nextFollowUpAt) : Number.MAX_SAFE_INTEGER;
    return list.sort((a, b) => key(a) - key(b));
  }, [all, f]);

  const dayCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of all) for (const d of r.scheduledDays) m.set(d, (m.get(d) ?? 0) + 1);
    return m;
  }, [all]);

  const totals = useMemo(
    () => ({
      leads: rows.length,
      set: rows.reduce((n, r) => n + r.followUpsSet, 0),
      contacts: rows.reduce((n, r) => n + r.contacts, 0),
      overdue: rows.reduce((n, r) => n + r.overdue, 0),
      stopped: rows.filter((r) => r.state === "stopped").length,
    }),
    [rows],
  );

  const stamp = `follow-up-history_${f.from}_to_${f.to}`;

  async function exportExcel() {
    try {
      const { default: writeExcelFile } = await import("write-excel-file/browser");
      const sheet = [
        COLUMNS.map((c) => ({ value: c, fontWeight: "bold" as const })),
        ...rows.map((r) => toCells(r).map((v) => ({ value: typeof v === "number" ? v : String(v).replace(/^([=+\-@])/, "'$1") }))),
      ];
      await writeExcelFile(sheet).toFile(`${stamp}.xlsx`);
    } catch (e) {
      toast.error(`Excel তৈরি করা যায়নি: ${(e as Error).message}`);
    }
  }

  function exportPdf() {
    const w = window.open("", "_blank");
    if (!w) {
      toast.error("পপআপ বন্ধ আছে — ব্রাউজারে পপআপ চালু করুন");
      return;
    }
    const filterText = [
      `তারিখ: ${f.from} — ${f.to}`,
      f.day && `দিন: ${f.day}`,
      f.agent && `এজেন্ট: ${agents.find(([id]) => id === f.agent)?.[1]}`,
      f.state && `অবস্থা: ${STATE_LABEL[f.state as FollowUpHistoryRow["state"]]}`,
      f.temperature && `ক্যাটাগরি: ${f.temperature}`,
      f.search && `খোঁজ: ${f.search}`,
    ].filter(Boolean).join(" · ");
    w.document.write(`<!doctype html><html lang="bn"><head><meta charset="utf-8"><title>${stamp}</title>
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+Bengali:wght@400;700&display=swap" rel="stylesheet">
<style>@page{size:A4 landscape;margin:10mm}body{font-family:'Noto Sans Bengali',sans-serif;font-size:9px;color:#111}
h1{font-size:15px;margin:0 0 4px}p{margin:0 0 8px;color:#555}table{border-collapse:collapse;width:100%}
th,td{border:1px solid #ccc;padding:3px 4px;text-align:left;vertical-align:top}th{background:#f1f1f1}tr{page-break-inside:avoid}</style></head>
<body><h1>ফলো-আপ ইতিহাস — Winstone CRM</h1><p>${esc(filterText)} · লিড ${totals.leads} · ফলো-আপ ${totals.set} · যোগাযোগ ${totals.contacts} · বন্ধ ${totals.stopped}</p>
<table><thead><tr>${COLUMNS.map((c) => `<th>${esc(c)}</th>`).join("")}</tr></thead><tbody>
${rows.map((r) => `<tr>${toCells(r).map((v) => `<td>${esc(v)}</td>`).join("")}</tr>`).join("")}
</tbody></table><script>document.fonts.ready.then(()=>setTimeout(()=>print(),300))</script></body></html>`);
    w.document.close();
  }

  // Month calendar
  const first = new Date(`${month}-01T00:00:00Z`);
  const daysInMonth = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
  const lead = first.getUTCDay();
  const moveMonth = (n: number) => {
    const d = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + n, 1));
    setMonth(d.toISOString().slice(0, 7));
  };

  return (
    <section className="card-elevated space-y-4 p-4">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-bold">ফলো-আপ ইতিহাস</h2>
          <p className="text-xs text-muted-foreground">
            কতবার ফলো-আপ সেট হলো, কতবার যোগাযোগ হলো, কখন ও কেন যোগাযোগ বন্ধ হলো
            {query.data?.scope === "own" ? " — শুধু আপনার লিড" : ""}
          </p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={exportExcel} disabled={!rows.length}>
            <FileSpreadsheet className="size-4" /> Excel
          </Button>
          <Button size="sm" variant="outline" onClick={exportPdf} disabled={!rows.length}>
            <FileDown className="size-4" /> PDF
          </Button>
        </div>
      </header>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <label className="text-xs">শুরুর তারিখ<Input type="date" value={f.from} onChange={(e) => patch({ from: e.target.value })} /></label>
        <label className="text-xs">শেষ তারিখ<Input type="date" value={f.to} onChange={(e) => patch({ to: e.target.value })} /></label>
        <label className="text-xs">খুঁজুন (নাম / ফোন / কারণ)<Input value={f.search} onChange={(e) => patch({ search: e.target.value })} placeholder="যেমন: রহিম বা 017…" /></label>
        <label className="text-xs">এজেন্ট
          <select className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm" value={f.agent} onChange={(e) => patch({ agent: e.target.value })}>
            <option value="">সবাই</option>
            {agents.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
          </select>
        </label>
        <label className="text-xs">অবস্থা
          <select className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm" value={f.state} onChange={(e) => patch({ state: e.target.value })}>
            <option value="">সব</option>
            <option value="active">চলমান</option>
            <option value="overdue">সময় পেরিয়েছে</option>
            <option value="stopped">যোগাযোগ বন্ধ</option>
          </select>
        </label>
        <label className="text-xs">Hot / Warm / Cold
          <select className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm" value={f.temperature} onChange={(e) => patch({ temperature: e.target.value })}>
            <option value="">সব</option>
            <option value="hot">Hot</option>
            <option value="warm">Warm</option>
            <option value="cold">Cold</option>
          </select>
        </label>
        <label className="text-xs">কমপক্ষে কতবার ফলো-আপ
          <Input type="number" min={0} value={f.minFollowUps} onChange={(e) => patch({ minFollowUps: Math.max(0, Number(e.target.value) || 0) })} />
        </label>
        <label className="text-xs">সাজান
          <select className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm" value={f.sort} onChange={(e) => patch({ sort: e.target.value as Filters["sort"] })}>
            <option value="next">পরের ফলো-আপ আগে</option>
            <option value="most">সবচেয়ে বেশি ফলো-আপ</option>
            <option value="overdue">সবচেয়ে বেশি দেরি</option>
            <option value="last">সাম্প্রতিক যোগাযোগ</option>
          </select>
        </label>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[280px_minmax(0,1fr)] [&>*]:min-w-0">
        <div className="min-w-0 rounded-lg border border-border p-3">
          <div className="mb-2 flex items-center justify-between text-sm font-semibold">
            <Button size="icon" variant="ghost" className="size-7" onClick={() => moveMonth(-1)} aria-label="আগের মাস"><ChevronLeft className="size-4" /></Button>
            <span className="flex items-center gap-1"><CalendarDays className="size-4" />{month}</span>
            <Button size="icon" variant="ghost" className="size-7" onClick={() => moveMonth(1)} aria-label="পরের মাস"><ChevronRight className="size-4" /></Button>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center text-[10px] text-muted-foreground">
            {["র", "সো", "ম", "বু", "বৃ", "শু", "শ"].map((d) => <span key={d}>{d}</span>)}
            {Array.from({ length: lead }, (_, i) => <span key={`b${i}`} />)}
            {Array.from({ length: daysInMonth }, (_, i) => {
              const day = `${month}-${String(i + 1).padStart(2, "0")}`;
              const n = dayCounts.get(day) ?? 0;
              const active = f.day === day;
              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => patch({ day: active ? null : day })}
                  className={`rounded-md py-1 text-xs ${active ? "bg-primary text-primary-foreground" : n ? "bg-accent text-accent-foreground" : "text-foreground"} ${day === todayDhaka() ? "ring-1 ring-primary" : ""}`}
                >
                  {i + 1}
                  {n > 0 && <span className="block text-[9px] leading-none">{n}</span>}
                </button>
              );
            })}
          </div>
          {f.day && <Button size="sm" variant="ghost" className="mt-2 w-full" onClick={() => patch({ day: null })}>দিনের ফিল্টার সরান</Button>}
          <Button size="sm" variant="ghost" className="mt-1 w-full" onClick={() => setF(defaults())}><RotateCcw className="size-3.5" /> সব ফিল্টার রিসেট</Button>
        </div>

        <div className="space-y-3">
          <div className="flex flex-wrap gap-2 text-xs">
            <Badge variant="secondary">লিড {totals.leads}</Badge>
            <Badge variant="secondary">ফলো-আপ সেট {totals.set}</Badge>
            <Badge variant="secondary">যোগাযোগ {totals.contacts}</Badge>
            <Badge variant="destructive">সময় পেরিয়েছে {totals.overdue}</Badge>
            <Badge variant="outline">যোগাযোগ বন্ধ {totals.stopped}</Badge>
          </div>

          {query.isLoading ? (
            <p className="text-sm text-muted-foreground">লোড হচ্ছে…</p>
          ) : query.isError ? (
            <p className="text-sm text-destructive">ইতিহাস আনা যায়নি। আবার চেষ্টা করুন।</p>
          ) : !rows.length ? (
            <p className="text-sm text-muted-foreground">এই ফিল্টারে কোনো ফলো-আপ নেই।</p>
          ) : (
            <div className="max-h-[640px] overflow-auto rounded-lg border border-border">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-muted text-left">
                  <tr>
                    <th className="p-2" />
                    <th className="p-2">গ্রাহক</th>
                    <th className="p-2">এজেন্ট</th>
                    <th className="p-2">ফলো-আপ</th>
                    <th className="p-2">যোগাযোগ</th>
                    <th className="p-2">শেষ যোগাযোগ</th>
                    <th className="p-2">পরের ফলো-আপ</th>
                    <th className="p-2">অবস্থা / কারণ</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, 500).map((r) => (
                    <Fragment key={r.leadId}>
                      <tr className="cursor-pointer border-t border-border hover:bg-muted/50" onClick={() => setOpen(open === r.leadId ? null : r.leadId)}>
                        <td className="p-2"><ChevronDown className={`size-3.5 transition-transform ${open === r.leadId ? "rotate-180" : ""}`} /></td>
                        <td className="p-2"><div className="font-semibold">{r.customer}</div><div className="text-muted-foreground">{r.phone}</div></td>
                        <td className="p-2">{r.agentName}</td>
                        <td className="p-2">{r.followUpsSet} বার <span className="text-muted-foreground">({r.followUpsDone} সম্পন্ন)</span></td>
                        <td className="p-2">{r.contacts} বার <span className="text-muted-foreground">({r.connected} সংযুক্ত)</span></td>
                        <td className="p-2">{fmt(r.lastContactAt)}</td>
                        <td className="p-2">{fmt(r.nextFollowUpAt)}</td>
                        <td className="p-2">
                          <Badge variant={r.state === "stopped" ? "outline" : r.state === "overdue" ? "destructive" : "secondary"}>{STATE_LABEL[r.state]}</Badge>
                          {r.stopReason && <div className="mt-1 text-muted-foreground">{r.stopReason}</div>}
                        </td>
                      </tr>
                      {open === r.leadId && (
                        <tr className="bg-muted/30">
                          <td colSpan={8} className="p-3">
                            <ol className="space-y-1 border-l border-border pl-3">
                              {r.events.map((e, i) => (
                                <li key={i}>
                                  <span className="text-muted-foreground">{fmt(e.at)}</span> — <span className="font-medium">{e.label}</span>
                                  {e.detail && <span className="text-muted-foreground"> · {e.detail}</span>}
                                </li>
                              ))}
                            </ol>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  ))}
                </tbody>
              </table>
              {rows.length > 500 && <p className="p-2 text-xs text-muted-foreground">প্রথম ৫০০টি দেখানো হচ্ছে — সবগুলো Excel/PDF-এ পাবেন।</p>}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
