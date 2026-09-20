import { createFileRoute } from "@tanstack/react-router";

import { ControlBoardPage } from "@/routes/hq";

export const Route = createFileRoute("/hq/performance")({
  head: () => ({
    meta: [
      { title: "HQ পারফরম্যান্স — Winstone Connect" },
      { name: "description", content: "এজেন্ট পারফরম্যান্স, শ্রেণিবিন্যাস ও লিড মিশ্রণ।" },
      { property: "og:title", content: "HQ পারফরম্যান্স — Winstone Connect" },
      { property: "og:description", content: "এজেন্ট পারফরম্যান্স, শ্রেণিবিন্যাস ও লিড মিশ্রণ।" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ControlBoardPage,
});
