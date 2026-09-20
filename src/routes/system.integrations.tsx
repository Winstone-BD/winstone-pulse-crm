import { createFileRoute } from "@tanstack/react-router";

import { SystemPage } from "@/routes/system";

export const Route = createFileRoute("/system/integrations")({
  head: () => ({
    meta: [
      { title: "সিস্টেম সংযোগ — Winstone Connect" },
      { name: "description", content: "Drive, Docs, Sheets এবং কল অপারেশনের বাস্তব অবস্থা।" },
      { property: "og:title", content: "সিস্টেম সংযোগ — Winstone Connect" },
      { property: "og:description", content: "Drive, Docs, Sheets এবং কল অপারেশনের বাস্তব অবস্থা।" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SystemPage,
});
