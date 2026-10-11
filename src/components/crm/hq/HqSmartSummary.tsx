import { useMemo } from "react";
import { AlertTriangle, Inbox, TrendingUp } from "lucide-react";

import {
  buildAgentStats,
  CONNECTED_THRESHOLD_SECONDS,
  type AgentStats,
} from "@/lib/crm-data";
import { leadOwner } from "@/lib/lead-owner";
import type { CallRecording, Lead, Profile } from "@/lib/crm-types";

/**
 * HQ smart day summary — derived entirely from the existing snapshot and the
 * existing buildAgentStats calculations. No new rules, no server changes:
 * it only re-presents what the CRM already knows about today (Dhaka day).
 */

/** Dhaka calendar date (YYYY-MM-DD) for an instant — same rule as business-day.ts. */
function dhakaToday(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Dhaka",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function isTodayDhaka(iso: string): boolean {
  const d = new Date(iso);
  return (
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Dhaka",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(d) === dhakaToday()
  );
}

/** Fraction of the 09:05–17:30 Dhaka work window that has elapsed (0..1). */
function shiftElapsedFraction(): number {
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Dhaka",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(now);
  const [h, m] = parts.split(":").map(Number);
  const minutes = (h ?? 0) * 60 + (m ?? 0);
  const start = 9 * 60 + 5; // 09:05 briefing
  const end = 17 * 60 + 30; // 17:30 shift end
  if (minutes <= start) return 0;
  if (minutes >= end) return 1;
  return (minutes - start) / (end - start);
}

type Props = {
  profiles: Profile[];
  leads: Lead[];
  calls: CallRecording[];
  messages: Parameters<typeof buildAgentStats>[3];
  onSelectAgent?: (agentId: string) => void;
};

export function HqSmartSummary({ profiles, leads, calls, messages, onSelectAgent }: Props) {
  const summary = useMemo(() => {
    const todayStats = buildAgentStats(profiles, leads, calls, messages, true);
    const active = todayStats.filter(
      (s) => s.profile.is_active && s.profile.approval_status === "approved",
    );

    // --- 1) Agents falling behind today ---
    // Baseline = team median of connected calls today; behind = zero dials,
    // or connected below half the median when the team is producing.
    const connectedSorted = active.map((s) => s.connected).sort((a, b) => a - b);
    const median = connectedSorted.length
      ? connectedSorted[Math.floor(connectedSorted.length / 2)]!
      : 0;
    const behind: AgentStats[] = active
      .filter((s) => s.dials === 0 || (median > 0 && s.connected < median / 2))
      .sort((a, b) => a.connected - b.connected || a.dials - b.dials);

    // --- 2) Untouched leads (assigned but never worked) ---
    const leadIdsWithCalls = new Set(
      calls.filter((c) => c.lead_id).map((c) => c.lead_id as string),
    );
    const untouched = leads.filter(
      (l) =>
        l.status === "pending" &&
        l.work_state !== "completed" &&
        leadOwner(l) &&
        !leadIdsWithCalls.has(l.id),
    );
    const untouchedByAgent = new Map<string, number>();
    for (const l of untouched) {
      const owner = leadOwner(l)!;
      untouchedByAgent.set(owner, (untouchedByAgent.get(owner) ?? 0) + 1);
    }
    const topUntouched = [...untouchedByAgent.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([agentId, count]) => ({
        agentId,
        count,
        name: profiles.find((p) => p.id === agentId)?.name ?? "—",
      }));

    // --- 3) Likely day outcome (pace projection over the shift window) ---
    const todayCalls = calls.filter((c) => isTodayDhaka(c.created_at));
    const connectedToday = todayCalls.filter(
      (c) => c.duration_seconds > CONNECTED_THRESHOLD_SECONDS,
    ).length;
    const closedToday = leads.filter(
      (l) => l.status === "closed" && isTodayDhaka(l.updated_at ?? l.created_at),
    ).length;
    const elapsed = shiftElapsedFraction();
    const projectedConnected =
      elapsed > 0.15 ? Math.round(connectedToday / elapsed) : connectedToday;
    const projectedClosed =
      elapsed > 0.15 ? Math.round(closedToday / elapsed) : closedToday;

    return {
      behind,
      untouchedCount: untouched.length,
      topUntouched,
      connectedToday,
      closedToday,
      projectedConnected,
      projectedClosed,
      elapsed,
      agentCount: active.length,
    };
  }, [profiles, leads, calls, messages]);

  return (
    <section aria-label="আজকের স্মার্ট সারসংক্ষেপ" className="space-y-3">
      <h2 className="font-semibold">আজকের স্মার্ট সারসংক্ষেপ</h2>
      <div className="grid gap-4 md:grid-cols-3">
        {/* Falling behind */}
        <div className="rounded-2xl border border-border bg-background p-4">
          <div className="mb-2 flex items-center gap-2">
            <AlertTriangle className="size-4 text-destructive" />
            <h3 className="text-sm font-semibold">পিছিয়ে থাকা এজেন্ট</h3>
          </div>
          {summary.behind.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              আজ সবাই ({summary.agentCount} জন) স্বাভাবিক গতিতে আছেন।
            </p>
          ) : (
            <ul className="space-y-1.5">
              {summary.behind.slice(0, 5).map((s) => (
                <li key={s.profile.id}>
                  <button
                    type="button"
                    onClick={() => onSelectAgent?.(s.profile.id)}
                    className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left text-xs hover:bg-accent"
                  >
                    <span className="font-medium">{s.profile.name}</span>
                    <span className="text-muted-foreground">
                      {s.dials === 0 ? "আজ কোনো কল নেই" : `${s.connected} সংযুক্ত / ${s.dials} কল`}
                    </span>
                  </button>
                </li>
              ))}
              {summary.behind.length > 5 && (
                <li className="px-2 text-[11px] text-muted-foreground">
                  +আরও {summary.behind.length - 5} জন
                </li>
              )}
            </ul>
          )}
        </div>

        {/* Untouched leads */}
        <div className="rounded-2xl border border-border bg-background p-4">
          <div className="mb-2 flex items-center gap-2">
            <Inbox className="size-4 text-accent-foreground" />
            <h3 className="text-sm font-semibold">অছোঁয়া লিড</h3>
          </div>
          <p className="text-2xl font-bold tabular-nums">{summary.untouchedCount}</p>
          <p className="mb-2 text-xs text-muted-foreground">
            বরাদ্দ আছে, কিন্তু এখনো একটিও কল হয়নি
          </p>
          {summary.topUntouched.length > 0 && (
            <ul className="space-y-1">
              {summary.topUntouched.map((row) => (
                <li
                  key={row.agentId}
                  className="flex items-center justify-between text-xs text-muted-foreground"
                >
                  <span>{row.name}</span>
                  <span className="font-semibold text-foreground">{row.count}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Likely day outcome */}
        <div className="rounded-2xl border border-border bg-background p-4">
          <div className="mb-2 flex items-center gap-2">
            <TrendingUp className="size-4 text-primary" />
            <h3 className="text-sm font-semibold">দিনের সম্ভাব্য ফলাফল</h3>
          </div>
          <div className="space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">আজ সংযুক্ত কল</span>
              <span className="font-semibold tabular-nums">{summary.connectedToday}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">আজ বন্ধ হওয়া লিড</span>
              <span className="font-semibold tabular-nums">{summary.closedToday}</span>
            </div>
            <div className="border-t border-border pt-2">
              <p className="text-muted-foreground">
                {summary.elapsed >= 1
                  ? "শিফট শেষ — চূড়ান্ত ফলাফল উপরের সংখ্যাগুলোই।"
                  : summary.elapsed <= 0.15
                    ? "দিন এখনো শুরু — গতি দেখে প্রক্ষেপণ একটু পরে দেখাবে।"
                    : `এই গতি চললে দিনশেষে আনুমানিক ${summary.projectedConnected} সংযুক্ত কল ও ${summary.projectedClosed} বন্ধ লিড।`}
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
