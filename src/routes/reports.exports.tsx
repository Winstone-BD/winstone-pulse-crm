import { createFileRoute } from "@tanstack/react-router";

import { ReportsPage } from "@/routes/reports";

export const Route = createFileRoute("/reports/exports")({
  head: () => ({
    meta: [
      { title: "রিপোর্ট এক্সপোর্ট — Winstone Connect" },
      { name: "description", content: "অনুমোদিত দৈনিক এক্সপোর্ট ও সিঙ্ক হওয়া কল প্রমাণ।" },
      { property: "og:title", content: "রিপোর্ট এক্সপোর্ট — Winstone Connect" },
      { property: "og:description", content: "অনুমোদিত দৈনিক এক্সপোর্ট ও সিঙ্ক হওয়া কল প্রমাণ।" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ReportsPage,
});
