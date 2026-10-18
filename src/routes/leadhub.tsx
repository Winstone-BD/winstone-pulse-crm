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
import { useT } from "@/lib/i18n";
import { InstructionCopilot } from "@/components/crm/InstructionCopilot";
import { useCoordinatorAllocation } from "@/components/crm/deck/AssignLeadsWorkspace";

const SECTIONS = [
  { key: "overview", label: { bn: "ওভারভিউ", en: "Overview" }, icon: ShieldCheck },
  { key: "import", label: { bn: "লিড ইমপোর্ট", en: "Import Leads" }, icon: FileUp },
  { key: "database", label: { bn: "মূল লিড ডেটাবেস", en: "Canonical Lead Database" }, icon: Database },
  { key: "assign", label: { bn: "এজেন্ট ও সংখ্যা অনুযায়ী বণ্টন", en: "Assign by Agent + Quantity" }, icon: Send },
  { key: "history", label: { bn: "বণ্টনের ইতিহাস / মান যাচাই", en: "Distribution History / Quality" }, icon: History },
] as const;
type Section = (typeof SECTIONS)[number]["key"];

export const Route = createFileRoute("/leadhub")({
  head: () => ({ meta: [
    { title: "LeadHub Nexus — Winstone Pulse" },
    { name: "description", content: "HQ ও IT-এর canonical lead database, import, quality এবং quantity assignment workspace।" },
    { property: "og:title", content: "LeadHub Nexus — Winstone Pulse" },
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
  const t = useT();
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
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-primary">{t({ bn: "HQ / IT সুরক্ষিত ওয়ার্কস্পেস", en: "HQ / IT secured workspace" })}</p>
        <h1 className="text-xl font-bold">LeadHub Nexus</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t({ bn: "LeadHub-এর আলাদা PIN দিন। HQ দেখার অনুমতি বা সাধারণ IT PIN এখানে প্রযোজ্য নয়।", en: "Enter the dedicated LeadHub PIN. HQ viewing access and ordinary IT PINs do not unlock this workspace." })}</p>
      </div>
      <Button size="lg" className="w-full" onClick={() => setPinOpen(true)}><KeyRound className="size-4" /> {t({ bn: "PIN দিয়ে খুলুন", en: "Unlock with PIN" })}</Button>
      <AdminPinDialog open={pinOpen} onOpenChange={setPinOpen} surface="leadhub" />
    </section>
  );
}

function LeadHubWorkspace() {
  const [section, setSection] = useState<Section>("overview");
  const [assignFor, setAssignFor] = useState<string>();
  const [assignCount, setAssignCount] = useState<number | null>(null);
  const [draftKey, setDraftKey] = useState(0);
  const allocation = useCoordinatorAllocation();
  const agentOptions: { id: string; name: string }[] = [];
  const t = useT();

  return (
    <div className="hq-luxe space-y-5 rounded-3xl p-3 sm:p-5">
      <header>
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-primary">{t({ bn: "একক লিড ইন্টেলিজেন্স ও পরিচয় স্তর", en: "Single lead intelligence and identity layer" })}</p>
        <h1 className="text-2xl font-bold">LeadHub Nexus</h1>
        <p className="text-sm text-muted-foreground">{t({ bn: "ইমপোর্ট → ঠিকঠাক করা → পরিচয় মেলানো → মূল লিড ডেটাবেস → এজেন্টে বণ্টন", en: "Import → normalize → identity resolve → Canonical Lead Database → agent assignment" })}</p>
      </header>
      <InstructionCopilot surface="leadhub" onAssignment={(employeeId, count) => {
        setAssignFor(allocation.data?.agents.find(agent => agent.employeeId?.toUpperCase() === employeeId)?.id);
        setAssignCount(count);
        setDraftKey(value => value + 1);
        setSection("assign");
      }} />
      <nav aria-label="LeadHub Nexus" className="flex gap-1 overflow-x-auto border-b border-border pb-2">
        {SECTIONS.map(({ key, label, icon: Icon }) => (
          <Button key={key} size="sm" variant={section === key ? "default" : "ghost"} onClick={() => setSection(key)}>
            <Icon className="size-4" /> {t(label)}
          </Button>
        ))}
      </nav>

      {section === "overview" && <><DeckKpis /><AllocationTable onAssign={(id) => { setAssignFor(id); setSection("assign"); }} /></>}
      {section === "import" && <div className="space-y-4"><div className="flex justify-end"><CsvImportDialog /></div><HeadLeadIntakePanel /><ImportHistoryPanel /></div>}
      {section === "database" && <LeadStorePanel agents={agentOptions} canAssign={false} title={t({ bn: "মূল লিড ডেটাবেস", en: "Canonical Lead Database" })} />}
      {section === "assign" && <div className="space-y-4"><LeadDatabasePanel /><AssignLeadsWorkspace key={`${assignFor ?? "all"}-${draftKey}`} initialAgentId={assignFor} initialCount={assignCount} /></div>}
      {section === "history" && <div className="space-y-4"><ImportHistoryPanel /><LeadStorePanel agents={agentOptions} canAssign={false} defaultAssignment="duplicate" title={t({ bn: "ডুপ্লিকেট / আলাদা রাখা রেকর্ড", en: "Duplicate / parked records" })} /><LeadStorePanel agents={agentOptions} canAssign={false} defaultQuality="invalid_phone" title={t({ bn: "ডেটার মান যাচাই", en: "Data quality review" })} /></div>}
    </div>
  );
}
