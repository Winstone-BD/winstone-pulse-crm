import { createFileRoute } from "@tanstack/react-router";

import { ReportsPage } from "@/routes/reports";

export const Route = createFileRoute("/reports_/agents")({
  head: () => ({
    meta: [
      { title: "এজেন্ট রিপোর্ট — Winstone Connect" },
      { name: "description", content: "এজেন্ট স্কোরকার্ড ও পারফরম্যান্স ইন্টেলিজেন্স।" },
      { property: "og:title", content: "এজেন্ট রিপোর্ট — Winstone Connect" },
      { property: "og:description", content: "এজেন্ট স্কোরকার্ড ও পারফরম্যান্স ইন্টেলিজেন্স।" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ReportsPage,
});
