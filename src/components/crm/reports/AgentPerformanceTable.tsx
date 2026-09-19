import type { ReactNode } from "react";
import { Download } from "lucide-react";

import { Button } from "@/components/ui/button";
import { toCsv, downloadCsv, type ReportResult } from "@/lib/crm-reports";

import { EmptyBlock } from "./EmptyBlock";

function formatMinutes(minutes: number): string {
  const total = Math.round(minutes);
  const h = Math.floor(total / 60);
  const m = total % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

/** Per-agent activity, connection and conversion scorecard table with CSV export. */
export function AgentPerformanceTable({
  report,
  stamp,
  onReset,
}: {
  report: ReportResult;
  stamp: string;
  onReset: () => void;
}) {
  return (
    <section className="card-elevated card-pad">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
        <div className="min-w-0">
          <h2 className="section-title">Agent performance</h2>
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
          onReset={onReset}
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
  );
}

function Th({ children }: { children: ReactNode }) {
  return <th className="py-2 pr-3 text-right font-semibold">{children}</th>;
}

function Td({ children }: { children: ReactNode }) {
  return <td className="tabular py-2 pr-3 text-right">{children}</td>;
}
