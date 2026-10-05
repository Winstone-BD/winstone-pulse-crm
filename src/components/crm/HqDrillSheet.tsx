import { ChevronRight, Inbox } from "lucide-react";

import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import type { CallRecording, Lead, Profile } from "@/lib/crm-data";
import { formatDuration } from "@/lib/crm-format";

/** What a number card or a mix-card row drilled into. */
export type DrillSpec = {
  title: string;
  subtitle: string;
  kind: "leads" | "calls";
  leads?: Lead[];
  calls?: CallRecording[];
};

const TEMPERATURE_LABEL: Record<string, string> = {
  hot: "HOT",
  warm: "WARM",
  cold: "COLD",
};

const STATUS_LABEL: Record<string, string> = {
  pending: "নতুন / বাকি",
  contacted: "কথা হয়েছে",
  follow_up: "ফলো-আপ",
  closed: "বন্ধ",
};

function dateText(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Dhaka",
  }).format(d);
}

/**
 * Drill-down list behind every HQ number and mix-card row.
 * Read-only: tapping a name hands the lead id back so the caller opens the
 * existing lead file. Nothing here writes or re-fetches.
 */
export function HqDrillSheet({
  spec,
  profiles,
  leads,
  loading,
  open,
  onOpenChange,
  onSelectLead,
}: {
  spec: DrillSpec | null;
  profiles: Profile[];
  leads: Lead[];
  loading?: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectLead: (leadId: string) => void;
}) {
  const rows = spec?.kind === "calls" ? (spec.calls ?? []) : (spec?.leads ?? []);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full max-w-full overflow-hidden p-0 sm:max-w-lg">
        <div className="flex h-full flex-col">
          <SheetHeader className="m-0 border-b border-border bg-surface px-4 py-4 text-left sm:px-5">
            <SheetTitle className="text-lg">{spec?.title ?? "বিস্তারিত"}</SheetTitle>
            <p className="text-xs text-muted-foreground">{spec?.subtitle}</p>
            {!loading && (
              <p className="tabular text-xs text-muted-foreground">মোট {rows.length}টি</p>
            )}
          </SheetHeader>

          <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3 sm:px-4">
            {loading ? (
              <ul className="space-y-2">
                {Array.from({ length: 6 }).map((_, i) => (
                  <li key={i} className="skeleton h-16 w-full" />
                ))}
              </ul>
            ) : rows.length === 0 ? (
              <div className="mt-10 flex flex-col items-center gap-2 text-center">
                <Inbox className="size-8 text-muted-foreground" />
                <p className="text-sm font-medium">এখনো লাইভ ডেটা নেই</p>
                <p className="max-w-[16rem] text-xs text-muted-foreground">
                  এই ভাগে কিছু জমা হলে সঙ্গে সঙ্গে এখানে দেখা যাবে।
                </p>
              </div>
            ) : spec?.kind === "calls" ? (
              <ul className="space-y-2">
                {(spec.calls ?? []).map((call) => {
                  const lead = leads.find((l) => l.id === call.lead_id) ?? null;
                  const agent = profiles.find((p) => p.id === call.agent_id) ?? null;
                  return (
                    <li key={call.id}>
                      <button
                        type="button"
                        disabled={!lead}
                        onClick={() => lead && onSelectLead(lead.id)}
                        aria-label={`${lead?.name ?? call.phone_number} — লিডের পুরো ফাইল খুলুন / Open full lead file`}
                        className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-xl border border-border bg-surface px-3 py-3 text-left transition-colors hover:border-primary/40 hover:bg-surface-2/50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none disabled:opacity-70 disabled:hover:border-border disabled:hover:bg-surface"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold">
                            {lead?.name ?? call.phone_number}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">
                            {agent?.name ?? "এজেন্ট নেই"} · {formatDuration(call.duration_seconds)} ·{" "}
                            {dateText(call.created_at)}
                          </p>
                        </div>
                        {lead && <ChevronRight className="size-4 shrink-0 text-muted-foreground" />}
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <ul className="space-y-2">
                {(spec?.leads ?? []).map((lead) => {
                  const agent = profiles.find((p) => p.id === lead.assigned_to) ?? null;
                  return (
                    <li key={lead.id}>
                      <button
                        type="button"
                        onClick={() => onSelectLead(lead.id)}
                        aria-label={`${lead.name} · ${lead.phone_number} — লিডের পুরো ফাইল খুলুন / Open full lead file`}
                        className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-xl border border-border bg-surface px-3 py-3 text-left transition-colors hover:border-primary/40 hover:bg-surface-2/50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold">{lead.name}</p>
                          <p className="tabular truncate text-xs text-muted-foreground">
                            {lead.phone_number} · {agent?.name ?? "কারো নামে নেই"}
                          </p>
                          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                            <span className="rounded-full border border-border px-2 py-0.5 text-[10px] text-muted-foreground">
                              {STATUS_LABEL[lead.status] ?? lead.status}
                            </span>
                            {lead.temperature && (
                              <span className="rounded-full border border-primary/40 bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                                {TEMPERATURE_LABEL[lead.temperature] ?? lead.temperature}
                              </span>
                            )}
                            {lead.grade && (
                              <span className="rounded-full border border-border bg-surface-2 px-2 py-0.5 text-[10px] font-semibold">
                                {lead.grade}
                              </span>
                            )}
                            <span className="tabular text-[10px] text-muted-foreground">
                              {dateText(lead.created_at)}
                            </span>
                          </div>
                        </div>
                        <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
