import { createFileRoute } from "@tanstack/react-router";

import { ReportsPage } from "@/routes/reports";

export const Route = createFileRoute("/reports_/calls")({
  head: () => ({
    meta: [
      { title: "কল রিপোর্ট — Winstone Connect" },
      { name: "description", content: "জমা দেওয়া কল রিপোর্টের বিস্তারিত তালিকা।" },
      { property: "og:title", content: "কল রিপোর্ট — Winstone Connect" },
      { property: "og:description", content: "জমা দেওয়া কল রিপোর্টের বিস্তারিত তালিকা।" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ReportsPage,
});
