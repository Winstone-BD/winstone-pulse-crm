import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CATEGORY_LABEL_CLIENT } from "@/lib/call-categories";
import { fullDateTime } from "@/lib/crm-format";

export type ReportLike = {
  status?: string | null;
  category?: string | null;
  connected?: boolean | null;
  summary?: string | null;
  note?: string | null;
  reason?: string | null;
  interest?: string | null;
  requirement?: string | null;
  customer_response?: string | null;
  next_action?: string | null;
  follow_up_at?: string | null;
  call_ended_at?: string | null;
  submitted_at?: string | null;
  created_at?: string | null;
  duration_seconds?: number | null;
  agentName?: string | null;
};

/** Canonical report timestamp: when the call ended, else when it was submitted/created. */
export function reportWhen(r: ReportLike): string | null {
  return r.call_ended_at ?? r.submitted_at ?? r.created_at ?? null;
}

export function reportFields(r: ReportLike): { label: string; value: string }[] {
  return [
    { label: "বিবরণ / মন্তব্য", value: r.note },
    { label: "সারসংক্ষেপ", value: r.summary },
    { label: "আগ্রহ", value: r.interest },
    { label: "চাহিদা", value: r.requirement },
    { label: "ক্রেতার উত্তর", value: r.customer_response },
    { label: "পরের ধাপ", value: r.next_action },
    { label: "কারণ", value: r.reason },
    { label: "ফলো-আপ", value: r.follow_up_at ? fullDateTime(r.follow_up_at) : null },
  ].filter((f): f is { label: string; value: string } => !!f.value?.trim());
}

/** Full report body with date, outcome and every manually written field. */
export function ReportDetails({ report, defaultOpen = false }: { report: ReportLike; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const fields = reportFields(report);
  const preview = report.note?.trim() || report.summary?.trim() || null;
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-1.5 text-xs">
        <span className="tabular font-semibold">{fullDateTime(reportWhen(report))}</span>
        {report.agentName ? <span className="text-muted-foreground">· {report.agentName}</span> : null}
        <Badge variant={report.connected ? "default" : "secondary"} className="text-[11px]">
          {report.connected ? "কথা হয়েছে" : "কথা হয়নি"}
        </Badge>
        {report.category ? (
          <Badge variant="outline" className="text-[11px]">
            {CATEGORY_LABEL_CLIENT[report.category] ?? report.category}
          </Badge>
        ) : null}
        {report.status === "pending" ? (
          <Badge variant="destructive" className="text-[11px]">জমা হয়নি</Badge>
        ) : null}
      </div>
      {open ? (
        fields.length ? (
          <dl className="space-y-1.5 rounded-lg border bg-surface-2 p-3 text-sm">
            {fields.map((f) => (
              <div key={f.label}>
                <dt className="text-[11px] font-semibold text-muted-foreground">{f.label}</dt>
                <dd className="whitespace-pre-wrap break-words">{f.value}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <p className="text-xs text-muted-foreground">এই রিপোর্টে লেখা কোনো বিবরণ নেই।</p>
        )
      ) : preview ? (
        <p className="line-clamp-2 whitespace-pre-wrap text-xs text-muted-foreground">{preview}</p>
      ) : null}
      {fields.length > 0 ? (
        <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => setOpen((v) => !v)}>
          {open ? "সংক্ষেপে দেখুন" : "সম্পূর্ণ রিপোর্ট দেখুন"}
        </Button>
      ) : null}
    </div>
  );
}
