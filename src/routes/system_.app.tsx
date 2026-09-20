import { createFileRoute } from "@tanstack/react-router";

import { SystemPage } from "@/routes/system";

export const Route = createFileRoute("/system_/app")({
  head: () => ({
    meta: [
      { title: "অ্যান্ড্রয়েড ও অ্যাপ — Winstone Connect" },
      { name: "description", content: "অ্যাপ সেটিং, ইনস্টল ও বাধ্যতামূলক রিলিজ।" },
      { property: "og:title", content: "অ্যান্ড্রয়েড ও অ্যাপ — Winstone Connect" },
      { property: "og:description", content: "অ্যাপ সেটিং, ইনস্টল ও বাধ্যতামূলক রিলিজ।" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SystemPage,
});
