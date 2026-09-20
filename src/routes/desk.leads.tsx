import { createFileRoute } from "@tanstack/react-router";

import { DeskPage } from "@/routes/desk";

export const Route = createFileRoute("/desk/leads")({
  head: () => ({
    meta: [
      { title: "আমার লিড — Winstone Connect" },
      { name: "description", content: "বরাদ্দ, বাকি কাজ এবং দিনের লিড কিউ।" },
      { property: "og:title", content: "আমার লিড — Winstone Connect" },
      { property: "og:description", content: "বরাদ্দ, বাকি কাজ এবং দিনের লিড কিউ।" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: DeskPage,
});
