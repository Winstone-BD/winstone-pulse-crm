import { createFileRoute } from "@tanstack/react-router";

import { DeskPage } from "@/routes/desk";

export const Route = createFileRoute("/desk_/follow-ups")({
  head: () => ({
    meta: [
      { title: "আমার ফলো-আপ — Winstone Connect" },
      { name: "description", content: "ফলো-আপ অ্যালার্ম, সপ্তাহ ও ক্যালেন্ডার।" },
      { property: "og:title", content: "আমার ফলো-আপ — Winstone Connect" },
      { property: "og:description", content: "ফলো-আপ অ্যালার্ম, সপ্তাহ ও ক্যালেন্ডার।" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: DeskPage,
});
