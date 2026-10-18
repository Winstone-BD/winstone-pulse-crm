import { ReportsBoard } from "@/components/crm/reports/ReportsBoard";
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
import { FollowUpHistoryPanel } from "@/components/crm/FollowUpHistoryPanel";
// moved
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
      { title: "Custom Reports — Winstone Pulse" },
      {
        name: "description",
        content:
          "Filterable tele-sales performance reports: dial and connect trends, lead funnel, source mix, agent scorecards and CSV export.",
      },
      { property: "og:title", content: "Custom Reports — Winstone Pulse" },
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

