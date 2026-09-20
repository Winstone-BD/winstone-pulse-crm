import { createFileRoute } from "@tanstack/react-router";

import { DispatchPage } from "@/routes/dispatch";

export const Route = createFileRoute("/dispatch_/operations")({
  head: () => ({
    meta: [
      { title: "কোঅর্ডিনেটর অপারেশন — Winstone Connect" },
      { name: "description", content: "লাইভ কিউ, কল অপারেশন ও সাপোর্ট ইনবক্স।" },
      { property: "og:title", content: "কোঅর্ডিনেটর অপারেশন — Winstone Connect" },
      { property: "og:description", content: "লাইভ কিউ, কল অপারেশন ও সাপোর্ট ইনবক্স।" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: DispatchPage,
});
