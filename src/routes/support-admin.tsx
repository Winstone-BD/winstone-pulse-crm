import { createFileRoute } from "@tanstack/react-router";
import { BarChart3, BookOpen, Settings, Sparkles } from "lucide-react";
import { useState } from "react";

import { AppShell } from "@/components/crm/AppShell";
import { SupportAnalyticsTab } from "@/components/support/SupportAnalyticsTab";
import { SupportKnowledgeTab } from "@/components/support/SupportKnowledgeTab";
import { SupportRepliesTab } from "@/components/support/SupportRepliesTab";
import { SupportSettingsTab } from "@/components/support/SupportSettingsTab";

export const Route = createFileRoute("/support-admin")({
  head: () => ({
    meta: [
      { title: "Support Admin — Knowledge Base, AI & SLA Settings" },
      {
        name: "description",
        content:
          "Publish help articles, manage saved replies, tune the AI assistant's confidence threshold and SLA targets, and review support performance.",
      },
      { property: "og:title", content: "Support Admin — Knowledge Base, AI & SLA Settings" },
      {
        property: "og:description",
        content: "Everything that shapes how the support assistant answers customers.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  errorComponent: () => (
    <AppShell>
      <p className="text-sm text-destructive">Support admin could not be loaded.</p>
    </AppShell>
  ),
  notFoundComponent: () => (
    <AppShell>
      <p className="text-sm text-muted-foreground">Not found.</p>
    </AppShell>
  ),
  component: SupportAdminPage,
});

type Tab = "analytics" | "kb" | "replies" | "settings";

const TABS: { id: Tab; label: string; icon: typeof BarChart3 }[] = [
  { id: "analytics", label: "Performance", icon: BarChart3 },
  { id: "kb", label: "Knowledge base", icon: BookOpen },
  { id: "replies", label: "Saved replies", icon: Sparkles },
  { id: "settings", label: "AI & SLA", icon: Settings },
];

function SupportAdminPage() {
  const [tab, setTab] = useState<Tab>("analytics");

  return (
    <AppShell>
      <h1 className="page-title">Support admin</h1>
      <p className="text-xs text-muted-foreground">
        Knowledge base, saved replies, assistant behaviour and performance.
      </p>

      <div className="mt-4 flex flex-wrap gap-1.5 rounded-full border border-border bg-surface-2/60 p-1">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
              tab === item.id ? "bg-card text-primary shadow-sm" : "text-muted-foreground"
            }`}
          >
            <item.icon className="size-3.5" />
            {item.label}
          </button>
        ))}
      </div>

      <div className="mt-4">
        {tab === "analytics" && <SupportAnalyticsTab />}
        {tab === "kb" && <SupportKnowledgeTab />}
        {tab === "replies" && <SupportRepliesTab />}
        {tab === "settings" && <SupportSettingsTab />}
      </div>
    </AppShell>
  );
}
