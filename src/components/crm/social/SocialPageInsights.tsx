import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { History, BarChart3, TrendingUp, FileDown } from "lucide-react";
import { useMemo, useState } from "react";
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { socialPageAudit, socialPageDaily, socialPageSummary } from "@/lib/social.functions";
import { useAdminToken } from "@/lib/local-session";
import { useT } from "@/lib/i18n";

const dhakaDate = (ms: number) => new Date(ms + 6 * 3_600_000).toISOString().slice(0, 10);
const dhakaTime = (iso: string) => new Date(new Date(iso).getTime() + 6 * 3_600_000).toISOString().slice(0, 16).replace("T", " ");
const show = (v: unknown) => (v === null || v === undefined || v === "" ? "—" : typeof v === "boolean" ? (v ? "চালু" : "বন্ধ") : String(v));

/** HQ/IT: per page/group results summary. */
export function SocialPageSummaryTable() {
  const t = useT();
  const adminToken = useAdminToken();
  const fn = useServerFn(socialPageSummary);
  const [from, setFrom] = useState(() => dhakaDate(Date.now() - 29 * 86_400_000));
  const [to, setTo] = useState(() => dhakaDate(Date.now()));
  const q = useQuery({
    queryKey: ["social-page-summary", adminToken, from, to],
    queryFn: () => fn({ data: { adminToken, from, to } }),
    enabled: Boolean(adminToken) && Boolean(from) && Boolean(to),
  });
  const rows = q.data ?? [];
  return (
    <section className="card-elevated space-y-3 p-4" aria-labelledby="sps-h">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <h2 id="sps-h" className="flex items-center gap-2 font-semibold">
          <BarChart3 className="size-4 text-primary" /> {t({ bn: "পেজ/গ্রুপভিত্তিক ফলাফল", en: "Results by page/group" })}
        </h2>
        <div className="flex gap-2 text-xs">
          <label className="grid gap-0.5">{t({ bn: "থেকে", en: "From" })}<Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></label>
          <label className="grid gap-0.5">{t({ bn: "পর্যন্ত", en: "To" })}<Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></label>
        </div>
      </div>
      {q.isError ? <p className="text-sm text-destructive">{(q.error as Error).message}</p>
        : q.isLoading ? <p className="text-sm text-muted-foreground">…</p>
        : !rows.length ? <p className="text-sm text-muted-foreground">{t({ bn: "কোনো পেজ নেই", en: "No pages yet" })}</p>
        : (
          <div className="table-scroll">
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-muted-foreground">
                <tr>
                  <th className="p-2">{t({ bn: "পেজ/গ্রুপ", en: "Page/group" })}</th>
                  <th className="p-2 text-right">{t({ bn: "কাজ", en: "Entries" })}</th>
                  <th className="p-2 text-right">{t({ bn: "রিপ্লাই", en: "Replies" })}</th>
                  <th className="p-2 text-right">{t({ bn: "লিড", en: "Leads" })}</th>
                  <th className="p-2 text-right">{t({ bn: "সাইট ভিজিট", en: "Visits" })}</th>
                  <th className="p-2 text-right">{t({ bn: "বুকিং", en: "Bookings" })}</th>
                  <th className="p-2 text-right">{t({ bn: "বন্ধ", en: "Closed" })}</th>
                  <th className="p-2 text-right">{t({ bn: "কনভার্সন", en: "Conversion" })}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.pageId} className="border-t border-border">
                    <td className="p-2 font-medium">{r.name}{!r.active && <span className="ml-1 text-xs text-muted-foreground">({t({ bn: "বন্ধ", en: "disabled" })})</span>}</td>
                    <td className="p-2 text-right">{r.entries}</td>
                    <td className="p-2 text-right">{r.replies}</td>
                    <td className="p-2 text-right">{r.leads}</td>
                    <td className="p-2 text-right">{r.visits}</td>
                    <td className="p-2 text-right">{r.bookings}</td>
                    <td className="p-2 text-right">{r.closed}</td>
                    <td className="p-2 text-right font-semibold">{r.leads ? `${r.conversion}%` : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-2 text-xs text-muted-foreground">{t({ bn: "কনভার্সন = বুকিং হওয়া লিড ÷ মোট লিড (বাতিল বুকিং বাদ)।", en: "Conversion = leads with a booking ÷ leads (rejected bookings excluded)." })}</p>
          </div>
        )}
    </section>
  );
}

const CHART_TOOLTIP = {
  contentStyle: { background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12, fontSize: 12 },
} as const;

const DAY = 86_400_000;
const dayMs = (d: string) => new Date(`${d}T00:00:00Z`).getTime();
const isoDay = (ms: number) => new Date(ms).toISOString().slice(0, 10);
const esc = (s: unknown) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

type Day = { date: string; leads: number; bookings: number };
function aggregate(pages: { pageId: string; points: Day[] }[], pageId: string, from: string, to: string): Day[] {
  const src = pageId === "all" ? pages : pages.filter((p) => p.pageId === pageId);
  const byDay = new Map<string, Day>();
  for (let ms = dayMs(from); ms <= dayMs(to); ms += DAY) { const d = isoDay(ms); byDay.set(d, { date: d, leads: 0, bookings: 0 }); }
  for (const p of src) for (const pt of p.points) {
    const d = byDay.get(pt.date); if (!d) continue;
    d.leads += pt.leads; d.bookings += pt.bookings;
  }
  return [...byDay.values()];
}
const pct = (b: number, l: number) => (l ? Math.round((b / l) * 100) : 0);

/** HQ/IT: date-based trend — leads/conversion per day vs the previous equal-length period, with PDF export. */
export function SocialPageTrendChart() {
  const t = useT();
  const adminToken = useAdminToken();
  const fn = useServerFn(socialPageDaily);
  const sumFn = useServerFn(socialPageSummary);
  const [from, setFrom] = useState(() => dhakaDate(Date.now() - 13 * 86_400_000));
  const [to, setTo] = useState(() => dhakaDate(Date.now()));
  const [pageId, setPageId] = useState<string>("all");
  const valid = Boolean(from) && Boolean(to) && from <= to;
  const span = valid ? Math.round((dayMs(to) - dayMs(from)) / DAY) + 1 : 0;
  const prevTo = valid ? isoDay(dayMs(from) - DAY) : "";
  const prevFrom = valid ? isoDay(dayMs(from) - span * DAY) : "";
  const q = useQuery({
    queryKey: ["social-page-daily", adminToken, from, to],
    queryFn: () => fn({ data: { adminToken, from, to } }),
    enabled: Boolean(adminToken) && valid,
  });
  const qp = useQuery({
    queryKey: ["social-page-daily", adminToken, prevFrom, prevTo],
    queryFn: () => fn({ data: { adminToken, from: prevFrom, to: prevTo } }),
    enabled: Boolean(adminToken) && valid,
  });
  const pages = q.data ?? [];
  const pageOptions = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of [...pages, ...(qp.data ?? [])]) m.set(p.pageId, p.name);
    return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [pages, qp.data]);
  const cur = useMemo(() => (valid ? aggregate(pages, pageId, from, to) : []), [pages, pageId, from, to, valid]);
  const prev = useMemo(() => (valid ? aggregate(qp.data ?? [], pageId, prevFrom, prevTo) : []), [qp.data, pageId, prevFrom, prevTo, valid]);
  const points = cur.map((d, i) => ({
    ...d, conversion: pct(d.bookings, d.leads),
    prevDate: prev[i]?.date ?? "", prevLeads: prev[i]?.leads ?? 0, prevConversion: pct(prev[i]?.bookings ?? 0, prev[i]?.leads ?? 0),
  }));
  const tot = (a: Day[]) => a.reduce((s, d) => ({ leads: s.leads + d.leads, bookings: s.bookings + d.bookings }), { leads: 0, bookings: 0 });
  const tc = tot(cur), tp = tot(prev);
  const delta = (c: number, p: number) => (p ? `${c >= p ? "+" : ""}${Math.round(((c - p) / p) * 100)}%` : c ? "নতুন" : "—");
  const hasData = tc.leads > 0 || tp.leads > 0;
  const labelInterval = Math.max(0, Math.ceil(points.length / 8) - 1);
  const [exporting, setExporting] = useState(false);
  const qPrevSum = useQuery({
    queryKey: ["social-page-summary", adminToken, prevFrom, prevTo],
    queryFn: () => sumFn({ data: { adminToken, from: prevFrom, to: prevTo } }),
    enabled: Boolean(adminToken) && valid,
  });
  const qCurSum = useQuery({
    queryKey: ["social-page-summary", adminToken, from, to],
    queryFn: () => sumFn({ data: { adminToken, from, to } }),
    enabled: Boolean(adminToken) && valid,
  });

  const setPreset = (days: number) => {
    setTo(dhakaDate(Date.now()));
    setFrom(dhakaDate(Date.now() - (days - 1) * 86_400_000));
  };

  const csvEsc = (v: unknown) => { const s = String(v ?? ""); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const exportCsv = () => {
    const rows: string[] = ["date,leads,bookings,conversion_pct,prev_date,prev_leads,prev_conversion_pct"];
    for (const p of points) rows.push([p.date, p.leads, p.bookings, p.leads ? p.conversion : "", p.prevDate, p.prevLeads, p.prevLeads ? p.prevConversion : ""].map(csvEsc).join(","));
    const blob = new Blob(["﻿" + rows.join("\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `social-chart-${pageId === "all" ? "all" : pageId}-${from}-${to}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const exportPdf = async () => {
    const w = window.open("", "_blank");
    if (!w) return;
    setExporting(true);
    try {
      const summary = await sumFn({ data: { adminToken, from, to } });
      const pageName = pageId === "all" ? "সব পেজ/গ্রুপ" : pageOptions.find(([id]) => id === pageId)?.[1] ?? "";
      const rowsS = (pageId === "all" ? summary : summary.filter((r) => r.pageId === pageId));
      w.document.write(`<!doctype html><html lang="bn"><head><meta charset="utf-8"><title>Social report ${esc(from)} – ${esc(to)}</title>
<style>body{font-family:"Noto Sans Bengali","Hind Siliguri",system-ui,sans-serif;color:#111;margin:24px;font-size:12px}h1{font-size:18px;margin:0}h2{font-size:14px;margin:18px 0 6px}
table{border-collapse:collapse;width:100%}th,td{border:1px solid #ccc;padding:4px 6px;text-align:right}th:first-child,td:first-child{text-align:left}th{background:#f3f4f6}
.muted{color:#555}.kpi{display:flex;gap:12px;margin-top:10px}.kpi div{border:1px solid #ccc;border-radius:6px;padding:8px;flex:1}@media print{button{display:none}}</style></head><body>
<h1>WINSTONE PULSE — সোশ্যাল পেজ/গ্রুপ রিপোর্ট</h1>
<p class="muted">সময়সীমা: ${esc(from)} – ${esc(to)} (${span} দিন) · তুলনা: ${esc(prevFrom)} – ${esc(prevTo)} · পেজ/গ্রুপ: ${esc(pageName)} · তৈরি: ${esc(dhakaTime(new Date().toISOString()))} (ঢাকা)</p>
<div class="kpi"><div>লিড<br><b>${tc.leads}</b> <span class="muted">(আগে ${tp.leads}, ${esc(delta(tc.leads, tp.leads))})</span></div>
<div>বুকিং<br><b>${tc.bookings}</b> <span class="muted">(আগে ${tp.bookings})</span></div>
<div>কনভার্সন<br><b>${pct(tc.bookings, tc.leads)}%</b> <span class="muted">(আগে ${pct(tp.bookings, tp.leads)}%)</span></div></div>
<h2>পেজ/গ্রুপভিত্তিক ফলাফল</h2><table><thead><tr><th>পেজ/গ্রুপ</th><th>কাজ</th><th>রিপ্লাই</th><th>লিড</th><th>সাইট ভিজিট</th><th>বুকিং</th><th>বন্ধ</th><th>কনভার্সন</th></tr></thead><tbody>
${rowsS.map((r) => `<tr><td>${esc(r.name)}${r.active ? "" : " (বন্ধ)"}</td><td>${r.entries}</td><td>${r.replies}</td><td>${r.leads}</td><td>${r.visits}</td><td>${r.bookings}</td><td>${r.closed}</td><td>${r.leads ? r.conversion + "%" : "—"}</td></tr>`).join("") || `<tr><td colspan="8">কোনো তথ্য নেই</td></tr>`}
</tbody></table>
<h2>দৈনিক তুলনা</h2><table><thead><tr><th>তারিখ</th><th>লিড</th><th>কনভার্সন</th><th>আগের তারিখ</th><th>আগের লিড</th><th>আগের কনভার্সন</th></tr></thead><tbody>
${points.map((p) => `<tr><td>${esc(p.date)}</td><td>${p.leads}</td><td>${p.leads ? p.conversion + "%" : "—"}</td><td>${esc(p.prevDate)}</td><td>${p.prevLeads}</td><td>${p.prevLeads ? p.prevConversion + "%" : "—"}</td></tr>`).join("")}
</tbody></table>
<p class="muted">কনভার্সন = বুকিং হওয়া লিড ÷ মোট লিড (বাতিল বুকিং বাদ)। কেবল সংরক্ষিত রেকর্ড থেকে।</p>
<button onclick="print()">PDF হিসেবে সংরক্ষণ / প্রিন্ট</button><script>setTimeout(()=>print(),400)</script></body></html>`);
      w.document.close();
    } catch (e) {
      w.close();
      alert((e as Error).message);
    } finally { setExporting(false); }
  };

  return (
    <section className="card-elevated space-y-3 p-4" aria-labelledby="spt-h">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <h2 id="spt-h" className="flex items-center gap-2 font-semibold">
          <TrendingUp className="size-4 text-primary" /> {t({ bn: "তারিখভিত্তিক লিড ও কনভার্সন চার্ট", en: "Daily leads & conversion chart" })}
        </h2>
        <div className="flex flex-wrap items-end gap-2 text-xs">
          <div className="flex gap-1" role="group" aria-label={t({ bn: "দ্রুত তারিখসীমা", en: "Quick range" })}>
            {[7, 30, 90].map((d) => (
              <Button key={d} size="sm" variant="outline" onClick={() => setPreset(d)}>{d} {t({ bn: "দিন", en: "days" })}</Button>
            ))}
          </div>
          <label className="grid gap-0.5">{t({ bn: "পেজ/গ্রুপ", en: "Page/group" })}
            <select className="h-9 rounded-md border border-input bg-background px-2 text-sm" value={pageId} onChange={(e) => setPageId(e.target.value)}>
              <option value="all">{t({ bn: "সব পেজ/গ্রুপ", en: "All pages/groups" })}</option>
              {pageOptions.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
            </select>
          </label>
          <label className="grid gap-0.5">{t({ bn: "থেকে", en: "From" })}<Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></label>
          <label className="grid gap-0.5">{t({ bn: "পর্যন্ত", en: "To" })}<Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></label>
          <Button size="sm" variant="outline" onClick={exportCsv} disabled={!valid || !q.data}>
            <FileDown className="size-4" /> {t({ bn: "CSV", en: "CSV" })}
          </Button>
          <Button size="sm" variant="outline" onClick={exportPdf} disabled={!valid || exporting || !q.data}>
            <FileDown className="size-4" /> {exporting ? "…" : t({ bn: "PDF রিপোর্ট", en: "PDF report" })}
          </Button>
        </div>
      </div>
      {valid && (
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="rounded-lg border border-border p-2">
            <p className="text-xs text-muted-foreground">{t({ bn: "লিড", en: "Leads" })}</p>
            <p className="font-semibold">{tc.leads} <span className="text-xs font-normal text-muted-foreground">{t({ bn: "আগে", en: "prev" })} {tp.leads} · {delta(tc.leads, tp.leads)}</span></p>
          </div>
          <div className="rounded-lg border border-border p-2">
            <p className="text-xs text-muted-foreground">{t({ bn: "কনভার্সন", en: "Conversion" })}</p>
            <p className="font-semibold">{pct(tc.bookings, tc.leads)}% <span className="text-xs font-normal text-muted-foreground">{t({ bn: "আগে", en: "prev" })} {pct(tp.bookings, tp.leads)}%</span></p>
          </div>
          <p className="col-span-2 text-xs text-muted-foreground">{t({ bn: "তুলনার সময়সীমা", en: "Compared with" })}: {prevFrom} – {prevTo}</p>
        </div>
      )}
      {!valid ? <p className="text-sm text-destructive">{t({ bn: "সঠিক তারিখসীমা দিন", en: "Choose a valid date range" })}</p>
        : q.isError ? <p className="text-sm text-destructive">{(q.error as Error).message}</p>
        : q.isLoading ? <p className="text-sm text-muted-foreground">…</p>
        : !hasData ? <p className="text-sm text-muted-foreground">{t({ bn: "এই সময়ে কোনো লিড নেই", en: "No leads in this range" })}</p>
        : (
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={points} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
                <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} interval={labelInterval} tickFormatter={(d: string) => d.slice(5)} />
                <YAxis yAxisId="leads" tick={{ fontSize: 11 }} allowDecimals={false} />
                <YAxis yAxisId="conv" orientation="right" tick={{ fontSize: 11 }} unit="%" domain={[0, 100]} />
                <Tooltip {...CHART_TOOLTIP} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Line yAxisId="leads" type="monotone" dataKey="leads" name={t({ bn: "লিড", en: "Leads" })} stroke="var(--primary)" strokeWidth={2} dot={{ r: 2 }} />
                <Line yAxisId="leads" type="monotone" dataKey="prevLeads" name={t({ bn: "আগের লিড", en: "Prev leads" })} stroke="var(--muted-foreground)" strokeWidth={1.5} strokeOpacity={0.6} dot={false} />
                <Line yAxisId="conv" type="monotone" dataKey="conversion" name={t({ bn: "কনভার্সন %", en: "Conversion %" })} stroke="var(--chart-2, #16a34a)" strokeWidth={2} strokeDasharray="5 3" dot={{ r: 2 }} />
                <Line yAxisId="conv" type="monotone" dataKey="prevConversion" name={t({ bn: "আগের কনভার্সন %", en: "Prev conversion %" })} stroke="var(--chart-2, #16a34a)" strokeOpacity={0.4} strokeWidth={1.5} strokeDasharray="2 3" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      <p className="text-xs text-muted-foreground">{t({ bn: "কনভার্সন = বুকিং হওয়া লিড ÷ ওই দিনের লিড (বাতিল বুকিং বাদ)। ধূসর/হালকা রেখা = আগের সমান সময়সীমা।", en: "Conversion = booked leads ÷ that day's leads (rejected bookings excluded). Faint lines = previous equal period." })}</p>
    </section>
  );
}

/** HQ/IT: who changed page/group name, link or active state, and when. */
export function SocialPageAuditLog() {
  const t = useT();
  const adminToken = useAdminToken();
  const fn = useServerFn(socialPageAudit);
  const q = useQuery({ queryKey: ["social-page-audit", adminToken], queryFn: () => fn({ data: { adminToken } }), enabled: Boolean(adminToken) });
  const rows = q.data ?? [];
  const fieldLabel: Record<string, { bn: string; en: string }> = {
    name: { bn: "নাম", en: "Name" }, url: { bn: "লিংক", en: "Link" }, active: { bn: "অবস্থা", en: "Status" }, kind: { bn: "ধরন", en: "Type" },
  };
  return (
    <section className="card-elevated space-y-3 p-4" aria-labelledby="spa-h">
      <h2 id="spa-h" className="flex items-center gap-2 font-semibold">
        <History className="size-4 text-primary" /> {t({ bn: "পরিবর্তনের অডিট লগ", en: "Change audit log" })}
      </h2>
      {q.isError ? <p className="text-sm text-destructive">{(q.error as Error).message}</p>
        : q.isLoading ? <p className="text-sm text-muted-foreground">…</p>
        : !rows.length ? <p className="text-sm text-muted-foreground">{t({ bn: "এখনো কোনো পরিবর্তন রেকর্ড হয়নি", en: "No changes recorded yet" })}</p>
        : (
          <ol className="space-y-2">
            {rows.map((r) => (
              <li key={r.id} className="rounded-lg border border-border p-2 text-sm">
                <p className="flex flex-wrap justify-between gap-1">
                  <span className="font-medium">{r.pageName} · {r.action === "social_page_created" ? t({ bn: "তৈরি", en: "Created" }) : t({ bn: "পরিবর্তিত", en: "Updated" })}</span>
                  <span className="text-xs text-muted-foreground">{dhakaTime(r.at)} · {r.by}</span>
                </p>
                <ul className="mt-1 text-xs text-muted-foreground">
                  {r.changes.map((c) => (
                    <li key={c.field} className="break-all">{t(fieldLabel[c.field] ?? { bn: c.field, en: c.field })}: {show(c.from)} → <b className="text-foreground">{show(c.to)}</b></li>
                  ))}
                </ul>
              </li>
            ))}
          </ol>
        )}
    </section>
  );
}
