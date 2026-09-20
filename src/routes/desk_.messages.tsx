import { createFileRoute } from "@tanstack/react-router";

import { DeskPage } from "@/routes/desk";

export const Route = createFileRoute("/desk_/messages")({
  head: () => ({
    meta: [
      { title: "আমার বার্তা — Winstone Connect" },
      { name: "description", content: "হোয়াটসঅ্যাপ কথোপকথন ও টিম সাপোর্ট।" },
      { property: "og:title", content: "আমার বার্তা — Winstone Connect" },
      { property: "og:description", content: "হোয়াটসঅ্যাপ কথোপকথন ও টিম সাপোর্ট।" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: DeskPage,
});
