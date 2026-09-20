import { createFileRoute, useLocation } from "@tanstack/react-router";
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
import { DashboardSubnav } from "@/components/crm/DashboardSubnav";
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

const REPORTS_NAV = [
  { to: "/reports", label: "পারফরম্যান্স" },
  { to: "/reports/agents", label: "এজেন্ট" },
  { to: "/reports/calls", label: "কল রিপোর্ট" },
  { to: "/reports/exports", label: "এক্সপোর্ট" },
] as const;

export function ReportsPage() {
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

function ReportsBoard() {
  const { pathname } = useLocation();
  const data = useSnapshot();
  const { scope } = useMyAccount();
  const canSeeDayExport = scope === "authority" || scope === "coordinator";
  const [filters, setFilters] = useState<ReportFilters>(() => defaultFilters(30));
  const [showFilters, setShowFilters] = useState(false);
  const [trend, setTrend] = useState<"activity" | "pipeline">("activity");

  const sources = useMemo(() => leadSources(data.leads), [data.leads]);
  const agents = useMemo(
    () => data.profiles.filter((p) => p.role === "agent"),
    [data.profiles],
  );
  const report = useMemo(() => buildReport(data, filters), [data, filters]);

  const patch = (next: Partial<ReportFilters>) => setFilters((prev) => ({ ...prev, ...next }));
  const stamp = `${filters.from}_to_${filters.to}`;
  const hasActivity = report.totals.dials > 0 || report.totals.newLeads > 0;

  return (
    <div className="page-stack">
      <ReportsHeader
        onToggleFilters={() => setShowFilters((v) => !v)}
        onExport={() => downloadCsv(`winstone-report_${stamp}.csv`, reportToCsv(report))}
      />
      <DashboardSubnav label="রিপোর্টের অংশ" items={REPORTS_NAV} />

      {(pathname === "/reports" || pathname === "/reports/agents") && (
      <ReportsFilterBar
        filters={filters}
        patch={patch}
        setFilters={setFilters}
        agents={agents}
        sources={sources}
        visible={showFilters}
      />
      )}

      {pathname === "/reports" && <>
      <ReportsKpiStrip report={report} />

      <DailyActivityChart
        report={report}
        trend={trend}
        onTrendChange={setTrend}
        hasActivity={hasActivity}
        onReset={() => setFilters(defaultFilters(30))}
      />
      </>}
      {pathname === "/reports/agents" && <>
      <IntelligenceCards report={report} />

      <AiPerformanceBrief report={report} filters={filters} />

      <AgentPerformanceTable
        report={report}
        stamp={stamp}
        onReset={() => setFilters(defaultFilters(30))}
      />
      </>}
      {pathname === "/reports/calls" && <CallReportsPanel />}
      {pathname === "/reports/exports" && canSeeDayExport && (
        <div className="space-y-4">
          <DayCallExportPanel />
          <SyncedCallsPanel />
        </div>
      )}
      {pathname === "/reports/exports" && !canSeeDayExport && (
        <p className="empty-note">এই এক্সপোর্ট শুধু অনুমোদিত কোঅর্ডিনেটর ও অথরিটির জন্য।</p>
      )}
    </div>
  );
}
