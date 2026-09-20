import { createFileRoute } from "@tanstack/react-router";

import { SystemPage } from "@/routes/system";

export const Route = createFileRoute("/system/staff")({
  head: () => ({
    meta: [
      { title: "স্টাফ ও অডিট — Winstone Connect" },
      { name: "description", content: "স্টাফ অ্যাকাউন্ট, অনুমোদন ও অডিট ইতিহাস।" },
      { property: "og:title", content: "স্টাফ ও অডিট — Winstone Connect" },
      { property: "og:description", content: "স্টাফ অ্যাকাউন্ট, অনুমোদন ও অডিট ইতিহাস।" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SystemPage,
});
