import { createFileRoute } from "@tanstack/react-router";
import {
  BarChart3,
  Flame,
  ListChecks,
  PhoneCall,
  ShieldCheck,
  Snowflake,
  Timer,
  TrendingUp,
  Users,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { AgentDossier } from "@/components/crm/AgentDossier";
import { AgentRadar } from "@/components/crm/AgentRadar";
import { CommandAgentPanel } from "@/components/crm/CommandAgentPanel";
import { AskHqPanel } from "@/components/crm/AskHqPanel";
import { ExecutiveBrief } from "@/components/crm/ExecutiveBrief";
import { ShiftSummaryPanel } from "@/components/crm/ShiftSummaryPanel";
import { Leaderboard } from "@/components/crm/Leaderboard";
import { LeadDossier } from "@/components/crm/LeadDossier";
import { RoleGate } from "@/components/crm/RoleGate";
import { SnapshotSkeleton } from "@/components/crm/SnapshotSkeleton";
import { AppShell } from "@/components/crm/AppShell";

import { HqDrilldown, type Drilldown, type DrillRow } from "@/components/crm/HqDrilldown";

import {
  buildAgentStats,
  buildTimeline,
  CONNECTED_THRESHOLD_SECONDS,
  useSnapshot,
  type CallRecording,
  type Lead,
} from "@/lib/crm-data";
import { formatTalkTime, shortDate } from "@/lib/crm-format";

export const Route = createFileRoute("/hq")({
  head: () => ({
    meta: [
      { title: "Control Board — Tele-Sales CRM OS" },
      {
        name: "description",
        content:
          "Live agent radar, call leaderboard and AI call intelligence for enterprise tele-sales teams.",
      },
      { property: "og:title", content: "Control Board — Tele-Sales CRM OS" },
      {
        property: "og:description",
        content:
          "Track live calls, talk time, verified recordings and AI call summaries in one command center.",
      },
    ],
  }),
  pendingComponent: () => (
    <AppShell>
      <SnapshotSkeleton />
    </AppShell>
  ),
  component: ControlBoardPage,
});

function ControlBoardPage() {
  return (
    <AppShell>
      <RoleGate
        surface="hq"
        allow={["authority"]}
        icon={<ShieldCheck className="size-7" />}
        title="এক্সিকিউটিভ এইচকিউ"
        description="লাইভ রাডার, লিডারবোর্ড, কল অডিট আর যা জানতে চান তার রিপোর্ট। মাস্টার পিন লাগবে।"
      >
        <ControlBoard />
      </RoleGate>
    </AppShell>
  );
}

function ControlBoard() {
  const { profiles, leads, calls, messages, events, isPending } = useSnapshot();
  const [openLeadId, setOpenLeadId] = useState<string | null>(null);
  const [openAgentId, setOpenAgentId] = useState<string | null>(null);
  const [drill, setDrill] = useState<Drilldown | null>(null);

  const agentName = (id: string | null) =>
    profiles.find((p) => p.id === id)?.name ?? "কেউ নেই";

  /** Leads → drilldown rows. */
  const leadRows = (list: Lead[]): DrillRow[] =>
    list.slice(0, 60).map((lead) => ({
      id: lead.id,
      leadId: lead.id,
      primary: lead.name ?? lead.phone_number ?? "লিড",
      secondary: `${lead.phone_number ?? "নম্বর নেই"} · ${agentName(lead.assigned_to)}`,
      meta: shortDate(lead.classified_at ?? lead.last_call_at ?? lead.created_at),
    }));

  /** Calls → drilldown rows. */
  const callRows = (list: CallRecording[]): DrillRow[] =>
    list.slice(0, 60).map((call) => {
      const lead = leads.find((l) => l.id === call.lead_id);
      return {
        id: call.id,
        leadId: lead?.id ?? null,
        primary: lead?.name ?? call.phone_number,
        secondary: `${agentName(call.agent_id)} · ${formatTalkTime(call.duration_seconds)}`,
        meta: shortDate(call.created_at),
      };
    });

  const showDrill = (title: string, subtitle: string, rows: DrillRow[]) =>
    setDrill({ title, subtitle, rows });

  const agents = useMemo(
    () =>
      profiles.filter(
        (p) =>
          (p.role === "agent" || p.role === "team_leader") &&
          p.is_active &&
          p.approval_status === "approved",
      ),
    [profiles],
  );
  const stats = useMemo(
    () => buildAgentStats(profiles, leads, calls, messages),
    [profiles, leads, calls, messages],
  );

  const connected = calls.filter((c) => c.duration_seconds > CONNECTED_THRESHOLD_SECONDS).length;
  const talkSeconds = calls.reduce((sum, c) => sum + c.duration_seconds, 0);
  const unassigned = leads.filter((l) => l.assigned_to === null).length;

  const chartData = stats.map((row) => ({
    name: row.profile.name.split(" ")[0] ?? row.profile.name,
    connected: row.connected,
    talkMinutes: Math.round(row.talkSeconds / 60),
  }));

  const funnelRows = useMemo(() => {
    const order: { key: string; label: string }[] = [
      { key: "pending", label: "নতুন / বাকি" },
      { key: "contacted", label: "কথা হয়েছে" },
      { key: "follow_up", label: "ফলো-আপ" },
      { key: "closed", label: "বন্ধ" },
    ];
    return order.map((o) => ({
      key: o.key,
      label: o.label,
      value: leads.filter((l) => l.status === o.key).length,
    }));
  }, [leads]);

  const sourceRows = useMemo(() => {
    const counts = new Map<string, number>();
    for (const lead of leads) {
      const key = lead.source ?? "unknown";
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([key, value]) => ({ key, label: key.replace(/_/g, " "), value }));
  }, [leads]);

  const sentimentRows = useMemo(() => {
    const labels: Record<string, string> = {
      positive: "পজিটিভ",
      neutral: "নিউট্রাল",
      negative: "নেগেটিভ",
    };
    const counts = new Map<string, number>();
    for (const call of calls) {
      if (!call.sentiment) continue;
      counts.set(call.sentiment, (counts.get(call.sentiment) ?? 0) + 1);
    }
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([key, value]) => ({ label: labels[key] ?? key, value }));
  }, [calls]);

  const openLead = leads.find((l) => l.id === openLeadId) ?? null;
  const openAgent = profiles.find((p) => p.id === openAgentId) ?? null;

  return (
    <>
      <div className="space-y-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary/12 text-primary ring-1 ring-primary/25">
              <BarChart3 className="size-6" />
            </span>
            <div className="min-w-0">
              <h1 className="truncate text-2xl font-bold tracking-tight sm:text-3xl">
                কন্ট্রোল বোর্ড
              </h1>
              <p className="text-xs text-muted-foreground sm:text-sm">
                পুরো ফ্লোরের প্রতিটি কল, রেকর্ডিং আর হোয়াটসঅ্যাপ কথা — সরাসরি লাইভ।
              </p>
            </div>
          </div>
          <p className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground">
            শুধু দেখার ভিউ · লিড অ্যাসাইন হয় কোঅর্ডিনেটর ডেস্ক থেকে
          </p>
        </div>

        <ExecutiveBrief />

        <ShiftSummaryPanel scope="hq" />

        <CommandAgentPanel surface="hq" />

        <AskHqPanel />


        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatTile
            icon={<PhoneCall className="size-4" />}
            label="মোট কল"
            value={String(calls.length)}
            hint={`${connected}টি কল ${CONNECTED_THRESHOLD_SECONDS} সেকেন্ডের বেশি কথা হয়েছে`}
          />
          <StatTile
            icon={<Timer className="size-4" />}
            label="ফ্লোরের কথার সময়"
            value={formatTalkTime(talkSeconds)}
            hint="সব সিঙ্ক হওয়া রেকর্ডিং মিলিয়ে"
          />
          <StatTile
            icon={<Users className="size-4" />}
            label="চালু লিড"
            value={String(leads.filter((l) => l.status !== "closed").length)}
            hint={`${unassigned}টি লিড এখনো কারো নামে দেওয়া হয়নি`}
          />
          <StatTile
            icon={<TrendingUp className="size-4" />}
            label="ডিল জেতা"
            value={String(
              leads.filter((l) => l.status === "closed" && l.outcome_category === "deal_won")
                .length,
            )}
            hint={`${messages.length}টি হোয়াটসঅ্যাপ মেসেজ জমা আছে`}
          />
        </div>

        {/* Classification board: what agents actually decided after talking. */}
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatTile
            icon={<Flame className="size-4" />}
            label="HOT লিড"
            value={String(leads.filter((l) => l.temperature === "hot").length)}
            hint="এজেন্টের নিজের সিদ্ধান্ত অনুযায়ী"
          />
          <StatTile
            icon={<Flame className="size-4" />}
            label="WARM লিড"
            value={String(leads.filter((l) => l.temperature === "warm").length)}
            hint="কিছুটা আগ্রহী"
          />
          <StatTile
            icon={<Snowflake className="size-4" />}
            label="COLD লিড"
            value={String(leads.filter((l) => l.temperature === "cold").length)}
            hint="এখন আগ্রহ কম"
          />
          <StatTile
            icon={<ListChecks className="size-4" />}
            label="বাকি কাজ (PENDING)"
            value={String(leads.filter((l) => l.work_state !== "completed").length)}
            hint={`${leads.filter((l) => l.work_state === "completed").length}টি লিড শ্রেণিবিন্যাসসহ শেষ`}
          />
        </div>

        <div className="grid gap-3 lg:grid-cols-3">
          <MixCard
            title="লিড ফানেল"
            subtitle="নতুন লিড থেকে ডিল পর্যন্ত"
            rows={funnelRows}
          />
          <MixCard title="লিড কোথা থেকে" subtitle="সোর্স অনুযায়ী ভাগ" rows={sourceRows} />
          <MixCard
            title="কলের সুর"
            subtitle="AI-বিশ্লেষিত কথাবার্তা"
            rows={sentimentRows}
            emptyLabel="এখনো AI-বিশ্লেষিত কল নেই"
          />
        </div>

        <AgentRadar agents={agents} calls={calls} onSelectAgent={setOpenAgentId} />

        <section className="space-y-3">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <h2 className="text-lg font-semibold">কথা হওয়া কল ও কথার মিনিট</h2>
              <p className="text-sm text-muted-foreground">প্রতি এজেন্টের সব রেকর্ড করা কাজ</p>
            </div>
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <span className="size-2.5 rounded-sm bg-primary" /> কথা হওয়া কল
              </span>
              <span className="flex items-center gap-1.5">
                <span className="size-2.5 rounded-sm bg-live" /> কথার মিনিট
              </span>
            </div>
          </div>
          <div className="card-elevated h-64 p-2 sm:h-72 sm:p-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="name" stroke="var(--muted-foreground)" fontSize={12} />
                <YAxis stroke="var(--muted-foreground)" fontSize={12} />
                <Tooltip
                  cursor={{ fill: "var(--surface-2)" }}
                  contentStyle={{
                    background: "var(--card)",
                    border: "1px solid var(--border)",
                    borderRadius: 12,
                    fontSize: 12,
                    boxShadow: "var(--shadow-card-hover)",
                  }}
                />
                <Bar dataKey="connected" fill="var(--primary)" radius={[6, 6, 0, 0]} />
                <Bar dataKey="talkMinutes" fill="var(--live)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        <Leaderboard stats={stats} onSelectAgent={setOpenAgentId} />

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">সর্বশেষ কথাবার্তার সারসংক্ষেপ</h2>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {calls
              .filter((c) => c.ai_summary)
              .slice(0, 6)
              .map((call) => {
                const lead = leads.find((l) => l.id === call.lead_id);
                const agent = profiles.find((p) => p.id === call.agent_id);
                return (
                  <button
                    key={call.id}
                    onClick={() => lead && setOpenLeadId(lead.id)}
                    className="card-elevated p-4 text-left transition-colors hover:border-primary/40"
                  >
                    <p className="font-medium">{lead?.name ?? "লিড"}</p>
                    <p className="text-xs text-muted-foreground">{agent?.name}</p>
                    <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">
                      {call.ai_summary}
                    </p>
                  </button>
                );
              })}
          </div>
        </section>
      </div>

      <LeadDossier
        lead={openLead}
        agents={profiles}
        timeline={openLead ? buildTimeline(calls, messages, openLead.id, events) : []}
        open={openLeadId !== null}
        onOpenChange={(next) => !next && setOpenLeadId(null)}
      />
      <AgentDossier
        agent={openAgent}
        leads={leads}
        calls={calls}
        messages={messages}
        open={openAgentId !== null}
        onOpenChange={(next) => !next && setOpenAgentId(null)}
      />
    </>
  );
}

function StatTile({
  icon,
  label,
  value,
  hint,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="card-elevated relative overflow-hidden p-5">
      <span className="absolute -right-6 -top-6 size-20 rounded-full bg-primary/10 blur-2xl" />
      <div className="flex items-start gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-full bg-primary/12 text-primary ring-1 ring-primary/25">
          {icon}
        </span>
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            {label}
          </p>
          <p className="tabular mt-1 text-2xl font-bold tracking-tight sm:text-3xl">{value}</p>
        </div>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">{hint}</p>
      <Sparkline seed={value.length + label.length} />
    </div>
  );
}

/** Compact intelligence card: labelled rows with a proportional bar. */
function MixCard({
  title,
  subtitle,
  rows,
  emptyLabel = "এই সময়ে কোনো তথ্য নেই",
}: {
  title: string;
  subtitle: string;
  rows: { label: string; value: number }[];
  emptyLabel?: string;
}) {
  const total = rows.reduce((sum, r) => sum + r.value, 0);
  const max = rows.reduce((m, r) => Math.max(m, r.value), 0);
  return (
    <section className="card-elevated p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold">{title}</h2>
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        </div>
        <span className="tabular rounded-full border border-border px-2 py-0.5 text-[11px] text-muted-foreground">
          {total}
        </span>
      </div>
      {total === 0 ? (
        <p className="mt-6 mb-2 text-center text-xs text-muted-foreground">{emptyLabel}</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {rows.map((row) => (
            <li key={row.label} className="space-y-1">
              <div className="flex items-baseline justify-between gap-2 text-xs">
                <span className="truncate capitalize">{row.label}</span>
                <span className="tabular text-muted-foreground">
                  {row.value} · {total ? Math.round((row.value / total) * 100) : 0}%
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-surface-2">
                <div
                  className="h-full rounded-full bg-primary"
                  style={{ width: `${max ? (row.value / max) * 100 : 0}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** Tiny decorative sparkline; deterministic per tile so it doesn't jitter on refetch. */
function Sparkline({ seed }: { seed: number }) {
  const points = Array.from({ length: 12 }, (_, i) => {
    const y = 18 - ((Math.sin(i * 0.9 + seed) + 1) * 6 + (i / 11) * 4);
    return `${(i / 11) * 100},${y}`;
  }).join(" ");
  return (
    <svg
      viewBox="0 0 100 20"
      className="mt-3 h-5 w-full text-primary/60"
      preserveAspectRatio="none"
    >
      <polyline points={points} fill="none" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}
