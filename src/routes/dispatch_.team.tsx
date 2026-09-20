import { createFileRoute } from "@tanstack/react-router";

import { DispatchPage } from "@/routes/dispatch";

export const Route = createFileRoute("/dispatch_/team")({
  head: () => ({
    meta: [
      { title: "টিম পর্যবেক্ষণ — Winstone Connect" },
      { name: "description", content: "টিম লোড, অ্যাসাইনমেন্ট ইতিহাস ও সেলফ-ক্লেইম।" },
      { property: "og:title", content: "টিম পর্যবেক্ষণ — Winstone Connect" },
      { property: "og:description", content: "টিম লোড, অ্যাসাইনমেন্ট ইতিহাস ও সেলফ-ক্লেইম।" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: DispatchPage,
});
