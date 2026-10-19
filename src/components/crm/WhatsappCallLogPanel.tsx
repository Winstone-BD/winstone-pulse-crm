import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Download, Loader2, MessageCircle, RotateCcw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { listWhatsappCallAttempts } from "@/lib/call-reports.functions";
import { fullDateTime } from "@/lib/crm-format";
import { useAdminToken } from "@/lib/local-session";
import { useLang } from "@/lib/i18n";
import { filterWhatsappAttempts, whatsappAttemptsCsv, type AttemptFilters } from "@/lib/whatsapp-attempt-filters";
const empty: AttemptFilters = { from: "", to: "", agent: "", status: "all" };
export function WhatsappCallLogPanel({ onOpenLead }: { onOpenLead: (leadId: string) => void }) {
  const [lang] = useLang();
  const t = (bn: string, en: string) => lang === "bn" ? bn : en;
  const [filters, setFilters] = useState(empty);
  const adminToken = useAdminToken();
  const fetchAttempts = useServerFn(listWhatsappCallAttempts);
  const { data, isPending, isError } = useQuery({
    queryKey: ["whatsapp-call-attempts", adminToken ? "pin" : "session"],
    queryFn: () => fetchAttempts({ data: { adminToken } }), refetchInterval: 60_000,
  });
  const attempts = data?.attempts ?? [];
  const rows = filterWhatsappAttempts(attempts, filters);
  const agents = [...new Set(attempts.flatMap(a => a.agentName ? [a.agentName] : []))].sort();
  const exportCsv = () => {
    const url = URL.createObjectURL(new Blob([whatsappAttemptsCsv(rows)], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a"); link.href = url; link.download = "winstone-whatsapp-attempts.csv";
    link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return (
    <section className="space-y-3 border-t py-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-lg font-semibold"><MessageCircle className="size-5 shrink-0 text-primary" />{t("WhatsApp কলের চেষ্টা", "WhatsApp call attempts")} ({rows.length}/{attempts.length})</h2>
        <Button size="sm" variant="outline" disabled={isPending || isError || !rows.length} onClick={exportCsv}><Download className="size-4" />{t("CSV রপ্তানি", "Export CSV")}</Button>
      </div>
      <p className="text-xs text-muted-foreground">{t("সর্বশেষ ৩০০ চেষ্টা · ঢাকা সময় · সময় এজেন্টের লেখা", "Latest 300 attempts · Dhaka time · Agent-entered duration")}</p>
      <div className="grid grid-cols-2 items-end gap-2 md:grid-cols-[1fr_1fr_1fr_1fr_auto]">
        <label className="min-w-0 space-y-1 text-xs">{t("শুরুর তারিখ", "From date")}<Input aria-label={t("শুরুর তারিখ", "From date")} type="date" value={filters.from} max={filters.to || undefined} onChange={e => setFilters({ ...filters, from: e.target.value })} className="min-w-0" /></label>
        <label className="min-w-0 space-y-1 text-xs">{t("শেষের তারিখ", "To date")}<Input aria-label={t("শেষের তারিখ", "To date")} type="date" value={filters.to} min={filters.from || undefined} onChange={e => setFilters({ ...filters, to: e.target.value })} className="min-w-0" /></label>
        <label className="min-w-0 space-y-1 text-xs">{t("এজেন্ট", "Agent")}<select aria-label={t("এজেন্ট", "Agent")} className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm" value={filters.agent} onChange={e => setFilters({ ...filters, agent: e.target.value })}><option value="">{t("সব এজেন্ট", "All agents")}</option>{agents.map(a => <option key={a} value={a}>{a}</option>)}</select></label>
        <label className="min-w-0 space-y-1 text-xs">{t("রিপোর্টের অবস্থা", "Report status")}<select aria-label={t("রিপোর্টের অবস্থা", "Report status")} className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm" value={filters.status} onChange={e => setFilters({ ...filters, status: e.target.value as AttemptFilters["status"] })}><option value="all">{t("সব রিপোর্ট", "All reports")}</option><option value="submitted">{t("জমা হয়েছে", "Submitted")}</option><option value="pending">{t("বাকি", "Pending")}</option></select></label>
        <Button size="icon" variant="ghost" title={t("ফিল্টার সরান", "Reset filters")} aria-label={t("ফিল্টার সরান", "Reset filters")} onClick={() => setFilters(empty)}><RotateCcw className="size-4" /></Button>
      </div>
      {isPending ? <p className="flex gap-2 text-sm"><Loader2 className="size-4 animate-spin" />{t("লোড হচ্ছে…", "Loading…")}</p> : isError ? <p className="text-sm text-destructive">{t("তালিকা লোড হয়নি। আবার চেষ্টা করুন।", "Could not load attempts. Please retry.")}</p> : !rows.length ? <p className="border border-dashed p-3 text-sm text-muted-foreground">{attempts.length ? t("এই ফিল্টারে কোনো চেষ্টা নেই।", "No attempts match these filters.") : t("এখনো কোনো WhatsApp কলের চেষ্টা নেই।", "No WhatsApp call attempts yet.")}</p> : <ul className="max-h-[28rem] space-y-2 overflow-y-auto">{rows.map(row => <li key={row.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-3">
        <div className="min-w-0 flex-1"><Button variant="link" disabled={!row.leadId} onClick={() => row.leadId && onOpenLead(row.leadId)} className="h-auto max-w-full justify-start truncate p-0 text-sm font-semibold">{row.leadName ?? row.phoneNumber ?? t("অজানা নম্বর", "Unknown number")}</Button><p className="break-words text-xs text-muted-foreground">{row.phoneNumber ?? "—"} · {row.agentName ?? "—"} · {fullDateTime(row.startedAt)}</p></div>
        <Badge variant={row.submitted ? "outline" : "secondary"}>{row.submitted ? `${t("রিপোর্ট জমা", "Submitted")} · ${row.typedSeconds ?? 0} ${t("সে (এজেন্টের লেখা)", "s (agent-entered)")}` : t("রিপোর্ট বাকি", "Pending report")}</Badge>
      </li>)}</ul>}
    </section>
  );
}
