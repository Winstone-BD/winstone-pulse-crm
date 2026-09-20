import { createFileRoute } from "@tanstack/react-router";

import { ControlBoardPage } from "@/routes/hq";

export const Route = createFileRoute("/hq/operations")({
  head: () => ({
    meta: [
      { title: "HQ অপারেশন — Winstone Connect" },
      { name: "description", content: "বরাদ্দ, অনুমোদিত কমান্ড ও HQ অনুসন্ধান।" },
      { property: "og:title", content: "HQ অপারেশন — Winstone Connect" },
      { property: "og:description", content: "বরাদ্দ, অনুমোদিত কমান্ড ও HQ অনুসন্ধান।" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ControlBoardPage,
});
