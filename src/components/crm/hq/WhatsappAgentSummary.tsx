import { useState } from "react";
import { format } from "date-fns";
import type { DateRange } from "react-day-picker";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CalendarIcon, Download, Loader2, MessageCircle, RefreshCw, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { listWhatsappCallAttempts } from "@/lib/call-reports.functions";
import { fullDateTime } from "@/lib/crm-format";
import { useT } from "@/lib/i18n";
import { useAdminToken } from "@/lib/local-session";
import { summarizeWhatsappAttempts, whatsappSummaryCsv } from "@/lib/whatsapp-attempt-summary";
import { filterWhatsappAttempts } from "@/lib/whatsapp-attempt-filters";

export function WhatsappAgentSummary() {
  const t = useT();
  const [range, setRange] = useState<DateRange>();
  const adminToken = useAdminToken();
  const fetchAttempts = useServerFn(listWhatsappCallAttempts);
  const { data, isPending, isError, isFetching, refetch } = useQuery({
    queryKey: ["whatsapp-call-attempts", adminToken ? "pin" : "session"],
    queryFn: () => fetchAttempts({ data: { adminToken } }),
    refetchInterval: 60_000,
  });
  const from = range?.from ? format(range.from, "yyyy-MM-dd") : "";
  const to = range?.to ? format(range.to, "yyyy-MM-dd") : from;
  const attempts = filterWhatsappAttempts(data?.attempts ?? [], { from, to, agent: "", status: "all" });
  const rows = summarizeWhatsappAttempts(attempts);
  const exportCsv = () => {
    const url = URL.createObjectURL(new Blob([whatsappSummaryCsv(rows, from, to)], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `winstone-whatsapp-agent-summary-${from || "all"}-${to || "all"}.csv`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const submitted = attempts.filter((a) => a.submitted).length;
  const labels = {
    agent: t({ bn: "এজেন্ট", en: "Agent" }),
    attempts: t({ bn: "কলের চেষ্টা", en: "Attempts" }),
    submitted: t({ bn: "রিপোর্ট জমা", en: "Submitted" }),
    pending: t({ bn: "রিপোর্ট বাকি", en: "Pending" }),
    last: t({ bn: "সর্বশেষ চেষ্টা", en: "Last attempt" }),
  };
  const title = t({ bn: "এজেন্টভিত্তিক WhatsApp সারাংশ", en: "WhatsApp activity by agent" });
  return (
    <section className="space-y-4" aria-label={title}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="flex items-start gap-2 text-lg font-semibold"><MessageCircle className="mt-1 size-5 shrink-0 text-primary" />{title}</h2>
          <p className="mt-1 text-xs text-muted-foreground">{t({ bn: "সর্বশেষ ৩০০টি নথিভুক্ত চেষ্টা · ঢাকা সময় · কল সংযুক্ত হওয়ার প্রমাণ নয়", en: "Latest 300 logged attempts · Dhaka time · not proof of a connected call" })}</p>
        </div>
        <Button variant="ghost" size="icon" disabled={isFetching} onClick={() => void refetch()} title={t({ bn: "হালনাগাদ", en: "Refresh" })} aria-label={t({ bn: "হালনাগাদ", en: "Refresh" })}><RefreshCw className={`size-4 ${isFetching ? "animate-spin" : ""}`} /></Button>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="min-w-0" aria-label={t({ bn: "সারাংশের তারিখের পরিসর", en: "Summary date range" })}>
              <CalendarIcon className="size-4 shrink-0" />
              <span className="truncate">{from ? `${from} – ${to}` : t({ bn: "সব তারিখ", en: "All dates" })}</span>
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-auto p-0">
            <Calendar mode="range" selected={range} onSelect={setRange} className="pointer-events-auto" />
          </PopoverContent>
        </Popover>
        <Button variant="ghost" size="icon" disabled={!range?.from} onClick={() => setRange(undefined)} aria-label={t({ bn: "সারাংশের ফিল্টার সরান", en: "Reset summary filter" })} title={t({ bn: "সারাংশের ফিল্টার সরান", en: "Reset summary filter" })}><RotateCcw className="size-4" /></Button>
        <Button variant="outline" size="sm" disabled={isPending || isError || !rows.length} onClick={exportCsv}><Download className="size-4" />{t({ bn: "সারাংশ CSV রপ্তানি", en: "Export summary CSV" })}</Button>
      </div>
      {isPending ? <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" />{t({ bn: "লোড হচ্ছে…", en: "Loading…" })}</p>
        : isError ? <p role="alert" className="text-sm text-destructive">{t({ bn: "WhatsApp সারাংশ লোড করা যায়নি।", en: "WhatsApp activity could not be loaded." })}</p>
        : <>
          <dl className="grid grid-cols-3 divide-x divide-border border-y border-border py-3">
            {[{ label: labels.attempts, value: attempts.length }, { label: labels.submitted, value: submitted }, { label: labels.pending, value: attempts.length - submitted }].map((item) => <div key={item.label} className="px-2 first:pl-0"><dt className="text-xs text-muted-foreground">{item.label}</dt><dd className="mt-1 text-xl font-semibold tabular-nums">{item.value}</dd></div>)}
          </dl>
          {rows.length === 0 ? <p className="py-3 text-sm text-muted-foreground">{from ? t({ bn: "এই তারিখের পরিসরে কোনো WhatsApp কলের চেষ্টা নেই।", en: "No WhatsApp call attempts in this date range." }) : t({ bn: "এখনো কোনো WhatsApp কলের চেষ্টা নেই।", en: "No WhatsApp call attempts yet." })}</p> : <>
            <div className="table-scroll hidden md:block"><table className="w-full text-sm"><thead><tr className="border-b border-border text-left text-xs text-muted-foreground">{Object.values(labels).map((label) => <th key={label} className="px-2 py-2 font-medium first:pl-0">{label}</th>)}</tr></thead><tbody>{rows.map((row) => <tr key={row.agentName ?? "unknown"} className="border-b border-border last:border-0"><td className="py-3 pr-2 font-medium">{row.agentName ?? t({ bn: "অজানা এজেন্ট", en: "Unknown agent" })}</td><td className="px-2 tabular-nums">{row.attempts}</td><td className="px-2 tabular-nums">{row.submitted}</td><td className={`px-2 tabular-nums ${row.pending ? "font-semibold text-destructive" : "text-muted-foreground"}`}>{row.pending}</td><td className="px-2 text-xs text-muted-foreground">{fullDateTime(row.lastAttemptAt)}</td></tr>)}</tbody></table></div>
            <ul className="grid gap-2 md:hidden">{rows.map((row) => <li key={row.agentName ?? "unknown"} className="space-y-2 rounded-lg border border-border p-3"><p className="text-sm font-semibold">{row.agentName ?? t({ bn: "অজানা এজেন্ট", en: "Unknown agent" })}</p><dl className="grid grid-cols-3 gap-2 text-xs">{[{ label: labels.attempts, value: row.attempts }, { label: labels.submitted, value: row.submitted }, { label: labels.pending, value: row.pending }].map((item) => <div key={item.label}><dt className="text-muted-foreground">{item.label}</dt><dd className="mt-1 text-base font-semibold tabular-nums">{item.value}</dd></div>)}</dl><p className="text-xs text-muted-foreground">{labels.last}: {fullDateTime(row.lastAttemptAt)}</p></li>)}</ul>
          </>}
        </>}
    </section>
  );
}
