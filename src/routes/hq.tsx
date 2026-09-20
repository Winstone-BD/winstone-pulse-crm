import { createFileRoute } from "@tanstack/react-router";
import { ShieldCheck } from "lucide-react";
import { useMemo, useState } from "react";

import { AgentDossier } from "@/components/crm/AgentDossier";
import { FloorAllocationPanel } from "@/components/crm/AllocationStatusCard";
import { FloorPerformancePanel } from "@/components/crm/DailyPerformanceCard";
import { HqDrillSheet, type DrillSpec } from "@/components/crm/HqDrillSheet";
import { CommandAgentPanel } from "@/components/crm/CommandAgentPanel";
import { AskHqPanel } from "@/components/crm/AskHqPanel";
import { ExecutiveBrief } from "@/components/crm/ExecutiveBrief";
import { ShiftSummaryPanel } from "@/components/crm/ShiftSummaryPanel";
import { LeadDossier } from "@/components/crm/LeadDossier";
import { RoleGate } from "@/components/crm/RoleGate";
import { ServiceBillPanel } from "@/components/crm/ServiceBillPanel";
import { SmartInsightStrip } from "@/components/crm/SmartInsightStrip";
import { SnapshotSkeleton } from "@/components/crm/SnapshotSkeleton";
import { AppShell } from "@/components/crm/AppShell";
import { ExecutiveOverview } from "@/components/crm/hq/ExecutiveOverview";
import { HqHeader } from "@/components/crm/hq/HqHeader";
import { HqClassificationTiles } from "@/components/crm/hq/HqClassificationTiles";
import { HqMixCards } from "@/components/crm/hq/HqMixCards";

import { buildTimeline, useSnapshot } from "@/lib/crm-data";

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
  const { profiles, leads, calls, callEvents, messages, events, isPending } = useSnapshot();
  const [openLeadId, setOpenLeadId] = useState<string | null>(null);
  const [openAgentId, setOpenAgentId] = useState<string | null>(null);
  /** Which number card / mix-card row the executive drilled into. */
  const [drill, setDrill] = useState<DrillSpec | null>(null);

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


  const openLead = leads.find((l) => l.id === openLeadId) ?? null;
  const openAgent = profiles.find((p) => p.id === openAgentId) ?? null;

  return (
    <>
      <div className="page-stack">
        <HqHeader />

        <ExecutiveOverview leads={leads} events={events} />

        <FloorAllocationPanel />

        <FloorPerformancePanel />

        <SmartInsightStrip scope="floor" />

        <ExecutiveBrief />

        <ServiceBillPanel mode="hq" />

        <ShiftSummaryPanel scope="hq" />

        <CommandAgentPanel surface="hq" />

        <AskHqPanel />

        <HqClassificationTiles leads={leads} onDrill={setDrill} />

        <HqMixCards
          funnelRows={funnelRows}
          sourceRows={sourceRows}
          loading={isPending}
          onDrill={setDrill}
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
        callEvents={callEvents}
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
