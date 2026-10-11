import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Newspaper } from "lucide-react";

import { AppShell } from "@/components/crm/AppShell";
import { MarketNewsFeed, NewsAdminPanel } from "@/components/crm/news/MarketNewsFeed";
import { useAdminToken } from "@/lib/local-session";
import { siWhoAmI } from "@/lib/sales-intel.functions";

export const Route = createFileRoute("/news")({
  head: () => ({
    meta: [
      { title: "Market News — Winstone Pulse" },
      { name: "description", content: "Bangladesh real-estate market news for Winstone agents and HQ: AI summaries with source links plus HQ announcements." },
      { property: "og:title", content: "Market News — Winstone Pulse" },
      { property: "og:description", content: "Source-attributed real-estate news and HQ announcements for the sales floor." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: NewsPage,
});

function NewsPage() {
  const adminToken = useAdminToken();
  const who = useServerFn(siWhoAmI);
  const me = useQuery({ queryKey: ["si-who", adminToken], queryFn: () => who({ data: { adminToken } }) });
  const isHq = me.data?.scope === "authority";
  return (
    <AppShell>
      <div className="mx-auto w-full max-w-6xl space-y-4 px-3 py-5 sm:px-5">
        <header className="flex min-w-0 items-center gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><Newspaper className="size-5" /></span>
          <div className="min-w-0">
            <h1 className="truncate text-xl font-bold sm:text-2xl">Market News</h1>
            <p className="text-xs text-muted-foreground">মার্কেট নিউজ · প্রতিটি AI খবরে মূল উৎসের লিংক</p>
          </div>
        </header>
        {isHq && <NewsAdminPanel />}
        <MarketNewsFeed manage={isHq} />
      </div>
    </AppShell>
  );
}
