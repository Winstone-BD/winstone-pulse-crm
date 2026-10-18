import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { RefreshCw, CheckCircle2, AlertTriangle } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { agentWorkload } from "@/lib/agent-workload.functions";
import { useAdminToken } from "@/lib/local-session";
import { useT } from "@/lib/i18n";

export function AgentWorkloadPanel() {
  const t = useT();
  const token = useAdminToken();
  const read = useServerFn(agentWorkload);
  const [day, setDay] = useState(() => new Date(Date.now() + 21600000).toISOString().slice(0, 10));
  const q = useQuery({ queryKey: ["agent-workload", day, token], queryFn: () => read({ data: { adminToken: token, day } }), refetchInterval: 180000, refetchIntervalInBackground: false, refetchOnWindowFocus: true });
  const labels = [t({ bn: "এজেন্ট", en: "Agent" }), t({ bn: "সক্রিয় pending", en: "Active pending" }), t({ bn: "আজকের নতুন লিড", en: "New leads today" }), t({ bn: "আউটগোয়িং কল", en: "Outgoing calls" }), t({ bn: "৫০-এর ঘাটতি", en: "Gap to 50" })];
  return <section className="space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h2 className="font-semibold">{t({ bn: "এজেন্টের লিড ও কল", en: "Agent leads & calls" })}</h2>
      <div className="flex items-center gap-2"><Input type="date" aria-label={t({ bn: "ঢাকার তারিখ", en: "Dhaka date" })} className="w-40" value={day} onChange={(e) => e.target.value && setDay(e.target.value)} /><Button size="icon" variant="outline" aria-label={t({ bn: "হালনাগাদ", en: "Refresh" })} disabled={q.isFetching} onClick={() => void q.refetch()}><RefreshCw className={q.isFetching ? "size-4 animate-spin" : "size-4"} /></Button></div>
    </div>
    {q.isError && <p role="alert" className="text-sm text-destructive">{q.error.message}</p>}
    {!q.data && q.isPending && <p className="text-sm text-muted-foreground">{t({ bn: "হিসাব আসছে…", en: "Loading counts…" })}</p>}
    {q.data && <>
      <div className="hidden md:block"><table className="w-full text-sm"><thead><tr className="border-b border-border">{labels.map((label) => <th key={label} className="py-3 text-left font-medium text-muted-foreground">{label}</th>)}</tr></thead><tbody>{q.data.rows.map((r) => <tr key={r.agentId} className="border-b border-border"><td className="py-3">{r.name}<span className="block text-xs text-muted-foreground">{r.employeeId}</span></td><td>{r.pending}</td><td>{r.newLeads} / 50</td><td>{r.calls}</td><td className={r.ok ? "text-primary" : "text-destructive"}><span className="flex items-center gap-1">{r.ok ? <CheckCircle2 className="size-4" /> : <AlertTriangle className="size-4" />}{r.newLeads > 50 ? `+${r.newLeads - 50}` : r.gap}</span></td></tr>)}</tbody></table></div>
      <div className="grid gap-3 md:hidden">{q.data.rows.map((r) => <article key={r.agentId} className="rounded-lg border border-border p-3"><p className="text-sm font-semibold">{r.name}</p><p className="text-xs text-muted-foreground">{r.employeeId}</p><dl className="mt-3 grid grid-cols-2 gap-3 text-xs">{[r.pending, `${r.newLeads} / 50`, r.calls, r.newLeads > 50 ? `+${r.newLeads - 50}` : r.gap].map((value, i) => <div key={i}><dt className="text-muted-foreground">{labels[i + 1]}</dt><dd className="mt-1 text-sm font-semibold">{value}</dd></div>)}</dl></article>)}</div>
      {q.data.rows.length === 0 && <p className="text-sm text-muted-foreground">{t({ bn: "সক্রিয় অনুমোদিত এজেন্ট নেই", en: "No active approved agents" })}</p>}
      <p className="text-xs text-muted-foreground">{t({ bn: "ঢাকা সময় · নতুন লিড = অনবরাদ্দ পুল থেকে আজকের হস্তান্তর; পুনর্বণ্টন নয়। কল = সিঙ্ক হওয়া আউটগোয়িং কল, সংযুক্ত হওয়ার প্রমাণ নয়।", en: "Dhaka time · New leads: today's handovers from the unassigned pool, not transfers. Calls: synced outgoing records, not proof of connection." })}</p>
    </>}
  </section>;
}