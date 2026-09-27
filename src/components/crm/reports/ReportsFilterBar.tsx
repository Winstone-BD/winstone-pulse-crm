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
import { RotateCcw, Search, X } from "lucide-react";

const PRESETS = [
  { label: "আজ", days: 1 },
  { label: "৭ দিন", days: 7 },
  { label: "৩০ দিন", days: 30 },
  { label: "৯০ দিন", days: 90 },
] as const;

const SENTIMENTS = [
  { key: "positive", label: "পজিটিভ" },
  { key: "neutral", label: "নিরপেক্ষ" },
  { key: "negative", label: "নেগেটিভ" },
  { key: "critical", label: "ক্রিটিক্যাল" },
] as const;

/** Date range, search, agent, source, stage and sentiment filters — inline on desktop, collapsible on mobile. */
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
  const active: { key: string; label: string; clear: () => void }[] = [];
  if (filters.query.trim())
    active.push({
      key: "query",
      label: `খোঁজ: ${filters.query.trim()}`,
      clear: () => patch({ query: "" }),
    });
  if (filters.agentId !== "all") {
    const agent = agents.find((a) => a.id === filters.agentId);
    active.push({
      key: "agent",
      label: `এজেন্ট: ${agent?.name ?? filters.agentId}`,
      clear: () => patch({ agentId: "all" }),
    });
  }
  if (filters.source !== "all")
    active.push({
      key: "source",
      label: `সোর্স: ${filters.source}`,
      clear: () => patch({ source: "all" }),
    });
  if (filters.status !== "all") {
    const st = LEAD_STATUSES.find((s) => s.key === filters.status);
    active.push({
      key: "status",
      label: `স্ট্যাটাস: ${st?.label ?? filters.status}`,
      clear: () => patch({ status: "all" }),
    });
  }
  if (filters.sentiment !== "all") {
    const se = SENTIMENTS.find((s) => s.key === filters.sentiment);
    active.push({
      key: "sentiment",
      label: `সেন্টিমেন্ট: ${se?.label ?? filters.sentiment}`,
      clear: () => patch({ sentiment: "all" }),
    });
  }

  return (
    <section
      className={`card-elevated flex-col gap-3 p-3 sm:p-4 ${visible ? "flex" : "hidden lg:flex"}`}
    >
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={filters.query}
          onChange={(e) => patch({ query: e.target.value })}
          placeholder="নাম, মোবাইল বা রেফারেন্স দিয়ে খুঁজুন…"
          className="h-10 pl-9"
          aria-label="লিড খুঁজুন"
        />
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:flex xl:flex-wrap xl:items-end">
        <Field label="শুরু">
          <Input
            type="date"
            value={filters.from}
            max={filters.to}
            onChange={(e) => patch({ from: e.target.value })}
            className="h-9 w-full xl:w-[150px]"
          />
        </Field>
        <Field label="শেষ">
          <Input
            type="date"
            value={filters.to}
            min={filters.from}
            onChange={(e) => patch({ to: e.target.value })}
            className="h-9 w-full xl:w-[150px]"
          />
        </Field>
        <Field label="এজেন্ট">
          <Select value={filters.agentId} onValueChange={(v) => patch({ agentId: v })}>
            <SelectTrigger className="h-9 w-full xl:w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">সব এজেন্ট</SelectItem>
              {agents.map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  {a.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="লিড সোর্স">
          <Select value={filters.source} onValueChange={(v) => patch({ source: v })}>
            <SelectTrigger className="h-9 w-full xl:w-[165px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">সব সোর্স</SelectItem>
              {sources.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="লিড স্ট্যাটাস">
          <Select
            value={filters.status}
            onValueChange={(v) => patch({ status: v as LeadStatus | "all" })}
          >
            <SelectTrigger className="h-9 w-full xl:w-[155px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">সব স্ট্যাটাস</SelectItem>
              {LEAD_STATUSES.map((s) => (
                <SelectItem key={s.key} value={s.key}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="সেন্টিমেন্ট">
          <Select value={filters.sentiment} onValueChange={(v) => patch({ sentiment: v })}>
            <SelectTrigger className="h-9 w-full xl:w-[150px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">সব ধরনের</SelectItem>
              {SENTIMENTS.map((s) => (
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
            <RotateCcw className="size-4" /> রিসেট
          </Button>
        </div>
      </div>
      {active.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5" aria-label="সক্রিয় ফিল্টার">
          {active.map((chip) => (
            <button
              key={chip.key}
              type="button"
              onClick={chip.clear}
              className="inline-flex items-center gap-1 rounded-full border border-border bg-secondary px-2.5 py-1 text-xs font-medium text-secondary-foreground transition-colors hover:bg-accent"
            >
              {chip.label}
              <X className="size-3" />
            </button>
          ))}
        </div>
      )}
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
