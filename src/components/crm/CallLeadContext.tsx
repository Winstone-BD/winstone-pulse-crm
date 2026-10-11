import { History, MapPin } from "lucide-react";
import { LeadNotesPanel } from "@/components/crm/LeadNotesPanel";
import { LeadReportsSection } from "@/components/crm/LeadReportsSection";
import { buildTimeline, LEAD_EVENT_LABELS, useSnapshot } from "@/lib/crm-data";
import { fullDateTime } from "@/lib/crm-format";
import { useT } from "@/lib/i18n";

/** Existing scoped snapshot and authorised notes/reports only. */
export function CallLeadContext({ leadId }: { leadId: string }) {
  const t = useT();
  const { leads, calls, messages, events } = useSnapshot();
  const lead = leads.find((row) => row.id === leadId);
  const history = buildTimeline(calls, messages, leadId, events).slice().reverse().slice(0, 8);
  return <div className="min-w-0 space-y-4">
    {lead && <div className="space-y-2 border-b border-border pb-3">
      <p className="break-words font-semibold">{lead.name}</p>
      <p className="font-mono text-sm text-muted-foreground">{lead.phone_number}</p>
      {lead.address && <p className="flex items-start gap-2 text-sm"><MapPin className="mt-0.5 size-4 shrink-0 text-chart-2" />{lead.address}</p>}
      {lead.notes && <p className="whitespace-pre-wrap break-words text-sm">{lead.notes}</p>}
    </div>}
    <LeadNotesPanel key={leadId} leadId={leadId} compact />
    <details className="border-t border-border pt-3" open>
      <summary className="cursor-pointer text-sm font-semibold"><History className="mr-2 inline size-4 text-chart-2" />{t({ bn: "আগের কল ও ইতিহাস", en: "Previous calls & history" })}</summary>
      {history.length ? <ol className="mt-3 space-y-3 border-l border-border pl-3">{history.map((entry, i) => <li key={`${entry.at}-${i}`} className="text-xs">
        <p className="font-medium">{entry.kind === "call" ? t({ bn: "কল রেকর্ড", en: "Call record" }) : entry.kind === "message" ? "WhatsApp" : LEAD_EVENT_LABELS[entry.event.kind] ?? entry.event.kind}</p>
        <time className="text-muted-foreground">{fullDateTime(entry.at)}</time>
      </li>)}</ol> : <p className="mt-2 text-xs text-muted-foreground">{t({ bn: "আগের কোনো কার্যক্রম সংরক্ষিত নেই।", en: "No previous activity recorded." })}</p>}
      <div className="mt-3"><LeadReportsSection leadId={leadId} compact /></div>
    </details>
  </div>;
}