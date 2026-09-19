import type { ReportResult } from "@/lib/crm-reports";

function formatMinutes(minutes: number): string {
  const total = Math.round(minutes);
  const h = Math.floor(total / 60);
  const m = total % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

/** Six headline KPI cards summarising the report's totals for the selected range. */
export function ReportsKpiStrip({ report }: { report: ReportResult }) {
  return (
    <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
      <Kpi
        label="Dials"
        value={report.totals.dials}
        hint={`${report.totals.activeAgents} agents in scope`}
      />
      <Kpi label="Connected" value={report.totals.connected} hint="conversations answered" />
      <Kpi
        label="Connect %"
        value={report.totals.connected > 0 ? `${report.totals.connectRate.toFixed(1)}%` : 0}
        hint="of all dials"
      />
      <Kpi
        label="Talk time"
        value={report.totals.talkMinutes > 0 ? formatMinutes(report.totals.talkMinutes) : 0}
        hint="across every call"
      />
      <Kpi label="New leads" value={report.totals.newLeads} hint="created in range" />
      <Kpi label="Deals won" value={report.totals.dealsWon} hint="closed leads" />
    </section>
  );
}

function Kpi({ label, value, hint }: { label: string; value: string | number; hint: string }) {
  const empty = value === 0 || value === "0";
  return (
    <div className="card-elevated card-pad">
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="tabular mt-1 text-xl font-bold tracking-tight sm:text-2xl">
        {empty ? "0" : value}
      </p>
      <p className="mt-0.5 text-[11px] text-muted-foreground">
        {empty ? "No activity yet" : hint}
      </p>
    </div>
  );
}
