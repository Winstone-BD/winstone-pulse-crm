import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";

import { dhakaDate } from "@/lib/handover-due";
import { getAdminToken } from "@/lib/local-session";
import { getDailySheet, syncDailySheetToGoogle } from "@/lib/pipeline-intel.functions";
import { sheetCsv } from "@/lib/pipeline-intel";

export const Route = createFileRoute("/daily-sheet")({
  head: () => ({
    meta: [
      { title: "Daily Report Sheet — WINSTONE PULSE" },
      { name: "description", content: "HQ daily sheet with one row per lead: calls, site visits, bookings and payment status for a chosen Dhaka date." },
      { property: "og:title", content: "Daily Report Sheet — WINSTONE PULSE" },
      { property: "og:description", content: "One row per lead tracking visits, bookings and payments." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  ssr: false,
  component: DailySheet,
});

function DailySheet() {
  const [date, setDate] = useState(() => dhakaDate(new Date()));
  const run = useServerFn(getDailySheet);
  const q = useQuery({ queryKey: ["daily-sheet", date], queryFn: () => run({ data: { token: getAdminToken(), date } }) });
  const sync = useServerFn(syncDailySheetToGoogle);
  const [syncMsg, setSyncMsg] = useState<{ ok: boolean; text: string; url?: string } | null>(null);
  const [syncing, setSyncing] = useState(false);
  const pushToGoogle = async () => {
    setSyncing(true); setSyncMsg(null);
    try {
      const r = await sync({ data: { token: getAdminToken(), date } });
      setSyncMsg({ ok: true, text: `${r.rows} rows written to Google Sheets (tab ${date}).`, url: r.url });
    } catch (e) {
      setSyncMsg({ ok: false, text: e instanceof Error ? e.message : "Sync failed" });
    } finally { setSyncing(false); }
  };
  const download = () => {
    if (!q.data) return;
    const url = URL.createObjectURL(new Blob(["\uFEFF" + sheetCsv(q.data)], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a"); a.href = url; a.download = `winstone-daily-${date}.csv`; a.click(); URL.revokeObjectURL(url);
  };
  return (
    <main className="mx-auto max-w-6xl px-4 py-6">
      <header className="flex flex-wrap items-end justify-between gap-3 border-b border-border pb-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">WINSTONE PULSE · HQ</p>
          <h1 className="text-2xl font-semibold">Daily report sheet</h1>
          <p className="text-sm text-muted-foreground">One row per lead with a submitted call, site visit or booking on this Dhaka date.</p>
        </div>
        <div className="flex items-center gap-2">
          <input type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} className="rounded-md border border-border bg-background px-2 py-1 text-sm" aria-label="Report date" />
          <button onClick={download} disabled={!q.data?.length} className="rounded-md border border-primary px-3 py-1.5 text-sm font-semibold text-primary disabled:opacity-50">Download CSV</button>
          <button onClick={pushToGoogle} disabled={syncing} className="rounded-md bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground disabled:opacity-50">{syncing ? "Syncing…" : "Sync to Google Sheets"}</button>
        </div>
      </header>
      {syncMsg ? <p className={`mt-3 text-sm ${syncMsg.ok ? "text-primary" : "text-destructive"}`}>{syncMsg.text} {syncMsg.url ? <a href={syncMsg.url} target="_blank" rel="noreferrer" className="underline">Open sheet</a> : null}</p> : null}
      <p className="mt-2 text-xs text-muted-foreground">The CRM also refreshes today's Google Sheet tab automatically every evening.</p>
      {q.isError ? <p className="mt-4 text-sm text-destructive">{(q.error as Error).message}</p> : null}
      {q.isLoading ? <p className="mt-4 text-sm text-muted-foreground">Loading…</p> : null}
      {q.data && q.data.length === 0 ? <p className="mt-4 text-sm text-muted-foreground">No lead activity recorded on {date}.</p> : null}
      {q.data && q.data.length > 0 ? (
        <div className="table-scroll mt-4">
          <table className="w-full min-w-[860px] border-collapse text-xs">
            <thead><tr>{["Lead", "Agent", "Status", "Stage", "Visits", "Completed", "Bookings", "Payment", "Last activity"].map((h) => <th key={h} className="border border-border bg-muted p-2 text-left">{h}</th>)}</tr></thead>
            <tbody>
              {q.data.map((r) => (
                <tr key={r.leadId}>
                  <td className="border border-border p-2"><b>{r.lead}</b><br />{r.phone}</td>
                  <td className="border border-border p-2">{r.agent ?? "Unassigned"}</td>
                  <td className="border border-border p-2">{r.status}</td>
                  <td className="border border-border p-2 capitalize">{r.stage}</td>
                  <td className="border border-border p-2">{r.visits}</td>
                  <td className="border border-border p-2">{r.visitsCompleted}</td>
                  <td className="border border-border p-2">{r.bookings}</td>
                  <td className="border border-border p-2">{r.paymentStatus}</td>
                  <td className="border border-border p-2">{r.lastActivity ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </main>
  );
}
