import { createFileRoute } from "@tanstack/react-router";

import { ControlBoardPage } from "@/routes/hq";

export const Route = createFileRoute("/hq_/briefs")({
  head: () => ({
    meta: [
      { title: "HQ ব্রিফ ও বিল — Winstone Connect" },
      { name: "description", content: "এক্সিকিউটিভ ব্রিফ, শিফট সামারি ও সার্ভিস বিল।" },
      { property: "og:title", content: "HQ ব্রিফ ও বিল — Winstone Connect" },
      { property: "og:description", content: "এক্সিকিউটিভ ব্রিফ, শিফট সামারি ও সার্ভিস বিল।" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ControlBoardPage,
});
