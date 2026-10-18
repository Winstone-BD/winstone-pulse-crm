import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/dispatch")({
  head: () => ({ meta: [
    { title: "Lead Dispatch Has Moved — Winstone Pulse" },
    { name: "description", content: "Lead operations have moved to LeadHub Nexus." },
    { property: "og:title", content: "Lead Dispatch Has Moved — Winstone Pulse" },
    { property: "og:description", content: "The former dispatch entry now redirects to LeadHub Nexus for lead import, quality review and assignment." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: () => <Navigate to="/leadhub" replace />,
});
