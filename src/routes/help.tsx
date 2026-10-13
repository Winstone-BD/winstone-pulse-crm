import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { BookOpen, LifeBuoy, Monitor, RefreshCw, Search, Smartphone } from "lucide-react";
import { useMemo, useState } from "react";

import { Input } from "@/components/ui/input";
import { listPublishedArticles } from "@/lib/support.functions";

export const Route = createFileRoute("/help")({
  head: () => ({
    meta: [
      { title: "Help Centre — Winstone Support" },
      {
        name: "description",
        content:
          "Browse Winstone help articles on getting started, billing, account and technical questions, or start a chat with the support assistant.",
      },
      { property: "og:title", content: "Help Centre — Winstone Support" },
      {
        property: "og:description",
        content: "Self-service answers plus AI-assisted support with a human always one click away.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  errorComponent: () => (
    <p className="p-8 text-sm text-destructive">The help centre could not be loaded.</p>
  ),
  notFoundComponent: () => <p className="p-8 text-sm text-muted-foreground">Not found.</p>,
  component: HelpCentre,
});

function HelpCentre() {
  const [query, setQuery] = useState("");
  const kb = useQuery({ queryKey: ["support", "kb", "public"], queryFn: () => listPublishedArticles() });

  const articles = kb.data?.articles ?? [];
  const categories = kb.data?.categories ?? [];

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return articles;
    return articles.filter(
      (article) =>
        article.title.toLowerCase().includes(needle) ||
        (article.summary ?? "").toLowerCase().includes(needle) ||
        article.tags.some((tag) => tag.toLowerCase().includes(needle)),
    );
  }, [articles, query]);

  return (
    <div className="grid-noise min-h-screen">
      <main className="mx-auto w-full max-w-4xl px-4 py-12 sm:px-6">
        <header className="text-center">
          <span className="grid mx-auto size-12 place-items-center rounded-full bg-primary/10">
            <LifeBuoy className="size-5 text-primary" />
          </span>
          <h1 className="mt-4 text-2xl font-bold tracking-tight sm:text-3xl">Help centre</h1>
          <p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground">
            Search our guides, or{" "}
            <Link to="/support" className="text-primary underline-offset-2 hover:underline">
              chat with the support assistant
            </Link>
            .
          </p>
          <p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground">
            Find answers about signing in, your account, using the CRM and getting help from the Winstone team. If an answer isn't here yet, the support assistant can open a ticket for you.
          </p>
          <div className="relative mx-auto mt-6 max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search articles"
              className="pl-9"
              aria-label="Search help articles"
            />
          </div>
        </header>

        <section className="mt-10 rounded-xl border border-border bg-card p-5 sm:p-6">
          <h2 className="flex items-center gap-2 text-base font-semibold">
            <RefreshCw className="size-4 text-primary" />
            App not loading or showing an old version?
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            If the app shows a blank screen, an "offline" message while your internet works, or an
            old design after an update, your device is probably holding a stale saved copy. Follow
            the steps for your device, then reopen the app.
          </p>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <div className="rounded-lg border border-border bg-background p-4">
              <h3 className="flex items-center gap-2 text-sm font-semibold">
                <Smartphone className="size-4 text-primary" /> Android phone (Chrome)
              </h3>
              <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
                <li>Open Chrome and go to the CRM site.</li>
                <li>Tap the <strong>⋮ menu</strong> (top right) → <strong>Settings</strong>.</li>
                <li>Tap <strong>Privacy and security</strong> → <strong>Delete browsing data</strong>.</li>
                <li>Choose <strong>Cached images and files</strong> (and Cookies if asked), then tap <strong>Delete data</strong>.</li>
                <li>Close Chrome fully, reopen it, and sign in again.</li>
              </ol>
            </div>

            <div className="rounded-lg border border-border bg-background p-4">
              <h3 className="flex items-center gap-2 text-sm font-semibold">
                <Smartphone className="size-4 text-primary" /> iPhone / iPad (Safari)
              </h3>
              <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
                <li>Open the <strong>Settings</strong> app → <strong>Safari</strong>.</li>
                <li>Tap <strong>Clear History and Website Data</strong> and confirm.</li>
                <li>Reopen Safari, go to the CRM site, and sign in again.</li>
              </ol>
            </div>

            <div className="rounded-lg border border-border bg-background p-4">
              <h3 className="flex items-center gap-2 text-sm font-semibold">
                <Monitor className="size-4 text-primary" /> Computer browser
              </h3>
              <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
                <li>On the CRM page, press <strong>Ctrl + Shift + R</strong> (Windows) or <strong>Cmd + Shift + R</strong> (Mac) for a hard reload.</li>
                <li>If that doesn't help: browser <strong>Settings</strong> → <strong>Privacy</strong> → <strong>Clear browsing data</strong> → choose <strong>Cached images and files</strong> → Clear.</li>
                <li>Reload the site and sign in again.</li>
              </ol>
            </div>

            <div className="rounded-lg border border-border bg-background p-4">
              <h3 className="flex items-center gap-2 text-sm font-semibold">
                <Smartphone className="size-4 text-primary" /> Installed app / home-screen icon
              </h3>
              <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
                <li>Remove the app icon from your home screen.</li>
                <li>Clear the browser cache using the steps above for your device.</li>
                <li>Open the site in your browser and add it to your home screen again.</li>
              </ol>
            </div>
          </div>

          <p className="mt-4 text-sm text-muted-foreground">
            Still stuck after these steps?{" "}
            <Link to="/support" className="text-primary underline-offset-2 hover:underline">
              Chat with the support assistant
            </Link>{" "}
            and tell us which device you are using.
          </p>
        </section>

        {kb.isLoading && <p className="mt-10 text-center text-sm text-muted-foreground">Loading…</p>}

        {!kb.isLoading && articles.length === 0 && (
          <p className="mt-10 rounded-xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">
            No published articles yet. Start a chat and the team will help you directly.
          </p>
        )}

        <div className="mt-8 space-y-8">
          {(categories.length ? categories : [{ id: null, name: "Articles", description: null }]).map(
            (category) => {
              const items = filtered.filter((article) =>
                category.id ? article.category_id === category.id : !article.category_id,
              );
              if (!items.length) return null;
              return (
                <section key={category.id ?? "uncategorised"}>
                  <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                    <BookOpen className="size-4" />
                    {category.name}
                  </h2>
                  <ul className="mt-3 grid gap-3 sm:grid-cols-2">
                    {items.map((article) => (
                      <li key={article.id}>
                        <Link
                          to="/help/$slug"
                          params={{ slug: article.slug }}
                          className="block h-full rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary/40"
                        >
                          <p className="text-sm font-semibold">{article.title}</p>
                          {article.summary && (
                            <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                              {article.summary}
                            </p>
                          )}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </section>
              );
            },
          )}
        </div>
      </main>
    </div>
  );
}
