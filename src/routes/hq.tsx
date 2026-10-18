import { SystemManualCard } from "@/components/crm/SystemManualCard";
import { AgentWorkloadPanel } from "@/components/crm/hq/AgentWorkloadPanel";
import { AgentLeadProgress } from "@/components/crm/hq/AgentLeadProgress";
import { Link, createFileRoute } from "@tanstack/react-router";
import { ChevronDown, ShieldCheck } from "lucide-react";
import { useMemo, useState } from "react";

import { PAGE_SECTIONS, sectionSearch, useSection } from "@/lib/page-sections";
import { Lead360Workspace } from "@/components/crm/hq/Lead360Workspace";

import { AgentDossier } from "@/components/crm/AgentDossier";
import { HqDrillSheet, type DrillSpec } from "@/components/crm/HqDrillSheet";
import { AgentRadar } from "@/components/crm/AgentRadar";
import { CommandAgentPanel } from "@/components/crm/CommandAgentPanel";
import { PipelinePanel } from "@/components/crm/PipelinePanel";
import { AskHqPanel } from "@/components/crm/AskHqPanel";
import { ExecutiveBrief } from "@/components/crm/ExecutiveBrief";
import { ShiftSummaryPanel } from "@/components/crm/ShiftSummaryPanel";
import { Leaderboard } from "@/components/crm/Leaderboard";
import { LeadDossier } from "@/components/crm/LeadDossier";
import { RoleGate } from "@/components/crm/RoleGate";
import { MaintenanceProfileNotice } from "@/components/crm/MaintenanceNotice";
import { SmartInsightStrip } from "@/components/crm/SmartInsightStrip";
import { SnapshotSkeleton } from "@/components/crm/SnapshotSkeleton";
import { AppShell } from "@/components/crm/AppShell";
import { ExecutiveOverview } from "@/components/crm/hq/ExecutiveOverview";
import { SalesCommandCenter } from "@/components/crm/hq/SalesCommandCenter";
import { HqHeader } from "@/components/crm/hq/HqHeader";
import { HqStatTiles } from "@/components/crm/hq/HqStatTiles";
import { HqSmartSummary } from "@/components/crm/hq/HqSmartSummary";
import { HqClassificationTiles } from "@/components/crm/hq/HqClassificationTiles";
import { HqMixCards } from "@/components/crm/hq/HqMixCards";
import { SalesChartsDashboard } from "@/components/crm/SalesChartsDashboard";
import { HqTalkChart } from "@/components/crm/hq/HqTalkChart";
import { HqRecentSummaries } from "@/components/crm/hq/HqRecentSummaries";
import { ExecutiveKpiBoard } from "@/components/crm/hq/ExecutiveKpiBoard";
import { FloorLockAdminPanel } from "@/components/crm/hq/FloorLockAdminPanel";

import { TopPerformerBoard } from "@/components/crm/hq/TopPerformerBoard";
import { MarketNewsFeed } from "@/components/crm/news/MarketNewsFeed";
import { FactsBoard } from "@/components/crm/sales-intel/SalesIntelPanels";
import { AccountabilityReviewPanel } from "@/components/crm/AccountabilityReviewPanel";
import { NeglectDisputePanel } from "@/components/crm/LeadNeglectPanel";
import { SocialHqPanel } from "@/components/crm/social/SocialHqPanel";
import { ReportsBoard } from "@/routes/reports";

import { buildAgentStats, buildTimeline, useSnapshot } from "@/lib/crm-data";

const HQ_TABS = PAGE_SECTIONS["/hq"];

export const Route = createFileRoute("/hq")({
  validateSearch: sectionSearch,
  head: () => ({
    meta: [
      { title: "Control Board — Winstone Pulse" },
      {
        name: "description",
        content:
          "Live agent radar, call leaderboard and AI call intelligence for enterprise tele-sales teams.",
      },
      { property: "og:title", content: "Control Board — Winstone Pulse" },
      {
        property: "og:description",
        content:
          "Track live calls, talk time, verified recordings and AI call summaries in one command center.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
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
  /** Which number card / mix-card row the executive drilled into. */
  const [drill, setDrill] = useState<DrillSpec | null>(null);

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
      label: o.label,
      value: leads.filter((l) => l.status === o.key).length,
      leads: leads.filter((l) => l.status === o.key),
    }));
  }, [leads]);

  const sourceRows = useMemo(() => {
    const counts = new Map<string, number>();
    for (const lead of leads) {
      const key = (lead.source ?? "unknown").replace(/_/g, " ");
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([label, value]) => ({
        label,
        value,
        leads: leads.filter((l) => (l.source ?? "unknown").replace(/_/g, " ") === label),
      }));
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
      .map(([key, value]) => ({
        label: labels[key] ?? key,
        value,
        calls: calls.filter((c) => c.sentiment === key),
      }));
  }, [calls]);

  const openLead = leads.find((l) => l.id === openLeadId) ?? null;
  const openAgent = profiles.find((p) => p.id === openAgentId) ?? null;
  const [tab, setTab] = useSection("/hq");
  const activeLabel = HQ_TABS.find((t) => t.key === tab)?.label ?? "";

  return (
    <>
      <div className="hq-luxe space-y-6 rounded-3xl p-3 sm:p-5">
        <HqHeader />

        <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
          {/* Mobile: collapsible tab menu */}
          <details className="group rounded-xl border border-border bg-card lg:hidden">
            <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-sm font-semibold [&::-webkit-details-marker]:hidden">
              <span>{activeLabel}</span>
              <ChevronDown className="size-4 text-muted-foreground transition-transform group-open:rotate-180" />
            </summary>
            <nav aria-label="HQ sections" className="flex flex-col gap-1 border-t border-border p-2">
              {HQ_TABS.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  onClick={(e) => {
                    setTab(t.key);
                    e.currentTarget.closest("details")?.removeAttribute("open");
                  }}
                  aria-current={tab === t.key ? "page" : undefined}
                  className={`rounded-lg px-3 py-2.5 text-left text-sm font-semibold transition-colors ${
                    tab === t.key
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-accent hover:text-foreground"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </nav>
          </details>

          {/* White content surface */}
          <div className="min-w-0 flex-1 rounded-2xl border border-border bg-card p-4 text-card-foreground shadow-sm sm:p-6">
            <MaintenanceProfileNotice />
            {tab === "overview" && (
              <div className="space-y-8">
                <AgentWorkloadPanel />
                <HqSmartSummary
                  profiles={profiles}
                  leads={leads}
                  calls={calls}
                  messages={messages}
                  onSelectAgent={setOpenAgentId}
                />
                <SalesChartsDashboard scope="hq" />
                <SalesCommandCenter
                  profiles={profiles}
                  leads={leads}
                  calls={calls}
                  loading={isPending}
                  onDrill={setDrill}
                  onSelectAgent={setOpenAgentId}
                />
                <div className="grid gap-4 lg:grid-cols-2">
                  <section className="rounded-2xl border border-border bg-background p-4">
                    <div className="flex items-center justify-between gap-2">
                      <h2 className="font-semibold">আজকের মার্কেট ব্রিফ</h2>
                      <Link to="/news" className="text-xs font-medium text-primary hover:underline">সব খবর →</Link>
                    </div>
                    <MarketNewsFeed compact />
                  </section>
                  <section className="rounded-2xl border border-border bg-background p-4">
                    <h2 className="font-semibold">প্রপার্টি ও প্রজেক্ট আপডেট</h2>
                    <p className="mb-2 text-xs text-muted-foreground">শুধু যাচাই-কৃত ও প্রকাশিত তথ্য — না থাকলে খালি।</p>
                    <FactsBoard category="project_property" admin={false} />
                  </section>
                </div>
                <SystemManualCard />
                <ExecutiveKpiBoard
                  profiles={profiles}
                  leads={leads}
                  calls={calls}
                  messages={messages}
                />
                <SmartInsightStrip scope="floor" />
                <ExecutiveBrief />
                <HqStatTiles calls={calls} leads={leads} messages={messages} onDrill={setDrill} />
              </div>
            )}

            {tab === "performance" && (
              <div className="space-y-8">
                <TopPerformerBoard stats={stats} onSelectAgent={setOpenAgentId} />
                <ExecutiveOverview
                  profiles={profiles}
                  leads={leads}
                  calls={calls}
                  messages={messages}
                  events={events}
                  onSelectAgent={setOpenAgentId}
                />
                <AgentRadar agents={agents} calls={calls} onSelectAgent={setOpenAgentId} />
                <HqTalkChart chartData={chartData} />
                <Leaderboard stats={stats} onSelectAgent={setOpenAgentId} />
              </div>
            )}

            {tab === "leads" && (
              <div className="space-y-8">
                <AgentLeadProgress agents={agents} leads={leads} calls={calls} loading={isPending} onOpen={setOpenLeadId} />
                <HqClassificationTiles leads={leads} onDrill={setDrill} />
                <HqMixCards
                  funnelRows={funnelRows}
                  sourceRows={sourceRows}
                  sentimentRows={sentimentRows}
                  loading={isPending}
                  onDrill={setDrill}
                />
                <HqRecentSummaries
                  calls={calls}
                  leads={leads}
                  profiles={profiles}
                  onSelectLead={setOpenLeadId}
                />
              </div>
            )}

            {tab === "followups" && <ReportsBoard />}

            {tab === "lead360" && <Lead360Workspace />}

            {tab === "tools" && (
              <div className="space-y-8">
                <SystemManualCard />
                <AccountabilityReviewPanel surface="hq" />
                <NeglectDisputePanel />
                <SocialHqPanel />
                <FloorLockAdminPanel />
                <ShiftSummaryPanel scope="hq" />
                <CommandAgentPanel surface="hq" />
                <PipelinePanel />
                <AskHqPanel />
              </div>
            )}
          </div>
        </div>
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
      <HqDrillSheet
        spec={drill}
        profiles={profiles}
        leads={leads}
        loading={isPending}
        open={drill !== null}
        onOpenChange={(next) => !next && setDrill(null)}
        onSelectLead={(leadId) => {
          setDrill(null);
          setOpenLeadId(leadId);
        }}
      />
    </>
  );
}
