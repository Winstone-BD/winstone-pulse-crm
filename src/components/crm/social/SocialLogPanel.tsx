import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Download } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { socialLog, socialLogCsv, type SocialLogRow } from "@/lib/social.functions";
import { useAdminToken } from "@/lib/local-session";
import { useT } from "@/lib/i18n";

const dhakaToday = () => new Date(Date.now() + 6 * 3_600_000).toISOString().slice(0, 10);

/** HQ/IT: filter social work by agent and Dhaka date, see source page/group and lead outcome, export CSV. */
export function SocialLogPanel() {
  const t = useT();
  const adminToken = useAdminToken();
  const fn = useServerFn(socialLog);
  const [from, setFrom] = useState(dhakaToday);
  const [to, setTo] = useState(dhakaToday);
  const [agentId, setAgentId] = useState("");
  const q = useQuery({
    queryKey: ["social-log", adminToken, from, to],
    queryFn: () => fn({ data: { adminToken, from, to } }),
    enabled: Boolean(adminToken) && Boolean(from) && Boolean(to) && from <= to,
  });
  const all = q.data ?? [];
  const agents = [...new Map(all.map((r) => [r.agentId, r.agentName])).entries()];
  const rows = agentId ? all.filter((r) => r.agentId === agentId) : all;

  const outcome = (r: SocialLogRow) => !r.leadId ? "—"
    : r.booked ? t({ bn: "বুকিং", en: "Booked" })
    : r.visited ? t({ bn: "সাইট ভিজিট", en: "Site visit" })
    : r.leadStatus ?? t({ bn: "লিড", en: "Lead" });

  const exportCsv = () => {
    const blob = new Blob([socialLogCsv(rows)], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `social-work_${from}_${to}${agentId ? "_agent" : ""}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return <details className="rounded-lg border border-border p-3" open>
    <summary className="cursor-pointer text-sm font-semibold">{t({ bn: "কাজের হিসাব, উৎস ও ফলাফল", en: "Work log, source & outcome" })}</summary>
    <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_1fr_1fr_auto]">
      <label className="text-xs">{t({ bn: "শুরু", en: "From" })}<Input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} /></label>
      <label className="text-xs">{t({ bn: "শেষ", en: "To" })}<Input type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} /></label>
      <label className="text-xs">{t({ bn: "এজেন্ট", en: "Agent" })}
        <select value={agentId} onChange={(e) => setAgentId(e.target.value)} className="h-10 w-full rounded-md border border-input bg-background px-2 text-sm">
          <option value="">{t({ bn: "সব এজেন্ট", en: "All agents" })}</option>
          {agents.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
        </select></label>
      <Button className="self-end" variant="outline" disabled={!rows.length} onClick={exportCsv}><Download className="size-4" />CSV</Button>
    </div>
    {q.isError ? <p className="mt-2 text-sm text-destructive">{(q.error as Error).message}</p>
      : !rows.length ? <p className="mt-2 text-sm text-muted-foreground">{q.isLoading ? "…" : t({ bn: "এই সময়ে কোনো এন্ট্রি নেই", en: "No entries in this period" })}</p>
      : <ul className="mt-3 max-h-96 space-y-2 overflow-y-auto text-sm">{rows.map((r) => <li key={r.id} className="rounded border border-border p-2">
          <div className="flex flex-wrap justify-between gap-1"><span className="font-medium">{r.agentName}</span>
            <span className="text-xs text-muted-foreground">{new Date(r.createdAt).toLocaleString("en-GB", { timeZone: "Asia/Dhaka", dateStyle: "short", timeStyle: "short" })}</span></div>
          <p className="text-xs text-muted-foreground">{t({ bn: "উৎস", en: "Source" })}: {r.source ?? t({ bn: "উল্লেখ নেই", en: "Not recorded" })} · {r.replies} {t({ bn: "উত্তর", en: "replies" })}</p>
          {r.leadId && <p className="text-xs">{t({ bn: "লিড", en: "Lead" })}: {r.leadName ?? "—"} · <span className="font-semibold">{t({ bn: "ফলাফল", en: "Outcome" })}: {outcome(r)}</span></p>}
        </li>)}</ul>}
  </details>;
}
