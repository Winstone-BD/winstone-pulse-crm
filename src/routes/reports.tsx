import { createFileRoute } from "@tanstack/react-router";
import { BarChart3 } from "lucide-react";
import { useMemo, useState } from "react";

import { RoleGate } from "@/components/crm/RoleGate";
import { DayCallExportPanel } from "@/components/crm/DayCallExportPanel";
import { SyncedCallsPanel } from "@/components/crm/SyncedCallsPanel";
import { CallReportsPanel } from "@/components/crm/CallReportsPanel";
import { useMyAccount } from "@/lib/session";
import { AppShell } from "@/components/crm/AppShell";
import { SnapshotSkeleton } from "@/components/crm/SnapshotSkeleton";
import { ReportsHeader } from "@/components/crm/reports/ReportsHeader";
import { ReportsFilterBar } from "@/components/crm/reports/ReportsFilterBar";
import { ReportsKpiStrip } from "@/components/crm/reports/ReportsKpiStrip";
import { DailyActivityChart } from "@/components/crm/reports/DailyActivityChart";
import { IntelligenceCards, AiPerformanceBrief } from "@/components/crm/reports/IntelligenceCards";
import { AgentPerformanceTable } from "@/components/crm/reports/AgentPerformanceTable";
import { ProjectReportPanel } from "@/components/crm/reports/ProjectReportPanel";
import { useSnapshot } from "@/lib/crm-data";
import {
  buildReport,
  defaultFilters,
  downloadCsv,
  leadSources,
  reportToCsv,
  type ReportFilters,
} from "@/lib/crm-reports";

export const Route = createFileRoute("/reports")({
  head: () => ({
    meta: [
      { title: "Custom Reports — Winstone Connect" },
      {
        name: "description",
        content:
          "Filterable tele-sales performance reports: dial and connect trends, lead funnel, source mix, agent scorecards and CSV export.",
      },
      { property: "og:title", content: "Custom Reports — Winstone Connect" },
      {
        property: "og:description",
        content: "Charts, filters and CSV export for call activity, lead funnel and agent output.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  pendingComponent: () => (
    <AppShell>
      <SnapshotSkeleton />
    </AppShell>
  ),
  component: ReportsPage,
});

function ReportsPage() {
  return (
    <AppShell>
      <RoleGate
        allow={["authority", "coordinator", "agent"]}
        icon={<BarChart3 className="size-7" />}
        title="Reports"
        description="Performance charts, filters and exports. Sign in to your desk or enter the master PIN."
      >
        <ReportsBoard />
      </RoleGate>
    </AppShell>
  );
}

export function ReportsBoard() {
  const data = useSnapshot();
  const { scope } = useMyAccount();
  const canSeeDayExport = scope === "authority" || scope === "coordinator";
  const [filters, setFilters] = useState<ReportFilters>(() => defaultFilters(30));
  const [showFilters, setShowFilters] = useState(false);
  const [trend, setTrend] = useState<"activity" | "pipeline">("activity");

  const sources = useMemo(() => leadSources(data.leads), [data.leads]);
  const agents = useMemo(
    () => data.profiles.filter((p) => p.role === "agent" || p.role === "team_leader"),
    [data.profiles],
  );
  const report = useMemo(() => buildReport(data, filters), [data, filters]);

  const patch = (next: Partial<ReportFilters>) => setFilters((prev) => ({ ...prev, ...next }));
  const stamp = `${filters.from}_to_${filters.to}`;
  const hasActivity = report.totals.dials > 0 || report.totals.newLeads > 0;

  return (
    <div className="space-y-5">
      <ReportsHeader
        onToggleFilters={() => setShowFilters((v) => !v)}
        onExport={() => downloadCsv(`winstone-report_${stamp}.csv`, reportToCsv(report))}
      />

      <ReportsFilterBar
        filters={filters}
        patch={patch}
        setFilters={setFilters}
        agents={agents}
        sources={sources}
        visible={showFilters}
      />

      <ReportsKpiStrip report={report} />

      <DailyActivityChart
        report={report}
        trend={trend}
        onTrendChange={setTrend}
        hasActivity={hasActivity}
        onReset={() => setFilters(defaultFilters(30))}
      />

      <IntelligenceCards report={report} />

      <AiPerformanceBrief report={report} filters={filters} />

      <AgentPerformanceTable
        report={report}
        stamp={stamp}
        onReset={() => setFilters(defaultFilters(30))}
      />

      <ProjectReportPanel />

      <CallReportsPanel />

      {canSeeDayExport && (
        <div className="space-y-4">
          <DayCallExportPanel />
          <SyncedCallsPanel />
        </div>
      )}
    </div>
  );
}
