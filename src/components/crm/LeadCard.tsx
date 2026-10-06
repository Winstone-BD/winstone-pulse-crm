import { BadgeCheck, FolderOpen, Repeat, Sparkles } from "lucide-react";

import { CallbackLogButton } from "@/components/crm/CallbackLogButton";
import { WebCallButton } from "@/components/crm/WebCallButton";
import { Button } from "@/components/ui/button";
import type { CallRecording, Lead, Profile } from "@/lib/crm-data";
import { relativeTime, summaryBullets } from "@/lib/crm-format";
import { WhatsAppAction } from "@/components/crm/WhatsAppAction";
import { cn } from "@/lib/utils";

const STATUS_STYLES: Record<string, string> = {
  pending: "border-idle/30 bg-idle/15 text-idle-foreground",
  contacted: "border-primary/25 bg-accent text-accent-foreground",
  follow_up: "border-chart-4/30 bg-chart-4/10 text-chart-4",
  closed: "border-live/30 bg-live/10 text-live",
};

export function LeadCard({
  lead,
  agent,
  verifiedCall,
  onOpen,
}: {
  lead: Lead;
  agent: Profile | undefined;
  verifiedCall: CallRecording | undefined;
  onOpen: () => void;
}) {
  const headline = summaryBullets(verifiedCall?.ai_summary ?? null)[0];

  return (
    <article className="card-elevated flex flex-col gap-3 p-4 hover:border-primary/30">
      <div className="flex items-start justify-between gap-3">
        <button onClick={onOpen} className="min-w-0 text-left">
          <p className="flex items-center gap-1.5 font-medium">
            <span className="truncate">{lead.name}</span>
            {verifiedCall && (
              <BadgeCheck
                className="size-4 shrink-0 text-verified"
                aria-label="Two-sided audio verified"
              />
            )}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            {lead.company ?? "Individual"} · <span className="tabular">{lead.phone_number}</span>
          </p>
        </button>
        <span
          className={cn(
            "shrink-0 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold capitalize",
            STATUS_STYLES[lead.status],
          )}
        >
          {lead.status.replace("_", " ")}
        </span>
      </div>

      <RequirementPills lead={lead} />

      {headline && (
        <p className="flex gap-1.5 rounded-lg bg-surface-2 p-2.5 text-xs text-muted-foreground">
          <Sparkles className="mt-0.5 size-3 shrink-0 text-primary" />
          <span className="line-clamp-2">{headline}</span>
        </p>
      )}

      <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1">
          <Repeat className="size-3" /> {lead.call_attempts}
        </span>
        <span>{relativeTime(lead.last_call_at)}</span>
        <span className="ml-auto truncate">{agent?.name ?? "Unassigned"}</span>
      </div>

      <div className="flex flex-wrap gap-2">
        <WebCallButton
          leadId={lead.id}
          phone={lead.phone_number}
          label="কল"
          className="basis-[calc(50%-0.25rem)] transition-all duration-300 hover:shadow-md"
        />
        <WhatsAppAction
          phone={lead.phone_number}
          leadId={lead.id}
          label="WhatsApp"
          size="lg"
          className="h-11 min-w-0 flex-1 basis-[calc(50%-0.25rem)] rounded-xl bg-whatsapp text-base font-semibold text-live-foreground shadow-sm transition-all duration-300 hover:bg-whatsapp/90 hover:shadow-md"
        />
        <CallbackLogButton leadId={lead.id} className="h-11 shrink-0 rounded-xl" label="" />
        <Button
          size="lg"
          variant="outline"
          className="expand-btn h-11 min-w-0 flex-1 rounded-xl px-3"
          onClick={onOpen}
          aria-label="Open dossier"
        >
          <FolderOpen className="size-5" />
          <span className="text-sm font-semibold sm:hidden">Dossier</span>
          <span className="expand-label hidden text-sm sm:inline">Dossier</span>
        </Button>
      </div>
    </article>
  );
}

/** Pull bedroom / location / budget out of the saved requirement + area — never invented. */
function RequirementPills({ lead }: { lead: Lead }) {
  const req = (lead as Lead & { requirement?: string | null }).requirement ?? "";
  const area = (lead as Lead & { area?: string | null }).area ?? null;
  const bed = req.match(/(\d+)\s*(?:bed|br|bhk|বেড)/i)?.[1];
  const budget = req.match(/(\d+(?:\.\d+)?\s*(?:-|–|to)?\s*\d*(?:\.\d+)?\s*(?:cr|crore|lakh|lac|কোটি|লাখ))/i)?.[1];
  const pills = [
    bed && { k: "bed", text: `🛏 ${bed} Bed`, cls: "border-primary/40 bg-primary/15 text-primary" },
    area && { k: "loc", text: `📍 ${area}`, cls: "border-chart-4/40 bg-chart-4/15 text-chart-4" },
    budget && { k: "bud", text: `💰 ${budget.trim()}`, cls: "border-live/40 bg-live/15 text-live" },
  ].filter(Boolean) as { k: string; text: string; cls: string }[];
  if (!pills.length) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {pills.map((p) => (
        <span key={p.k} className={cn("max-w-full truncate rounded-full border px-2.5 py-0.5 text-[11px] font-semibold backdrop-blur-sm", p.cls)}>
          {p.text}
        </span>
      ))}
    </div>
  );
}
