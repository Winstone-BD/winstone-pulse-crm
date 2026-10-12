import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { History, BarChart3, TrendingUp } from "lucide-react";
import { useMemo, useState } from "react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

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

/** HQ/IT: date-based trend — leads per day and conversion % for one page/group or all combined. */
export function SocialPageTrendChart() {
  const t = useT();
  const adminToken = useAdminToken();
  const fn = useServerFn(socialPageDaily);
  const [from, setFrom] = useState(() => dhakaDate(Date.now() - 13 * 86_400_000));
  const [to, setTo] = useState(() => dhakaDate(Date.now()));
  const [pageId, setPageId] = useState<string>("all");
  const q = useQuery({
    queryKey: ["social-page-daily", adminToken, from, to],
    queryFn: () => fn({ data: { adminToken, from, to } }),
    enabled: Boolean(adminToken) && Boolean(from) && Boolean(to),
  });
  const pages = q.data ?? [];
  const points = useMemo(() => {
    const src = pageId === "all" ? pages : pages.filter((p) => p.pageId === pageId);
    const byDay = new Map<string, { date: string; leads: number; bookings: number }>();
    for (const p of src)
      for (const pt of p.points) {
        const d = byDay.get(pt.date) ?? { date: pt.date, leads: 0, bookings: 0 };
        d.leads += pt.leads; d.bookings += pt.bookings;
        byDay.set(pt.date, d);
      }
    return [...byDay.values()].sort((a, b) => a.date.localeCompare(b.date))
      .map((d) => ({ ...d, conversion: d.leads ? Math.round((d.bookings / d.leads) * 100) : 0 }));
  }, [pages, pageId]);
  const labelInterval = Math.max(0, Math.ceil(points.length / 8) - 1);
  return (
    <section className="card-elevated space-y-3 p-4" aria-labelledby="spt-h">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <h2 id="spt-h" className="flex items-center gap-2 font-semibold">
          <TrendingUp className="size-4 text-primary" /> {t({ bn: "তারিখভিত্তিক লিড ও কনভার্সন চার্ট", en: "Daily leads & conversion chart" })}
        </h2>
        <div className="flex flex-wrap gap-2 text-xs">
          <label className="grid gap-0.5">{t({ bn: "পেজ/গ্রুপ", en: "Page/group" })}
            <select className="h-9 rounded-md border border-input bg-background px-2 text-sm" value={pageId} onChange={(e) => setPageId(e.target.value)}>
              <option value="all">{t({ bn: "সব পেজ/গ্রুপ", en: "All pages/groups" })}</option>
              {pages.map((p) => <option key={p.pageId} value={p.pageId}>{p.name}</option>)}
            </select>
          </label>
          <label className="grid gap-0.5">{t({ bn: "থেকে", en: "From" })}<Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></label>
          <label className="grid gap-0.5">{t({ bn: "পর্যন্ত", en: "To" })}<Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></label>
        </div>
      </div>
      {q.isError ? <p className="text-sm text-destructive">{(q.error as Error).message}</p>
        : q.isLoading ? <p className="text-sm text-muted-foreground">…</p>
        : !points.length ? <p className="text-sm text-muted-foreground">{t({ bn: "এই সময়ে কোনো লিড নেই", en: "No leads in this range" })}</p>
        : (
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={points} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
                <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} interval={labelInterval} tickFormatter={(d: string) => d.slice(5)} />
                <YAxis yAxisId="leads" tick={{ fontSize: 11 }} allowDecimals={false} />
                <YAxis yAxisId="conv" orientation="right" tick={{ fontSize: 11 }} unit="%" domain={[0, 100]} />
                <Tooltip {...CHART_TOOLTIP} />
                <Line yAxisId="leads" type="monotone" dataKey="leads" name={t({ bn: "লিড", en: "Leads" })} stroke="var(--primary)" strokeWidth={2} dot={{ r: 2 }} />
                <Line yAxisId="conv" type="monotone" dataKey="conversion" name={t({ bn: "কনভার্সন %", en: "Conversion %" })} stroke="var(--chart-2, #16a34a)" strokeWidth={2} strokeDasharray="5 3" dot={{ r: 2 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      <p className="text-xs text-muted-foreground">{t({ bn: "কনভার্সন = বুকিং হওয়া লিড ÷ ওই দিনের লিড (বাতিল বুকিং বাদ)।", en: "Conversion = booked leads ÷ that day's leads (rejected bookings excluded)." })}</p>
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
