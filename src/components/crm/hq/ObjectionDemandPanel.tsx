import { useMemo } from "react";

import type { CcReport } from "@/lib/command-center";

/** Bengali labels for saved customer responses (report answers only). */
const RESPONSE_LABELS: Record<string, string> = {
  not_interested: "আগ্রহ নেই",
  need_time: "সময় চান",
  decide_later: "পরে সিদ্ধান্ত",
  need_info: "আরও তথ্য চান",
  family_discussion: "পরিবারের সাথে আলোচনা",
  price_concern: "দাম নিয়ে চিন্তা",
  other: "অন্যান্য",
};
const POSITIVE = new Set(["interested", "site_visit"]);

/** Pure, read-only aggregation of submitted reports within the dashboard filters. */
export function summarizeObjections(reports: CcReport[], f: { fromDay: string; toDay: string; agentId: string | null; project: string | null }) {
  const inRange = reports.filter((r) => {
    const day = (r.submitted_at ?? r.created_at).slice(0, 10);
    return day >= f.fromDay && day <= f.toDay && (!f.agentId || r.agent_id === f.agentId) && (!f.project || r.requirement === f.project);
  });
  const objections = new Map<string, string[]>();
  const demand = new Map<string, string[]>();
  let answered = 0;
  for (const r of inRange) {
    if (r.customer_response) {
      answered += 1;
      if (!POSITIVE.has(r.customer_response)) {
        const k = r.customer_response;
        objections.set(k, [...(objections.get(k) ?? []), r.lead_id ?? ""].filter(Boolean));
      }
    }
    if (r.requirement) demand.set(r.requirement, [...(demand.get(r.requirement) ?? []), r.lead_id ?? ""].filter(Boolean));
  }
  const toRows = (m: Map<string, string[]>) =>
    [...m.entries()].map(([key, ids]) => ({ key, count: ids.length, leadIds: [...new Set(ids)] })).sort((a, b) => b.count - a.count);
  return { total: inRange.length, answered, objections: toRows(objections), demand: toRows(demand) };
}

type Row = { key: string; count: number; leadIds: string[] };

function Bars({ rows, label, onPick }: { rows: Row[]; label: (k: string) => string; onPick: (r: Row) => void }) {
  const max = Math.max(1, ...rows.map((r) => r.count));
  return (
    <ul className="space-y-2">
      {rows.slice(0, 7).map((r) => (
        <li key={r.key}>
          <button type="button" onClick={() => onPick(r)} className="w-full rounded-md px-1 py-1 text-left hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <div className="flex justify-between text-xs"><span>{label(r.key)}</span><span className="font-semibold tabular-nums">{r.count}</span></div>
            <div className="mt-1 h-1.5 rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${(r.count / max) * 100}%` }} /></div>
          </button>
        </li>
      ))}
    </ul>
  );
}

export function ObjectionDemandPanel({
  reports,
  filters,
  onDrill,
}: {
  reports: CcReport[];
  filters: { fromDay: string; toDay: string; agentId: string | null; project: string | null };
  onDrill: (title: string, leadIds: string[]) => void;
}) {
  const s = useMemo(() => summarizeObjections(reports, filters), [reports, filters.fromDay, filters.toDay, filters.agentId, filters.project]);
  const coverage = s.total ? Math.round((s.answered / s.total) * 100) : 0;
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <section className="rounded-xl border border-border bg-card p-4">
        <h3 className="text-sm font-semibold">আপত্তি বিশ্লেষণ</h3>
        <p className="mb-3 text-[11px] text-muted-foreground">শুধু জমা দেওয়া রিপোর্টে এজেন্টের বাছাই করা গ্রাহক-উত্তর থেকে · {s.answered}/{s.total} রিপোর্টে উত্তর আছে ({coverage}%)</p>
        {s.objections.length ? (
          <Bars rows={s.objections} label={(k) => RESPONSE_LABELS[k] ?? k.replace(/_/g, " ")} onPick={(r) => onDrill(`আপত্তি: ${RESPONSE_LABELS[r.key] ?? r.key}`, r.leadIds)} />
        ) : (
          <p className="text-xs text-muted-foreground">এই সময়ে কোনো আপত্তি রেকর্ড হয়নি।</p>
        )}
      </section>
      <section className="rounded-xl border border-border bg-card p-4">
        <h3 className="text-sm font-semibold">প্রজেক্ট/চাহিদা অনুযায়ী আগ্রহ</h3>
        <p className="mb-3 text-[11px] text-muted-foreground">রিপোর্টে সেভ করা চাহিদার লেবেল থেকে · এলাকার তথ্য আলাদা রেকর্ড হয় না</p>
        {s.demand.length ? (
          <Bars rows={s.demand} label={(k) => k} onPick={(r) => onDrill(`চাহিদা: ${r.key}`, r.leadIds)} />
        ) : (
          <p className="text-xs text-muted-foreground">এই সময়ে কোনো চাহিদা রেকর্ড হয়নি।</p>
        )}
      </section>
    </div>
  );
}
