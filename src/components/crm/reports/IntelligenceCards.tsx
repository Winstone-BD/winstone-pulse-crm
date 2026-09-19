import { Sparkles } from "lucide-react";

import type { ReportFilters, ReportResult } from "@/lib/crm-reports";

import { EmptyBlock } from "./EmptyBlock";

/** Lead funnel, source mix and call sentiment breakdown cards — one card answers one question. */
export function IntelligenceCards({ report }: { report: ReportResult }) {
  return (
    <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      <BreakdownCard
        title="Lead funnel"
        subtitle="From new leads to deals"
        rows={report.statusMix}
        emptyHint="No lead activity for this period. Adjust the date or filters."
      />
      <BreakdownCard
        title="Lead source mix"
        subtitle="Where the leads come from"
        rows={report.sourceMix}
        emptyHint="No sourced leads in this range."
      />
      <BreakdownCard
        title="Call sentiment"
        subtitle="AI analysed conversations"
        rows={report.sentimentMix}
        emptyHint="No AI-analysed calls in this range."
      />
    </section>
  );
}

function BreakdownCard({
  title,
  subtitle,
  rows,
  emptyHint,
}: {
  title: string;
  subtitle: string;
  rows: { key: string; label: string; value: number }[];
  emptyHint: string;
}) {
  const total = rows.reduce((sum, r) => sum + r.value, 0);
  return (
    <div className="card-elevated flex flex-col p-3 sm:p-4">
      <h2 className="section-title">{title}</h2>
      <p className="text-xs text-muted-foreground">{subtitle}</p>
      {total === 0 ? (
        <EmptyBlock title="No data for this period" hint={emptyHint} compact />
      ) : (
        <ul className="mt-3 space-y-2.5">
          {rows.map((r) => {
            const pct = total > 0 ? Math.round((r.value / total) * 100) : 0;
            return (
              <li key={r.key} className="space-y-1">
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="min-w-0 truncate">{r.label}</span>
                  <span className="tabular shrink-0 font-semibold">
                    {r.value}
                    <span className="ml-1 text-xs font-normal text-muted-foreground">{pct}%</span>
                  </span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/** Plain-language summary of the numbers already on screen — nothing invented. */
function brief(report: ReportResult): string[] {
  const t = report.totals;
  if (t.dials === 0 && t.newLeads === 0) {
    return ["No activity in this period yet, so there is nothing to summarise."];
  }
  const lines: string[] = [];
  lines.push(
    `${t.dials} dials produced ${t.connected} connected conversations (${t.connectRate.toFixed(1)}% connect rate).`,
  );
  if (t.talkMinutes > 0) {
    lines.push(`${formatMinutes(t.talkMinutes)} of talk time across ${t.activeAgents} agents.`);
  }
  lines.push(`${t.newLeads} new leads created and ${t.dealsWon} deals won in this range.`);
  const top = [...report.rows].sort((a, b) => b.dials - a.dials)[0];
  if (top && top.dials > 0) {
    const share = t.dials > 0 ? Math.round((top.dials / t.dials) * 100) : 0;
    lines.push(`${top.agent} handled ${top.dials} dials — ${share}% of all activity in scope.`);
  }
  if (t.whatsapp > 0) lines.push(`${t.whatsapp} WhatsApp touches were logged alongside calls.`);
  return lines;
}

function formatMinutes(minutes: number): string {
  const total = Math.round(minutes);
  const h = Math.floor(total / 60);
  const m = total % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

/** AI-style performance brief derived only from the numbers already shown above. */
export function AiPerformanceBrief({
  report,
  filters,
}: {
  report: ReportResult;
  filters: ReportFilters;
}) {
  return (
    <section className="card-elevated card-pad sm:p-4">
      <h2 className="section-title">
        <Sparkles className="size-4 shrink-0 text-primary" /> AI performance brief
      </h2>
      <p className="text-xs text-muted-foreground">
        {filters.from} → {filters.to}, from the data in scope
      </p>
      <ul className="mt-3 space-y-1.5 text-sm">
        {brief(report).map((line) => (
          <li key={line} className="flex gap-2">
            <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" />
            <span className="text-muted-foreground">{line}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
