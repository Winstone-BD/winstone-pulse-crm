import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CalendarDays, Download, FolderKanban, Phone, TicketCheck, Users } from "lucide-react";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getProjectReport } from "@/lib/project-reports.functions";
import { projectReportCsv } from "@/lib/project-reports";
import { downloadCsv } from "@/lib/crm-reports";
import { useAdminToken } from "@/lib/local-session";

function dhakaToday() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Dhaka",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export function ProjectReportPanel() {
  const adminToken = useAdminToken();
  const fetchReport = useServerFn(getProjectReport);
  const [period, setPeriod] = useState<"day" | "month">("day");
  const today = useMemo(dhakaToday, []);
  const [day, setDay] = useState(today);
  const [month, setMonth] = useState(today.slice(0, 7));
  const key = period === "day" ? day : month;

  const report = useQuery({
    queryKey: ["project-report", period, key, adminToken ? "pin" : "session"],
    queryFn: () => fetchReport({ data: { adminToken, period, key } }),
    staleTime: 30_000,
  });
  const rows = report.data?.rows ?? [];
  const hasActivity = rows.some((row) => row.leads || row.calls || row.siteVisits || row.bookings);

  return (
    <section className="space-y-4 border-t border-border pt-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-bold">
            <FolderKanban className="size-5 text-primary" /> প্রজেক্ট রিপোর্ট
          </h2>
          <p className="text-sm text-muted-foreground">
            Inventory requirement অনুযায়ী সংরক্ষিত lead ও call outcome
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-md border border-border p-0.5" aria-label="রিপোর্ট সময়কাল">
            <Button size="sm" variant={period === "day" ? "secondary" : "ghost"} onClick={() => setPeriod("day")}>
              দৈনিক
            </Button>
            <Button size="sm" variant={period === "month" ? "secondary" : "ghost"} onClick={() => setPeriod("month")}>
              মাসিক
            </Button>
          </div>
          <Input
            className="w-40"
            type={period === "day" ? "date" : "month"}
            value={key}
            onChange={(event) => period === "day" ? setDay(event.target.value) : setMonth(event.target.value)}
            aria-label={period === "day" ? "রিপোর্ট তারিখ" : "রিপোর্ট মাস"}
          />
          <Button
            size="sm"
            variant="outline"
            disabled={!rows.length}
            onClick={() => downloadCsv(`winstone-project-${period}-${key}.csv`, projectReportCsv(rows))}
          >
            <Download className="size-4" /> CSV
          </Button>
        </div>
      </div>

      {report.isPending ? (
        <div className="rounded-md border border-border bg-card p-6 text-center text-sm text-muted-foreground">রিপোর্ট লোড হচ্ছে…</div>
      ) : report.error ? (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">{(report.error as Error).message}</div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
            <Metric icon={<Users className="size-4" />} label="লিড" value={report.data?.totals.leads ?? 0} />
            <Metric icon={<Phone className="size-4" />} label="কল" value={report.data?.totals.calls ?? 0} />
            <Metric icon={<CalendarDays className="size-4" />} label="সাইট ভিজিট সংকেত" value={report.data?.totals.siteVisits ?? 0} />
            <Metric icon={<TicketCheck className="size-4" />} label="বুকিং" value={report.data?.totals.bookings ?? 0} />
          </div>

          <div className="overflow-x-auto rounded-md border border-border bg-card">
            <table className="w-full min-w-[680px] text-sm">
              <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
                <tr>
                  <th className="px-3 py-2.5 font-semibold">Inventory project / requirement</th>
                  <th className="px-3 py-2.5 text-right font-semibold">লিড</th>
                  <th className="px-3 py-2.5 text-right font-semibold">কল</th>
                  <th className="px-3 py-2.5 text-right font-semibold">সাইট ভিজিট সংকেত</th>
                  <th className="px-3 py-2.5 text-right font-semibold">বুকিং</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.projectId} className="border-t border-border/70">
                    <td className="px-3 py-2.5 font-medium">
                      {row.project}
                      {!row.active ? <span className="ml-2 text-xs text-muted-foreground">Inactive</span> : null}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{row.leads}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{row.calls}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{row.siteVisits}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{row.bookings}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!rows.length ? <p className="p-6 text-center text-sm text-muted-foreground">Inventory-তে কোনো project/requirement নেই।</p> : null}
          </div>
          {!hasActivity && rows.length ? (
            <p className="text-center text-sm text-muted-foreground">এই সময়ে কোনো project activity পাওয়া যায়নি।</p>
          ) : null}
          <p className="text-xs text-muted-foreground">
            সাইট ভিজিট সংখ্যা explicit “Site Visit Interested/Arrange Site Visit” signal; বুকিং শুধু “Closed / Converted” report।
          </p>
        </>
      )}
    </section>
  );
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="rounded-md border border-border bg-card p-3">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">{icon}{label}</div>
      <p className="mt-1 text-xl font-bold tabular-nums">{value}</p>
    </div>
  );
}