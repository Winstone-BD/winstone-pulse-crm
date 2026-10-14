import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";

import { useSiteVisits, VISIT_LABEL } from "@/components/crm/hq/SiteVisitsPanel";
import type { Lead } from "@/lib/crm-data";
import { useAdminToken } from "@/lib/local-session";
import { logSiteVisitOutcome, setSiteVisitStatus } from "@/lib/site-visits.functions";

const STAGES = ["scheduled", "confirmed", "completed", "offer_made"] as const;
const NEXT: Record<string, (typeof STAGES)[number] | undefined> = { scheduled: "confirmed", confirmed: "completed" };
const INTEREST = [["hot", "হট"], ["warm", "ওয়ার্ম"], ["cold", "কোল্ড"], ["not_interested", "আগ্রহী নন"]] as const;
const when = (iso: string) => new Date(iso).toLocaleString("bn-BD", { timeZone: "Asia/Dhaka", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

/** Visual pipeline over real site_visits rows: Scheduled → Confirmed → Completed → Offer Made. */
export function SiteVisitPipeline({ leads }: { leads: Lead[] }) {
  const adminToken = useAdminToken();
  const qc = useQueryClient();
  const visits = useSiteVisits();
  const setStatus = useServerFn(setSiteVisitStatus);
  const saveOutcome = useServerFn(logSiteVisitOutcome);
  const leadName = new Map(leads.map((l) => [l.id, l.name]));
  const [editing, setEditing] = useState<string | null>(null);
  const [interest, setInterest] = useState<(typeof INTEREST)[number][0]>("warm");
  const [text, setText] = useState("");
  const [offer, setOffer] = useState(false);
  const refresh = () => qc.invalidateQueries({ queryKey: ["site-visits"] });

  const move = useMutation({
    mutationFn: (v: { id: string; status: (typeof STAGES)[number] | "cancelled" | "no_show" }) => setStatus({ data: { adminToken, ...v } }),
    onSuccess: refresh, onError: (e) => toast.error((e as Error).message),
  });
  const outcome = useMutation({
    mutationFn: (id: string) => saveOutcome({ data: { adminToken, id, interest, outcome: text, offerMade: offer } }),
    onSuccess: () => { toast.success("ভিজিটের ফলাফল সংরক্ষিত — লিডের ইতিহাসে যোগ হয়েছে"); setEditing(null); setText(""); setOffer(false); refresh(); },
    onError: (e) => toast.error((e as Error).message),
  });

  const rows = visits.data ?? [];
  if (visits.isPending) return <p className="text-xs text-muted-foreground">পাইপলাইন লোড হচ্ছে…</p>;
  if (visits.error) return <p className="text-xs text-destructive">পাইপলাইন লোড হয়নি।</p>;

  return (
    <section className="card-elevated min-w-0 p-4 sm:p-5">
      <h3 className="mb-3 text-sm font-semibold tracking-tight">ভিজিট পাইপলাইন</h3>
      <div className="grid gap-3 md:grid-cols-4">
        {STAGES.map((stage) => {
          const items = rows.filter((v) => v.status === stage).sort((a, b) => a.visit_at.localeCompare(b.visit_at));
          return (
            <div key={stage} className="min-w-0 rounded-xl border border-border bg-muted/30 p-2">
              <p className="mb-2 flex justify-between px-1 text-xs font-semibold"><span>{VISIT_LABEL[stage]}</span><span className="tabular text-muted-foreground">{items.length}</span></p>
              <ul className="max-h-96 space-y-2 overflow-y-auto">
                {items.length === 0 && <li className="rounded-lg border border-dashed border-border p-3 text-center text-[11px] text-muted-foreground">কিছু নেই</li>}
                {items.map((v) => {
                  const next = NEXT[v.status];
                  const late = (stage === "scheduled" || stage === "confirmed") && new Date(v.visit_at).getTime() < Date.now();
                  return (
                    <li key={v.id} className="space-y-1.5 rounded-lg border border-border bg-card p-2 text-xs">
                      <p className="truncate font-semibold">{leadName.get(v.lead_id) ?? "লিড"}</p>
                      <p className={late ? "text-destructive" : "text-muted-foreground"}>{when(v.visit_at)}{v.project ? ` · ${v.project}` : ""}</p>
                      {v.outcome && <p className="rounded bg-muted px-1.5 py-1 text-[11px]">ফলাফল: {v.outcome}</p>}
                      <div className="flex flex-wrap gap-1">
                        {next && <button type="button" disabled={move.isPending} onClick={() => move.mutate({ id: v.id, status: next })}
                          className="rounded-md bg-primary px-2 py-1 text-[11px] font-semibold text-primary-foreground">→ {VISIT_LABEL[next]}</button>}
                        {(stage === "scheduled" || stage === "confirmed") && <>
                          <button type="button" onClick={() => move.mutate({ id: v.id, status: "no_show" })} className="rounded-md border border-border px-2 py-1 text-[11px]">আসেননি</button>
                          <button type="button" onClick={() => move.mutate({ id: v.id, status: "cancelled" })} className="rounded-md border border-border px-2 py-1 text-[11px]">বাতিল</button>
                        </>}
                        {(stage === "completed" || stage === "offer_made") && <button type="button" onClick={() => setEditing(editing === v.id ? null : v.id)}
                          className={`rounded-md border px-2 py-1 text-[11px] ${!v.outcome_at ? "border-warning text-warning" : "border-border"}`}>{v.outcome_at ? "ফলাফল বদলান" : "ফলাফল লিখুন"}</button>}
                      </div>
                      {editing === v.id && (
                        <form className="space-y-1.5 border-t border-border pt-1.5" onSubmit={(e) => { e.preventDefault(); outcome.mutate(v.id); }}>
                          <div className="flex flex-wrap gap-1">{INTEREST.map(([k, l]) => (
                            <button key={k} type="button" onClick={() => setInterest(k)} className={`rounded-md border px-1.5 py-0.5 text-[11px] ${interest === k ? "border-primary bg-primary/10" : "border-border"}`}>{l}</button>
                          ))}</div>
                          <textarea aria-label="ভিজিটের ফলাফল" required minLength={3} maxLength={1000} value={text} onChange={(e) => setText(e.target.value)}
                            placeholder="ক্রেতা কী বললেন, পরবর্তী পদক্ষেপ" className="min-h-16 w-full rounded-md border border-border bg-background p-1.5 text-[11px]" />
                          {stage === "completed" && <label className="flex items-center gap-1 text-[11px]"><input type="checkbox" checked={offer} onChange={(e) => setOffer(e.target.checked)} /> অফার দেওয়া হয়েছে</label>}
                          <button type="submit" disabled={outcome.isPending || text.trim().length < 3} className="w-full rounded-md bg-primary py-1 text-[11px] font-semibold text-primary-foreground disabled:opacity-50">সংরক্ষণ</button>
                        </form>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </div>
    </section>
  );
}
