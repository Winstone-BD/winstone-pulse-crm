import { createFileRoute } from "@tanstack/react-router";
import { MapPin } from "lucide-react";

import { AppShell } from "@/components/crm/AppShell";
import { VisitRequestsPanel } from "@/components/crm/KnowledgeHubCards";
import { SiteVisitsPanel } from "@/components/crm/hq/SiteVisitsPanel";
import { useSnapshot } from "@/lib/crm-data";

export const Route = createFileRoute("/site-visits")({
  head: () => ({
    meta: [
      { title: "Site Visits — Winstone Pulse" },
      { name: "description", content: "Schedule site visits on your own leads, get reminders and update each visit's status." },
      { property: "og:title", content: "Site Visits — Winstone Pulse" },
      { property: "og:description", content: "Agent site visit scheduling, reminders and status updates." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SiteVisitsPage,
});

function SiteVisitsPage() {
  const { leads } = useSnapshot();
  return (
    <AppShell>
      <div className="mb-4"><VisitRequestsPanel /></div>
      <div className="mx-auto w-full max-w-4xl space-y-4 px-3 py-5 sm:px-5">
        <header className="flex min-w-0 items-center gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><MapPin className="size-5" /></span>
          <div className="min-w-0">
            <h1 className="truncate text-xl font-bold sm:text-2xl">সাইট ভিজিট</h1>
            <p className="text-xs text-muted-foreground">আপনার নিজের লিডে ভিজিট যোগ করুন ও অবস্থা আপডেট করুন</p>
          </div>
        </header>
        <SiteVisitsPanel leads={leads} />
      </div>
    </AppShell>
  );
}
