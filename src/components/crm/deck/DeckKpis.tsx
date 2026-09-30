import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { deckKpis } from "@/lib/lead-pool.functions";
import { useDeckToken as useAdminToken } from "@/lib/local-session";
import { GroupState, MetricGroup } from "@/components/crm/groups";

/** Live LeadHub KPIs — every number comes from the canonical database. */
export function DeckKpis() {
  const adminToken = useAdminToken();
  const fetchKpis = useServerFn(deckKpis);
  const q = useQuery({
    queryKey: ["deck-kpis", adminToken ? "pin" : "session"],
    queryFn: () => fetchKpis({ data: { adminToken } }),
    refetchInterval: 60_000,
  });
  const k = q.data;
  const short = k ? Math.max(0, k.neededToday - k.readyToday) : undefined;
  return (
    <section className="space-y-2">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <MetricGroup
          label="Lead Health"
          loading={q.isLoading}
          error={q.isError}
          metrics={[
            { label: "Canonical Leads", value: k?.totalStore },
            { label: "Unassigned", value: k?.unassigned, tone: "warn" },
            { label: "Assigned", value: k?.assigned },
            { label: "Available Agents", value: k?.availableAgents },
          ]}
        />
        <MetricGroup
          label="Today's Distribution"
          loading={q.isLoading}
          error={q.isError}
          metrics={[
            { label: "Assigned today", value: k?.assignedToday, tone: "ok" },
            {
              label: "Available to distribute",
              value: k?.readyToday,
              tone: k && k.readyToday < k.neededToday ? "bad" : "ok",
              hint: k ? `পুরো কোটায় দরকার ${k.neededToday}` : undefined,
            },
            { label: "Shortage", value: short, tone: short ? "bad" : "ok" },
          ]}
        />
        <MetricGroup
          label="Data Quality"
          loading={q.isLoading}
          error={q.isError}
          metrics={[
            { label: "Duplicate", value: k?.duplicate },
            { label: "Invalid", value: k?.invalid, tone: k?.invalid ? "bad" : undefined, hint: "অবণ্টিত সারি" },
          ]}
        />
      </div>
      {q.isError && <GroupState kind="error" message={`সংখ্যা লোড হয়নি: ${(q.error as Error).message}`} />}
    </section>
  );
}
