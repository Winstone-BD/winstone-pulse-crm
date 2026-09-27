import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Lock, Send, Shuffle, Users } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { QueueBoard } from "@/components/crm/QueueBoard";
import { AssignmentHistory } from "@/components/crm/AssignmentHistory";
import { CallOpsPanel } from "@/components/crm/CallOpsPanel";
import { SelfClaimsFeed } from "@/components/crm/SelfClaimsFeed";
import { RoleGate } from "@/components/crm/RoleGate";
import { SmartInsightStrip } from "@/components/crm/SmartInsightStrip";
import { SnapshotSkeleton } from "@/components/crm/SnapshotSkeleton";
import { AppShell } from "@/components/crm/AppShell";
import { CommandAgentPanel } from "@/components/crm/CommandAgentPanel";
import { CopilotDrawer } from "@/components/crm/CopilotDrawer";
import { CsvImportDialog } from "@/components/crm/CsvImportDialog";
import { ExtraLeadPanel } from "@/components/crm/ExtraLeadPanel";
import { LeadDatabasePanel } from "@/components/crm/LeadDatabasePanel";
import { TeamSupportInbox } from "@/components/crm/TeamSupportInbox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { buildAgentStats, useSnapshot } from "@/lib/crm-data";
import { assignLeadsToAgent, autoDistributeLeads } from "@/lib/crm.functions";
import { formatTalkTime } from "@/lib/crm-format";
import { getAdminToken } from "@/lib/local-session";
import { useMyAccount } from "@/lib/session";
import { HeadLeadIntakePanel } from "@/components/crm/HeadLeadIntakePanel";
import { DeckReadinessPanel } from "@/components/crm/DeckReadinessPanel";
import { DeckLeadSearch } from "@/components/crm/DeckLeadSearch";
import { AllocationProgress } from "@/components/crm/deck/AllocationProgress";
import { DeckKpis } from "@/components/crm/deck/DeckKpis";
import { ImportHistoryPanel } from "@/components/crm/deck/ImportHistoryPanel";
import { LeadStorePanel } from "@/components/crm/deck/LeadStorePanel";
import { FollowUpCalendar } from "@/components/crm/FollowUpCalendar";
import { CallReportsPanel } from "@/components/crm/CallReportsPanel";
import { usePersistentTab } from "@/lib/use-persistent-tab";
import { AllocationTable, AssignLeadsWorkspace } from "@/components/crm/deck/AssignLeadsWorkspace";
import { CoordinatorDeckGate } from "@/components/crm/deck/CoordinatorDeckGate";

const DECK_TABS = [
  { key: "store", label: "Lead Head Data" },
  { key: "assign", label: "Assign Leads" },
  { key: "dashboard", label: "Dashboard" },
  { key: "import", label: "Import Leads" },
  { key: "distribution", label: "Distribution" },
  { key: "agents", label: "Agents" },
  { key: "followups", label: "Follow-ups" },
  { key: "reports", label: "Call Reports" },
  { key: "quality", label: "Data Quality" },
  { key: "activity", label: "Activity Log" },
] as const;
type DeckTab = (typeof DECK_TABS)[number]["key"];

export const Route = createFileRoute("/dispatch")({
  head: () => ({
    meta: [
      { title: "Lead Dispatcher — Winstone Connect" },
      {
        name: "description",
        content:
          "Coordinator desk: see each agent's lead load, push bulk batches and balance the floor in one click.",
      },
      { property: "og:title", content: "Lead Dispatcher — Winstone Connect" },
      {
        property: "og:description",
        content: "Assign, balance and monitor lead distribution across your tele-sales floor.",
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
  component: DispatchPage,
});

function DispatchPage() {
  const { account, isPending } = useMyAccount();
  // Sell Team Admin (WIN2607): intake-only deck. Server enforces the same rule.
  if (!isPending && account?.deck === "intake") {
    return (
      <AppShell>
        <IntakeDeck />
      </AppShell>
    );
  }
  return (
    <AppShell>
      <CoordinatorDeckGate>
      <RoleGate
        allow={["authority", "coordinator"]}
        icon={<Users className="size-7" />}
        title="Team Coordinator Desk"
        description="Lead dispatching, team load and the full floor queue. Coordinator account or master PIN."
      >
        <Dispatcher />
      </RoleGate>
      </CoordinatorDeckGate>
    </AppShell>
  );
}

function IntakeDeck() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold tracking-tight sm:text-2xl">
          কোঅর্ডিনেটর ডেক / Coordinator Deck
        </h1>
        <p className="text-xs text-muted-foreground sm:text-sm">
          সেল টিম অ্যাডমিন — হেড ডেটাবেজে লিড যোগ ও বণ্টনের প্রস্তুতি দেখা
        </p>
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <HeadLeadIntakePanel />
        <DeckReadinessPanel />
      </div>
      <DeckLeadSearch agents={[]} full={false} />
    </div>
  );
}

function Dispatcher() {
  const { profiles, leads, calls, messages } = useSnapshot();
  const queryClient = useQueryClient();
  const assign = useServerFn(assignLeadsToAgent);
  const distribute = useServerFn(autoDistributeLeads);

  const stats = useMemo(
    () => buildAgentStats(profiles, leads, calls, messages),
    [profiles, leads, calls, messages],
  );
  const agents = stats.map((s) => s.profile);
  const [agentId, setAgentId] = useState(agents[0]?.id ?? "");
  const [count, setCount] = useState("20");

  const unassigned = leads.filter((l) => l.assigned_to === null).length;
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["crm-snapshot"] });

  const push = useMutation({
    mutationFn: () =>
      assign({
        data: {
          adminToken: getAdminToken() ?? "",
          agentId,
          count: Math.max(1, Number(count) || 1),
          onlyUnassigned: true,
        },
      }),
    onSuccess: (result) => {
      toast.success(
        result.assigned
          ? `${result.assigned} leads pushed to ${agents.find((a) => a.id === agentId)?.name}`
          : "No unassigned pending leads left",
      );
      void refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const balance = useMutation({
    mutationFn: () => distribute({ data: { adminToken: getAdminToken() ?? "" } }),
    onSuccess: (result) => {
      toast.success(
        result.assigned
          ? `${result.assigned} leads spread across ${result.agents} agents`
          : "Every lead already has an owner",
      );
      void refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const agentOptions = agents.map((a) => ({ id: a.id, name: a.name }));
  const [tab, setTab] = usePersistentTab<DeckTab>("deck:last-tab", DECK_TABS.map((t) => t.key), "store");
  const [assignFor, setAssignFor] = useState<string | undefined>(undefined);
  const openAssign = (id?: string) => { setAssignFor(id); setTab("assign"); };

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-primary">Distribution Command Center</p>
          <h1 className="text-xl font-bold tracking-tight sm:text-2xl">Coordinator Deck</h1>
          <p className="text-xs text-muted-foreground sm:text-sm">
            Head Lead Store → Coordinator Deck → Agent Queue · {unassigned} waiting for an owner
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <CsvImportDialog />
          <CopilotDrawer />
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[210px_minmax(0,1fr)]">
        <nav aria-label="Coordinator Deck" className="flex gap-1 overflow-x-auto lg:sticky lg:top-4 lg:flex-col lg:self-start">
          {DECK_TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              aria-current={tab === t.key ? "page" : undefined}
              className={`whitespace-nowrap rounded-lg px-3 py-2 text-left text-sm transition ${
                tab === t.key
                  ? "bg-primary text-primary-foreground font-semibold shadow-sm"
                  : "text-foreground hover:bg-surface-2"
              }`}
            >
              {t.label}
            </button>
          ))}
        </nav>

        <div className="min-w-0 space-y-6">
          {tab === "dashboard" && (
            <>
              <DeckKpis />
              <Button size="lg" onClick={() => openAssign()}>
                <Send className="size-4" /> Assign Leads
              </Button>
              <AllocationTable onAssign={(id) => openAssign(id)} />
              <SmartInsightStrip scope="floor" />
              <div className="grid gap-6 lg:grid-cols-2">
                <DeckReadinessPanel />
                <HeadLeadIntakePanel />
              </div>
            </>
          )}
          {tab === "assign" && (
            <>
              <AssignLeadsWorkspace key={assignFor ?? "new"} initialAgentId={assignFor} />
              <AllocationTable onAssign={(id) => openAssign(id)} />
            </>
          )}
          {tab === "store" && (
            <>
              <HeadLeadIntakePanel />
              <LeadStorePanel agents={agentOptions} canAssign />
            </>
          )}
          {tab === "import" && (
            <>
              <section className="card-elevated space-y-2 p-4">
                <h2 className="text-sm font-semibold">Import Leads</h2>
                <p className="text-xs text-muted-foreground">
                  Upload CSV/Excel → mapping → phone normalization → duplicate check → preview → confirm →
                  Head Lead Store (UNASSIGNED). Imports never go straight to an agent.
                </p>
                <div className="flex flex-wrap gap-2">
                  <CsvImportDialog />
                  <Button asChild variant="secondary" size="sm">
                    <Link to="/import">Full import screen (Sheet / Excel)</Link>
                  </Button>
                </div>
              </section>
              <ImportHistoryPanel />
            </>
          )}
          {tab === "distribution" && (
            <>
              <AllocationProgress />
              <LeadDatabasePanel />
              <LeadStorePanel agents={agentOptions} canAssign defaultAssignment="unassigned" title="Unassigned Lead Pool — manual assignment" />
              <ExtraLeadPanel />
      <section className="card-elevated p-4">
        <h2 className="text-sm font-semibold">Quick push (oldest eligible first)</h2>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Select value={agentId} onValueChange={setAgentId}>
            <SelectTrigger className="w-full sm:w-[240px]">
              <SelectValue placeholder="Choose agent" />
            </SelectTrigger>
            <SelectContent>
              {agents.map((agent) => (
                <SelectItem key={agent.id} value={agent.id}>
                  {agent.name}
                  {agent.employee_id ? ` · ${agent.employee_id}` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            value={count}
            onChange={(e) => setCount(e.target.value.replace(/\D/g, ""))}
            className="w-20 sm:w-24"
            inputMode="numeric"
            placeholder="20"
          />
          <Button
            className="flex-1 sm:flex-none"
            onClick={() => push.mutate()}
            disabled={!agentId || push.isPending}
          >
            {push.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Send className="size-4" />
            )}
            Push leads
          </Button>
          <Button
            variant="secondary"
            className="flex-1 sm:flex-none"
            onClick={() => balance.mutate()}
            disabled={balance.isPending}
          >
            {balance.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Shuffle className="size-4" />
            )}
            Auto distribute (daily quota) {unassigned > 0 ? `(${unassigned})` : ""}
          </Button>
        </div>
      </section>

              <AssignmentHistory />
            </>
          )}
          {tab === "agents" && (
            <>
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Team load</h2>
        <div className="overflow-x-auto card-elevated">
          <table className="w-full min-w-[900px] text-sm">
            <thead className="bg-surface-2 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-2 text-left">Agent</th>
                <th className="px-4 py-2 text-right">Assigned</th>
                <th className="px-4 py-2 text-right">Pending</th>
                <th className="px-4 py-2 text-right">Open work</th>
                <th className="px-4 py-2 text-right">Connected</th>
                <th className="px-4 py-2 text-right">Hot</th>
                <th className="px-4 py-2 text-right">Warm</th>
                <th className="px-4 py-2 text-right">Cold</th>
                <th className="px-4 py-2 text-right">Talk time</th>
                <th className="px-4 py-2 text-right">Won</th>
              </tr>
            </thead>
            <tbody>
              {stats.map((row) => {
                const pending = leads.filter(
                  (l) => l.assigned_to === row.profile.id && l.status === "pending",
                ).length;
                return (
                  <tr key={row.profile.id} className="border-t border-border/70">
                    <td className="px-4 py-2">
                      <span className="font-medium">{row.profile.name}</span>
                      {row.profile.employee_id && (
                        <span className="ml-2 text-xs text-muted-foreground">
                          {row.profile.employee_id}
                        </span>
                      )}
                    </td>
                    <td className="tabular px-4 py-2 text-right">{row.assigned}</td>
                    <td className="tabular px-4 py-2 text-right">{pending}</td>
                    <td className="tabular px-4 py-2 text-right">{row.pendingWork}</td>
                    <td className="tabular px-4 py-2 text-right">{row.connected}</td>
                    <td className="tabular px-4 py-2 text-right">{row.hot}</td>
                    <td className="tabular px-4 py-2 text-right">{row.warm}</td>
                    <td className="tabular px-4 py-2 text-right">{row.cold}</td>
                    <td className="tabular px-4 py-2 text-right">
                      {formatTalkTime(row.talkSeconds)}
                    </td>
                    <td className="tabular px-4 py-2 text-right">{row.closedWon}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

              <TeamSupportInbox />
            </>
          )}
          {tab === "followups" && <FollowUpCalendar />}
          {tab === "reports" && (
            <>
              <CallReportsPanel />
              <CallOpsPanel />
            </>
          )}
          {tab === "quality" && (
            <>
              <LeadStorePanel agents={agentOptions} canAssign={false} defaultQuality="invalid_phone" title="Data Quality — invalid phones" />
              <LeadStorePanel agents={agentOptions} canAssign={false} defaultAssignment="duplicate" title="Duplicates (parked, never deleted)" />
              <LeadStorePanel agents={agentOptions} canAssign={false} defaultQuality="missing_reference" title="Missing Reference By" />
            </>
          )}
          {tab === "activity" && (
            <>
              <AssignmentHistory />
              <SelfClaimsFeed />
              <CommandAgentPanel surface="dispatch" />
              <QueueBoard title="Agent Queue" canSeeAllAgents showManualLog />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
