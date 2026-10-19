import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, MessageCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { listWhatsappCallAttempts } from "@/lib/call-reports.functions";
import { fullDateTime } from "@/lib/crm-format";
import { useT } from "@/lib/i18n";
import { useAdminToken } from "@/lib/local-session";
import { summarizeWhatsappAttempts } from "@/lib/whatsapp-attempt-summary";

export function WhatsappAgentSummary() {
  const t = useT();
  const adminToken = useAdminToken();
  const fetchAttempts = useServerFn(listWhatsappCallAttempts);
  const { data, isPending, isError, isFetching, refetch } = useQuery({
    queryKey: ["whatsapp-call-attempts", adminToken ? "pin" : "session"],
    queryFn: () => fetchAttempts({ data: { adminToken } }),
    refetchInterval: 60_000,
  });
  const attempts = data?.attempts ?? [];
  const rows = summarizeWhatsappAttempts(attempts);
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
          <p className="mt-1 text-xs text-muted-foreground">{t({ bn: "সর্বশেষ ৩০০টি নথিভুক্ত চেষ্টা · কল সংযুক্ত হওয়ার প্রমাণ নয়", en: "Latest 300 logged attempts · not proof of a connected call" })}</p>
        </div>
        <Button variant="ghost" size="icon" disabled={isFetching} onClick={() => void refetch()} title={t({ bn: "হালনাগাদ", en: "Refresh" })} aria-label={t({ bn: "হালনাগাদ", en: "Refresh" })}><RefreshCw className={`size-4 ${isFetching ? "animate-spin" : ""}`} /></Button>
      </div>
      {isPending ? <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" />{t({ bn: "লোড হচ্ছে…", en: "Loading…" })}</p>
        : isError ? <p role="alert" className="text-sm text-destructive">{t({ bn: "WhatsApp সারাংশ লোড করা যায়নি।", en: "WhatsApp activity could not be loaded." })}</p>
        : <>
          <dl className="grid grid-cols-3 divide-x divide-border border-y border-border py-3">
            {[{ label: labels.attempts, value: attempts.length }, { label: labels.submitted, value: submitted }, { label: labels.pending, value: attempts.length - submitted }].map((item) => <div key={item.label} className="px-2 first:pl-0"><dt className="text-xs text-muted-foreground">{item.label}</dt><dd className="mt-1 text-xl font-semibold tabular-nums">{item.value}</dd></div>)}
          </dl>
          {rows.length === 0 ? <p className="py-3 text-sm text-muted-foreground">{t({ bn: "এখনো কোনো WhatsApp কলের চেষ্টা নেই।", en: "No WhatsApp call attempts yet." })}</p> : <>
            <div className="table-scroll hidden md:block"><table className="w-full text-sm"><thead><tr className="border-b border-border text-left text-xs text-muted-foreground">{Object.values(labels).map((label) => <th key={label} className="px-2 py-2 font-medium first:pl-0">{label}</th>)}</tr></thead><tbody>{rows.map((row) => <tr key={row.agentName ?? "unknown"} className="border-b border-border last:border-0"><td className="py-3 pr-2 font-medium">{row.agentName ?? t({ bn: "অজানা এজেন্ট", en: "Unknown agent" })}</td><td className="px-2 tabular-nums">{row.attempts}</td><td className="px-2 tabular-nums">{row.submitted}</td><td className={`px-2 tabular-nums ${row.pending ? "font-semibold text-destructive" : "text-muted-foreground"}`}>{row.pending}</td><td className="px-2 text-xs text-muted-foreground">{fullDateTime(row.lastAttemptAt)}</td></tr>)}</tbody></table></div>
            <ul className="grid gap-2 md:hidden">{rows.map((row) => <li key={row.agentName ?? "unknown"} className="space-y-2 rounded-lg border border-border p-3"><p className="text-sm font-semibold">{row.agentName ?? t({ bn: "অজানা এজেন্ট", en: "Unknown agent" })}</p><dl className="grid grid-cols-3 gap-2 text-xs">{[{ label: labels.attempts, value: row.attempts }, { label: labels.submitted, value: row.submitted }, { label: labels.pending, value: row.pending }].map((item) => <div key={item.label}><dt className="text-muted-foreground">{item.label}</dt><dd className="mt-1 text-base font-semibold tabular-nums">{item.value}</dd></div>)}</dl><p className="text-xs text-muted-foreground">{labels.last}: {fullDateTime(row.lastAttemptAt)}</p></li>)}</ul>
          </>}
        </>}
    </section>
  );
}
