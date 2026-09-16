import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LEAD_STATUSES, type LeadStatus, type Profile } from "@/lib/crm-data";
import { defaultFilters, type ReportFilters } from "@/lib/crm-reports";
import { RotateCcw } from "lucide-react";

const PRESETS = [
  { label: "7 days", days: 7 },
  { label: "30 days", days: 30 },
  { label: "90 days", days: 90 },
] as const;

/** Date range, agent, source and stage filters — inline on desktop, collapsible on mobile. */
export function ReportsFilterBar({
  filters,
  patch,
  setFilters,
  agents,
  sources,
  visible,
}: {
  filters: ReportFilters;
  patch: (next: Partial<ReportFilters>) => void;
  setFilters: (next: ReportFilters) => void;
  agents: Profile[];
  sources: string[];
  visible: boolean;
}) {
  return (
    <section
      className={`card-elevated flex-col gap-3 p-3 sm:p-4 ${visible ? "flex" : "hidden lg:flex"}`}
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
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex min-w-0 flex-col gap-1">
      <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      {children}
    </label>
  );
}
