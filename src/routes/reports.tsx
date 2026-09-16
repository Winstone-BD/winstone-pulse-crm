import { createFileRoute } from "@tanstack/react-router";
import {
  BarChart3,
  CircleSlash,
  Download,
  Filter,
  RotateCcw,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import { useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { RoleGate } from "@/components/crm/RoleGate";
import { DayCallExportPanel } from "@/components/crm/DayCallExportPanel";
import { SyncedCallsPanel } from "@/components/crm/SyncedCallsPanel";
import { useMyAccount } from "@/lib/session";
import { AppShell } from "@/components/crm/AppShell";
import { CopilotDrawer } from "@/components/crm/CopilotDrawer";
import { SnapshotSkeleton } from "@/components/crm/SnapshotSkeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LEAD_STATUSES, useSnapshot, type LeadStatus } from "@/lib/crm-data";
import {
  buildReport,
  defaultFilters,
  downloadCsv,
  leadSources,
  reportToCsv,
  toCsv,
  type ReportFilters,
  type ReportResult,
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

const PRESETS = [
  { label: "7 days", days: 7 },
  { label: "30 days", days: 30 },
  { label: "90 days", days: 90 },
] as const;

function ReportsBoard() {
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
  const labelInterval = Math.max(0, Math.ceil(report.daily.length / 8) - 1);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="truncate text-xl font-bold tracking-tight sm:text-2xl">Reports</h1>
          <p className="text-xs text-muted-foreground sm:text-sm">
            Performance &amp; activity intelligence
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="lg:hidden"
            onClick={() => setShowFilters((v) => !v)}
          >
            <Filter className="size-4" /> Filters
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => downloadCsv(`winstone-report_${stamp}.csv`, reportToCsv(report))}
          >
            <Download className="size-4" /> Export
          </Button>
          <CopilotDrawer />
        </div>
      </div>

      {/* Filters — inline on desktop, collapsible drawer on small screens */}
      <section
        className={`card-elevated flex-col gap-3 p-3 sm:p-4 ${
          showFilters ? "flex" : "hidden lg:flex"
        }`}
      >
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:flex xl:flex-wrap xl:items-end">
          <Field label="From">
            <Input
              type="date"
              value={filters.from}
              max={filters.to}
              onChange={(e) => patch({ from: e.target.value })}
              className="h-9 w-full xl:w-[150px]"
            />
          </Field>
          <Field label="To">
            <Input
              type="date"
              value={filters.to}
              min={filters.from}
              onChange={(e) => patch({ to: e.target.value })}
              className="h-9 w-full xl:w-[150px]"
            />
          </Field>
          <Field label="Agent">
            <Select value={filters.agentId} onValueChange={(v) => patch({ agentId: v })}>
              <SelectTrigger className="h-9 w-full xl:w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All agents</SelectItem>
                {agents.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Lead source">
            <Select value={filters.source} onValueChange={(v) => patch({ source: v })}>
              <SelectTrigger className="h-9 w-full xl:w-[165px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All sources</SelectItem>
                {sources.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Lead stage">
            <Select
              value={filters.status}
              onValueChange={(v) => patch({ status: v as LeadStatus | "all" })}
            >
              <SelectTrigger className="h-9 w-full xl:w-[155px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All stages</SelectItem>
                {LEAD_STATUSES.map((s) => (
                  <SelectItem key={s.key} value={s.key}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <div className="col-span-2 flex flex-wrap items-center gap-1.5 sm:col-span-3 xl:col-span-1">
            {PRESETS.map((p) => (
              <Button
                key={p.days}
                variant="secondary"
                size="sm"
                onClick={() => patch(defaultFilters(p.days))}
              >
                {p.label}
              </Button>
            ))}
            <Button variant="ghost" size="sm" onClick={() => setFilters(defaultFilters(30))}>
              <RotateCcw className="size-4" /> Reset
            </Button>
          </div>
        </div>
      </section>

      {/* KPI strip */}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        <Kpi
          label="Dials"
          value={report.totals.dials}
          hint={`${report.totals.activeAgents} agents in scope`}
        />
        <Kpi
          label="Connected"
          value={report.totals.connected}
          hint="conversations answered"
        />
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

      {/* Daily activity — one large chart */}
      <section className="card-elevated p-3 sm:p-4">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
          <div className="min-w-0">
            <h2 className="flex items-center gap-1.5 text-sm font-semibold">
              <TrendingUp className="size-4 shrink-0 text-primary" /> Daily activity
            </h2>
            <p className="text-xs text-muted-foreground">
              {trend === "activity"
                ? "Dials vs connected conversations"
                : "New leads, WhatsApp touches and talk minutes"}
            </p>
          </div>
          <div className="flex shrink-0 gap-1">
            <Button
              size="sm"
              variant={trend === "activity" ? "secondary" : "ghost"}
              onClick={() => setTrend("activity")}
            >
              Calls
            </Button>
            <Button
              size="sm"
              variant={trend === "pipeline" ? "secondary" : "ghost"}
              onClick={() => setTrend("pipeline")}
            >
              Pipeline
            </Button>
          </div>
        </div>

        {!hasActivity ? (
          <EmptyBlock
            title="No activity recorded for this period"
            hint="Adjust the date or filters to view available data."
            onReset={() => setFilters(defaultFilters(30))}
          />
        ) : (
          <div className="mt-3 h-[240px] sm:h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              {trend === "activity" ? (
                <AreaChart data={report.daily} margin={{ top: 6, right: 8, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="rp-dials" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0.02} />
                    </linearGradient>
                    <linearGradient id="rp-conn" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--chart-3)" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="var(--chart-3)" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 11 }}
                    stroke="var(--muted-foreground)"
                    interval={labelInterval}
                    minTickGap={16}
                  />
                  <YAxis
                    tick={{ fontSize: 11 }}
                    stroke="var(--muted-foreground)"
                    allowDecimals={false}
                    width={34}
                  />
                  <Tooltip contentStyle={TOOLTIP} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Area
                    type="monotone"
                    dataKey="dials"
                    name="Dials"
                    stroke="var(--chart-1)"
                    fill="url(#rp-dials)"
                    strokeWidth={2}
                  />
                  <Area
                    type="monotone"
                    dataKey="connected"
                    name="Connected"
                    stroke="var(--chart-3)"
                    fill="url(#rp-conn)"
                    strokeWidth={2}
                  />
                </AreaChart>
              ) : (
                <LineChart data={report.daily} margin={{ top: 6, right: 8, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 11 }}
                    stroke="var(--muted-foreground)"
                    interval={labelInterval}
                    minTickGap={16}
                  />
                  <YAxis
                    tick={{ fontSize: 11 }}
                    stroke="var(--muted-foreground)"
                    allowDecimals={false}
                    width={34}
                  />
                  <Tooltip contentStyle={TOOLTIP} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Line
                    type="monotone"
                    dataKey="newLeads"
                    name="New leads"
                    stroke="var(--chart-1)"
                    strokeWidth={2}
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="whatsapp"
                    name="WhatsApp"
                    stroke="var(--chart-4)"
                    strokeWidth={2}
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="talkMinutes"
                    name="Talk min"
                    stroke="var(--chart-3)"
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              )}
            </ResponsiveContainer>
          </div>
        )}
      </section>

      {/* Business intelligence grid — one card answers one question */}
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <BreakdownCard
          title="Lead funnel"
          subtitle="From new leads to deals"
          rows={report.statusMix}
          emptyHint="No lead activity for this period. Adjust the date or filters."
        />
        <BreakdownCard
          title="Lead source mix"
          subtitle="Where the leads come from"
          rows={report.sourceMix}
          emptyHint="No sourced leads in this range."
        />
        <BreakdownCard
          title="Call sentiment"
          subtitle="AI analysed conversations"
          rows={report.sentimentMix}
          emptyHint="No AI-analysed calls in this range."
        />
      </section>

      {/* AI performance brief — derived only from the numbers above */}
      <section className="card-elevated p-3 sm:p-4">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold">
          <Sparkles className="size-4 shrink-0 text-primary" /> AI performance brief
        </h2>
        <p className="text-xs text-muted-foreground">
          {filters.from} → {filters.to}, from the data in scope
        </p>
        <ul className="mt-3 space-y-1.5 text-sm">
          {brief(report).map((line) => (
            <li key={line} className="flex gap-2">
              <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" />
              <span className="text-muted-foreground">{line}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* Agent performance */}
      <section className="card-elevated p-3 sm:p-4">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold">Agent performance</h2>
            <p className="text-xs text-muted-foreground">
              Activity, connection and conversion overview
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="shrink-0"
            onClick={() =>
              downloadCsv(
                `winstone-agent-scorecard_${stamp}.csv`,
                toCsv(
                  [
                    "Agent",
                    "Employee ID",
                    "Dials",
                    "Connected",
                    "Connect %",
                    "Talk minutes",
                    "WhatsApp",
                    "Assigned",
                    "Deals won",
                    "Conversion %",
                  ],
                  report.rows.map((r) => [
                    r.agent,
                    r.employeeId,
                    r.dials,
                    r.connected,
                    r.connectRate.toFixed(1),
                    r.talkMinutes,
                    r.whatsapp,
                    r.assigned,
                    r.dealsWon,
                    r.conversionRate.toFixed(1),
                  ]),
                ),
              )
            }
          >
            <Download className="size-4" /> Scorecards
          </Button>
        </div>

        {report.rows.length === 0 ? (
          <EmptyBlock
            title="No agents match these filters"
            hint="Widen the date range or clear the agent filter."
            onReset={() => setFilters(defaultFilters(30))}
          />
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[860px] text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                  <th className="py-2 pr-3 font-semibold">Agent</th>
                  <Th>Dials</Th>
                  <Th>Connected</Th>
                  <Th>Connect %</Th>
                  <Th>Talk time</Th>
                  <Th>Avg call</Th>
                  <Th>WhatsApp</Th>
                  <Th>Assigned</Th>
                  <Th>Won</Th>
                  <Th>Conv %</Th>
                  <th className="py-2 font-semibold">Performance</th>
                </tr>
              </thead>
              <tbody className="zebra">
                {report.rows.map((r) => {
                  const top = Math.max(...report.rows.map((x) => x.dials), 1);
                  return (
                    <tr key={r.agentId} className="border-t border-border/70 hover:bg-muted/40">
                      <td className="py-2 pr-3">
                        <span className="font-medium">{r.agent}</span>
                        <span className="ml-2 text-xs text-muted-foreground">{r.employeeId}</span>
                      </td>
                      <Td>{r.dials}</Td>
                      <Td>{r.connected}</Td>
                      <Td>{r.connectRate.toFixed(1)}%</Td>
                      <Td>{formatMinutes(r.talkMinutes)}</Td>
                      <Td>{r.avgCallSeconds}s</Td>
                      <Td>{r.whatsapp}</Td>
                      <Td>{r.assigned}</Td>
                      <Td>{r.dealsWon}</Td>
                      <Td>{r.conversionRate.toFixed(1)}%</Td>
                      <td className="py-2">
                        <div className="h-1.5 w-24 overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full rounded-full bg-primary"
                            style={{ width: `${Math.round((r.dials / top) * 100)}%` }}
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {canSeeDayExport && (
        <div className="space-y-4">
          <DayCallExportPanel />
          <SyncedCallsPanel />
        </div>
      )}
    </div>
  );
}

const TOOLTIP = {
  background: "var(--card)",
  border: "1px solid var(--border)",
  borderRadius: "12px",
  fontSize: 12,
} as const;

function formatMinutes(minutes: number): string {
  const total = Math.round(minutes);
  const h = Math.floor(total / 60);
  const m = total % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

/** Plain-language summary of the numbers already on screen — nothing invented. */
function brief(report: ReportResult): string[] {
  const t = report.totals;
  if (t.dials === 0 && t.newLeads === 0) {
    return ["No activity in this period yet, so there is nothing to summarise."];
  }
  const lines: string[] = [];
  lines.push(
    `${t.dials} dials produced ${t.connected} connected conversations (${t.connectRate.toFixed(1)}% connect rate).`,
  );
  if (t.talkMinutes > 0) {
    lines.push(`${formatMinutes(t.talkMinutes)} of talk time across ${t.activeAgents} agents.`);
  }
  lines.push(`${t.newLeads} new leads created and ${t.dealsWon} deals won in this range.`);
  const top = [...report.rows].sort((a, b) => b.dials - a.dials)[0];
  if (top && top.dials > 0) {
    const share = t.dials > 0 ? Math.round((top.dials / t.dials) * 100) : 0;
    lines.push(`${top.agent} handled ${top.dials} dials — ${share}% of all activity in scope.`);
  }
  if (t.whatsapp > 0) lines.push(`${t.whatsapp} WhatsApp touches were logged alongside calls.`);
  return lines;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex min-w-0 flex-col gap-1">
      <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      {children}
    </label>
  );
}

function Kpi({ label, value, hint }: { label: string; value: string | number; hint: string }) {
  const empty = value === 0 || value === "0";
  return (
    <div className="card-elevated p-3">
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

function BreakdownCard({
  title,
  subtitle,
  rows,
  emptyHint,
}: {
  title: string;
  subtitle: string;
  rows: { key: string; label: string; value: number }[];
  emptyHint: string;
}) {
  const total = rows.reduce((sum, r) => sum + r.value, 0);
  return (
    <div className="card-elevated flex flex-col p-3 sm:p-4">
      <h2 className="text-sm font-semibold">{title}</h2>
      <p className="text-xs text-muted-foreground">{subtitle}</p>
      {total === 0 ? (
        <EmptyBlock title="No data for this period" hint={emptyHint} compact />
      ) : (
        <ul className="mt-3 space-y-2.5">
          {rows.map((r) => {
            const pct = total > 0 ? Math.round((r.value / total) * 100) : 0;
            return (
              <li key={r.key} className="space-y-1">
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="min-w-0 truncate">{r.label}</span>
                  <span className="tabular shrink-0 font-semibold">
                    {r.value}
                    <span className="ml-1 text-xs font-normal text-muted-foreground">{pct}%</span>
                  </span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function EmptyBlock({
  title,
  hint,
  onReset,
  compact = false,
}: {
  title: string;
  hint: string;
  onReset?: () => void;
  compact?: boolean;
}) {
  return (
    <div
      className={`mt-3 rounded-xl border border-dashed border-border text-center ${
        compact ? "p-4" : "p-6 sm:p-8"
      }`}
    >
      <CircleSlash className="mx-auto size-5 text-muted-foreground" />
      <p className="mt-2 text-sm font-medium">{title}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>
      {onReset && (
        <Button variant="outline" size="sm" className="mt-3" onClick={onReset}>
          <RotateCcw className="size-4" /> Adjust filters
        </Button>
      )}
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="py-2 pr-3 text-right font-semibold">{children}</th>;
}

function Td({ children }: { children: React.ReactNode }) {
  return <td className="tabular py-2 pr-3 text-right">{children}</td>;
}
