import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Gauge } from "lucide-react";

import { getLeadInsightScore } from "@/lib/lead-insight.functions";
import { getAdminToken } from "@/lib/local-session";
import type { LeadInsightScore, ScorePart } from "@/lib/lead-insight-score";
import { useT } from "@/lib/i18n";

export function ScoreBreakdown({ score }: { score: LeadInsightScore }) {
  const t = useT();
  const parts: [string, ScorePart][] = [
    [t({ bn: "কলের সময়", en: "Call duration" }), score.duration],
    [t({ bn: "আগ্রহের সংকেত", en: "Engagement" }), score.engagement],
    [t({ bn: "AI সেন্টিমেন্ট", en: "AI sentiment" }), score.ai],
  ];
  return (
    <div className="space-y-2">
      {parts.map(([label, p]) => (
        <div key={label}>
          <div className="flex justify-between text-xs"><span className="font-medium">{label}</span><span className="tabular-nums">{p.points}/{p.max}</span></div>
          <div className="mt-1 h-1.5 rounded-full bg-muted"><div className="h-1.5 rounded-full bg-primary" style={{ width: `${(p.points / p.max) * 100}%` }} /></div>
          <ul className="mt-1 space-y-0.5 text-[11px] text-muted-foreground">
            {p.lines.map((l) => <li key={l.label}>{l.label} · +{l.points}</li>)}
            {p.note && <li>{p.note}</li>}
          </ul>
        </div>
      ))}
    </div>
  );
}

/** Insight score beside the locked V2 score — informational, changes nothing. */
export function LeadInsightScoreCard({ leadId }: { leadId: string }) {
  const run = useServerFn(getLeadInsightScore);
  const t = useT();
  const q = useQuery({ queryKey: ["lead-insight", leadId], queryFn: () => run({ data: { leadId, token: getAdminToken() } }), retry: false, staleTime: 60_000 });
  return (
    <section className="rounded-xl border border-border bg-card p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-semibold"><Gauge className="size-4 text-primary" /> {t({ bn: "ইনসাইট স্কোর", en: "Insight score" })}</div>
        {q.data && (
          <div className="flex items-center gap-2">
            {q.data.highPotential && <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-semibold uppercase text-primary">{t({ bn: "উচ্চ সম্ভাবনা", en: "High potential" })}</span>}
            <span className="text-lg font-bold tabular-nums">{q.data.total}<span className="text-xs text-muted-foreground">/100</span></span>
          </div>
        )}
      </div>
      {q.isPending && <p className="text-xs text-muted-foreground">{t({ bn: "হিসাব হচ্ছে…", en: "Calculating…" })}</p>}
      {q.isError && <p className="text-xs text-muted-foreground">{t({ bn: "স্কোর দেখানো যায়নি", en: "Score unavailable" })}</p>}
      {q.data && <ScoreBreakdown score={q.data} />}
      <p className="mt-3 text-[10px] text-muted-foreground">{t({ bn: "সহায়ক স্কোর — Cold/Warm/Hot ও অগ্রাধিকার বদলায় না।", en: "Helper score — does not change Cold/Warm/Hot or priority." })}</p>
    </section>
  );
}
