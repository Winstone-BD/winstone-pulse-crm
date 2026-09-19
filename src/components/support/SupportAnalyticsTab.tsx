import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { useAdminToken } from "@/lib/local-session";
import { supportAnalytics } from "@/lib/support-admin.functions";
import { formatMinutes } from "@/lib/support-shared";

import { SupportStat } from "./SupportStat";

export function SupportAnalyticsTab() {
  const adminToken = useAdminToken();
  const [days, setDays] = useState(30);
  const analytics = useQuery({
    queryKey: ["support", "analytics", days, adminToken],
    queryFn: () => supportAnalytics({ data: { adminToken, days } }),
  });

  if (analytics.isLoading) {
    return (
      <p className="flex items-center gap-2 text-xs text-muted-foreground">
        <Loader2 className="size-3.5 animate-spin" /> Loading…
      </p>
    );
  }
  if (analytics.isError) {
    return (
      <p className="text-sm text-destructive">
        {analytics.error instanceof Error ? analytics.error.message : "Unavailable"}
      </p>
    );
  }

  const data = analytics.data!;
  const totals = data.totals;
  const percent = (value: number | null) => (value === null ? "—" : `${(value * 100).toFixed(0)}%`);

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {[7, 30, 90].map((value) => (
          <Button
            key={value}
            size="sm"
            variant={days === value ? "default" : "outline"}
            className="h-8 text-xs"
            onClick={() => setDays(value)}
          >
            Last {value} days
          </Button>
        ))}
      </div>

      <div className="stat-grid">
        <SupportStat label="Conversations" value={String(totals.conversations)} />
        <SupportStat label="Resolved" value={String(totals.resolved)} />
        <SupportStat label="Handled without a human" value={percent(totals.deflectionRate)} />
        <SupportStat label="Escalated" value={String(totals.escalated)} />
        <SupportStat label="Tickets" value={`${totals.tickets} (${totals.aiCreatedTickets} by AI)`} />
        <SupportStat label="First response" value={formatMinutes(totals.avgFirstResponseMinutes)} />
        <SupportStat label="Resolution time" value={formatMinutes(totals.avgResolutionMinutes)} />
        <SupportStat
          label="CSAT"
          value={
            totals.csatAverage === null
              ? "No ratings yet"
              : `${totals.csatAverage.toFixed(1)}/5 (${totals.csatResponses})`
          }
        />
      </div>

      {totals.slaBreaches > 0 && (
        <p className="rounded-xl border border-destructive/40 bg-destructive/5 p-3 text-xs text-destructive">
          {totals.slaBreaches} conversation(s) passed the first-response target without a human reply.
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-sm font-semibold">By topic</p>
          <ul className="mt-2 space-y-1.5 text-xs">
            {data.byCategory.length === 0 && <li className="text-muted-foreground">No data yet.</li>}
            {data.byCategory.map((row) => (
              <li key={row.category} className="flex items-center justify-between gap-2">
                <span className="capitalize">{row.category.replace(/-/g, " ")}</span>
                <span className="text-muted-foreground">{row.count}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-sm font-semibold">By agent</p>
          <ul className="mt-2 space-y-1.5 text-xs">
            {data.byAgent.length === 0 && (
              <li className="text-muted-foreground">Nothing assigned yet.</li>
            )}
            {data.byAgent.map((row) => (
              <li key={row.name} className="flex items-center justify-between gap-2">
                <span>{row.name}</span>
                <span className="text-muted-foreground">
                  {row.resolved}/{row.assigned} resolved
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
