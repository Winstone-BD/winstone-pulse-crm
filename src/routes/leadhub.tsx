import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Database, FileUp, History, KeyRound, Send, ShieldCheck } from "lucide-react";
import { useState } from "react";

import { AppShell } from "@/components/crm/AppShell";
import { CsvImportDialog } from "@/components/crm/CsvImportDialog";
import { LeadDatabasePanel } from "@/components/crm/LeadDatabasePanel";
import { HeadLeadIntakePanel } from "@/components/crm/HeadLeadIntakePanel";
import { SnapshotSkeleton } from "@/components/crm/SnapshotSkeleton";
import { AllocationTable, AssignLeadsWorkspace } from "@/components/crm/deck/AssignLeadsWorkspace";
import { DeckKpis } from "@/components/crm/deck/DeckKpis";
import { ImportHistoryPanel } from "@/components/crm/deck/ImportHistoryPanel";
import { LeadStorePanel } from "@/components/crm/deck/LeadStorePanel";
import { Button } from "@/components/ui/button";
import { checkLeadHubAccess } from "@/lib/leadhub.functions";
import { LeadHubTokenScope, useLeadHubToken } from "@/lib/local-session";
import { useMyAccount } from "@/lib/session";
import { AdminPinDialog } from "@/components/crm/AdminPinDialog";

const SECTIONS = [
  { key: "overview", label: "Overview", icon: ShieldCheck },
  { key: "import", label: "Import Leads", icon: FileUp },
  { key: "database", label: "Canonical Lead Database", icon: Database },
  { key: "assign", label: "Assign by Agent + Quantity", icon: Send },
  { key: "history", label: "Distribution History / Quality", icon: History },
] as const;
type Section = (typeof SECTIONS)[number]["key"];

export const Route = createFileRoute("/leadhub")({
  head: () => ({ meta: [
    { title: "LeadHub Nexus — Winstone Connect" },
    { name: "description", content: "HQ ও IT-এর canonical lead database, import, quality এবং quantity assignment workspace।" },
    { property: "og:title", content: "LeadHub Nexus — Winstone Connect" },
    { property: "og:description", content: "Canonical lead identity, master pool এবং auditable agent assignment।" },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  pendingComponent: () => <AppShell><SnapshotSkeleton /></AppShell>,
  component: LeadHubPage,
});

function LeadHubPage() {
  return <AppShell><LeadHubGate /></AppShell>;
}

function LeadHubGate() {
  const token = useLeadHubToken();
  const { isPending } = useMyAccount();
  const check = useServerFn(checkLeadHubAccess);
  const [pinOpen, setPinOpen] = useState(false);
  const access = useQuery({
    queryKey: ["leadhub-access", token ?? "locked"],
    queryFn: () => check({ data: { adminToken: token } }),
    enabled: Boolean(token),
    retry: false,
  });

  if (isPending || (token && access.isPending)) return <SnapshotSkeleton />;
  if (access.data?.allowed) return <LeadHubTokenScope token={token}><LeadHubWorkspace /></LeadHubTokenScope>;

  return (
    <section className="card-elevated mx-auto max-w-md space-y-4 p-6 text-center">
      <span className="mx-auto grid size-12 place-items-center rounded-full bg-primary/15 text-primary"><KeyRound className="size-6" /></span>
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-primary">HQ / IT secured workspace</p>
        <h1 className="text-xl font-bold">LeadHub Nexus</h1>
        <p className="mt-1 text-sm text-muted-foreground">Executive HQ বা IT PIN দিয়ে Canonical Lead Database খুলুন। Agent account এখানে প্রবেশ করতে পারে না।</p>
      </div>
      <Button size="lg" className="w-full" onClick={() => setPinOpen(true)}><KeyRound className="size-4" /> PIN দিয়ে খুলুন</Button>
      <AdminPinDialog open={pinOpen} onOpenChange={setPinOpen} surface="leadhub" />
    </section>
  );
}

function LeadHubWorkspace() {
  const [section, setSection] = useState<Section>("overview");
  const [assignFor, setAssignFor] = useState<string>();
  const agentOptions: { id: string; name: string }[] = [];

  return (
    <div className="space-y-5">
      <header>
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-primary">Single lead intelligence and identity layer</p>
        <h1 className="text-2xl font-bold">LeadHub Nexus</h1>
        <p className="text-sm text-muted-foreground">Import → normalize → identity resolve → Canonical Lead Database → agent assignment</p>
      </header>
      <nav aria-label="LeadHub Nexus" className="flex gap-1 overflow-x-auto border-b border-border pb-2">
        {SECTIONS.map(({ key, label, icon: Icon }) => (
          <Button key={key} size="sm" variant={section === key ? "default" : "ghost"} onClick={() => setSection(key)}>
            <Icon className="size-4" /> {label}
          </Button>
        ))}
      </nav>

      {section === "overview" && <><DeckKpis /><AllocationTable onAssign={(id) => { setAssignFor(id); setSection("assign"); }} /></>}
      {section === "import" && <div className="space-y-4"><div className="flex justify-end"><CsvImportDialog /></div><HeadLeadIntakePanel /><ImportHistoryPanel /></div>}
      {section === "database" && <LeadStorePanel agents={agentOptions} canAssign={false} title="Canonical Lead Database" />}
      {section === "assign" && <div className="space-y-4"><LeadDatabasePanel /><AssignLeadsWorkspace key={assignFor ?? "all"} initialAgentId={assignFor} /></div>}
      {section === "history" && <div className="space-y-4"><ImportHistoryPanel /><LeadStorePanel agents={agentOptions} canAssign={false} defaultAssignment="duplicate" title="Duplicate / parked records" /><LeadStorePanel agents={agentOptions} canAssign={false} defaultQuality="invalid_phone" title="Data quality review" /></div>}
    </div>
  );
}
