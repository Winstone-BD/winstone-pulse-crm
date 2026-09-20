import { createFileRoute } from "@tanstack/react-router";

import { SystemPage } from "@/routes/system";

export const Route = createFileRoute("/system/billing")({
  head: () => ({
    meta: [
      { title: "বিল ও আর্কাইভ — Winstone Connect" },
      { name: "description", content: "সার্ভিস বিল, ব্যবহারভিত্তিক হিসাব ও বার্ষিক আর্কাইভ।" },
      { property: "og:title", content: "বিল ও আর্কাইভ — Winstone Connect" },
      { property: "og:description", content: "সার্ভিস বিল, ব্যবহারভিত্তিক হিসাব ও বার্ষিক আর্কাইভ।" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SystemPage,
});
