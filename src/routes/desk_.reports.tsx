import { createFileRoute } from "@tanstack/react-router";

import { DeskPage } from "@/routes/desk";

export const Route = createFileRoute("/desk_/reports")({
  head: () => ({
    meta: [
      { title: "আমার রিপোর্ট — Winstone Connect" },
      { name: "description", content: "নিজের জমা দেওয়া কাজের রিপোর্ট।" },
      { property: "og:title", content: "আমার রিপোর্ট — Winstone Connect" },
      { property: "og:description", content: "নিজের জমা দেওয়া কাজের রিপোর্ট।" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: DeskPage,
});
