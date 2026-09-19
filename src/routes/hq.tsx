import { createFileRoute } from "@tanstack/react-router";
import { ShieldCheck } from "lucide-react";
import { useMemo, useState } from "react";

import { AgentDossier } from "@/components/crm/AgentDossier";
import { HqDrillSheet, type DrillSpec } from "@/components/crm/HqDrillSheet";
import { AgentRadar } from "@/components/crm/AgentRadar";
import { CommandAgentPanel } from "@/components/crm/CommandAgentPanel";
import { AskHqPanel } from "@/components/crm/AskHqPanel";
import { ExecutiveBrief } from "@/components/crm/ExecutiveBrief";
import { ShiftSummaryPanel } from "@/components/crm/ShiftSummaryPanel";
import { Leaderboard } from "@/components/crm/Leaderboard";
import { LeadDossier } from "@/components/crm/LeadDossier";
import { RoleGate } from "@/components/crm/RoleGate";
import { ServiceBillPanel } from "@/components/crm/ServiceBillPanel";
import { SmartInsightStrip } from "@/components/crm/SmartInsightStrip";
import { SnapshotSkeleton } from "@/components/crm/SnapshotSkeleton";
import { AppShell } from "@/components/crm/AppShell";
import { ExecutiveOverview } from "@/components/crm/hq/ExecutiveOverview";
import { HqHeader } from "@/components/crm/hq/HqHeader";
import { HqStatTiles } from "@/components/crm/hq/HqStatTiles";
import { HqClassificationTiles } from "@/components/crm/hq/HqClassificationTiles";
import { HqMixCards } from "@/components/crm/hq/HqMixCards";
import { HqTalkChart } from "@/components/crm/hq/HqTalkChart";
import { HqRecentSummaries } from "@/components/crm/hq/HqRecentSummaries";

import { buildAgentStats, buildTimeline, useSnapshot } from "@/lib/crm-data";

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

  return (
    <>
      <div className="page-stack">
        <HqHeader />

        <ExecutiveOverview
          profiles={profiles}
          leads={leads}
          calls={calls}
          messages={messages}
          events={events}
          onSelectAgent={setOpenAgentId}
        />

        <SmartInsightStrip scope="floor" />

        <ExecutiveBrief />

        <ServiceBillPanel mode="hq" />

        <ShiftSummaryPanel scope="hq" />

        <CommandAgentPanel surface="hq" />

        <AskHqPanel />

        <HqStatTiles calls={calls} leads={leads} messages={messages} onDrill={setDrill} />

        <HqClassificationTiles leads={leads} onDrill={setDrill} />

        <HqMixCards
          funnelRows={funnelRows}
          sourceRows={sourceRows}
          sentimentRows={sentimentRows}
          loading={isPending}
          onDrill={setDrill}
        />

        <AgentRadar agents={agents} calls={calls} onSelectAgent={setOpenAgentId} />

        <HqTalkChart chartData={chartData} />

        <Leaderboard stats={stats} onSelectAgent={setOpenAgentId} />

        <HqRecentSummaries
          calls={calls}
          leads={leads}
          profiles={profiles}
          onSelectLead={setOpenLeadId}
        />
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
