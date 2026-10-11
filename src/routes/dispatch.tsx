import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/dispatch")({
  head: () => ({ meta: [
    { title: "LeadHub Nexus — Winstone Pulse" },
    { name: "description", content: "Lead operations have moved to LeadHub Nexus." },
    { property: "og:title", content: "LeadHub Nexus — Winstone Pulse" },
    { property: "og:description", content: "Canonical lead identity, import and assignment workspace." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: () => <Navigate to="/leadhub" replace />,
});
