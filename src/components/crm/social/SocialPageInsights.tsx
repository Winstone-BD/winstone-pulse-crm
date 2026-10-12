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
