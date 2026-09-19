import type { CallRecording, Lead, Profile } from "@/lib/crm-data";

/** Latest six AI-summarised calls; tapping one opens the lead's full file. */
export function HqRecentSummaries({
  calls,
  leads,
  profiles,
  onSelectLead,
}: {
  calls: CallRecording[];
  leads: Lead[];
  profiles: Profile[];
  onSelectLead: (leadId: string) => void;
}) {
  return (
    <section className="space-y-3">
      <h2 className="section-title">সর্বশেষ কথাবার্তার সারসংক্ষেপ</h2>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {calls
          .filter((c) => c.ai_summary)
          .slice(0, 6)
          .map((call) => {
            const lead = leads.find((l) => l.id === call.lead_id);
            const agent = profiles.find((p) => p.id === call.agent_id);
            return (
              <button
                key={call.id}
                onClick={() => lead && onSelectLead(lead.id)}
                aria-label={`${lead?.name ?? "লিড"} — কথাবার্তার সারসংক্ষেপ ও পুরো ফাইল / Open call summary and lead file`}
                className="card-elevated p-4 text-left transition-colors hover:border-primary/40 hover:bg-surface-2/40 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none"
              >
                <p className="font-medium">{lead?.name ?? "লিড"}</p>
                <p className="text-xs text-muted-foreground">{agent?.name}</p>
                <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">
                  {call.ai_summary}
                </p>
              </button>
            );
          })}
      </div>
    </section>
  );
}
