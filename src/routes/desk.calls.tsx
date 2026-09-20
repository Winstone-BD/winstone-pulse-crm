import { createFileRoute } from "@tanstack/react-router";

import { DeskPage } from "@/routes/desk";

export const Route = createFileRoute("/desk/calls")({
  head: () => ({
    meta: [
      { title: "আমার কল — Winstone Connect" },
      { name: "description", content: "জমা দেওয়া কল, যাচাইকৃত সংযোগ ও ফোনে মাপা কথার সময়।" },
      { property: "og:title", content: "আমার কল — Winstone Connect" },
      { property: "og:description", content: "জমা দেওয়া কল, যাচাইকৃত সংযোগ ও ফোনে মাপা কথার সময়।" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: DeskPage,
});
