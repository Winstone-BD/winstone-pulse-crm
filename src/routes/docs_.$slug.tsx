import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { AppShell } from "@/components/crm/AppShell";
import { MarkdownView } from "@/components/crm/MarkdownView";
import { listPublishedDocs, readPublishedDoc } from "@/lib/docs.functions";

export const Route = createFileRoute("/docs_/$slug")({
  loader: async ({ params }) => {
    try {
      const doc = await readPublishedDoc({ data: { slug: params.slug } });
      return { title: doc?.title ?? null, summary: doc?.summary ?? null };
    } catch {
      return { title: null, summary: null };
    }
  },
  head: ({ params, loaderData }) => {
    const title = loaderData?.title
      ? `${loaderData.title} — Winstone Pulse ডকুমেন্টেশন`
      : "নির্দেশিকা — Winstone Pulse ডকুমেন্টেশন";
    const description =
      loaderData?.summary ||
      (loaderData?.title
        ? `${loaderData.title}: Winstone CRM ব্যবহারের ধাপে ধাপে নির্দেশিকা।`
        : "Winstone CRM-এর একটি নির্দেশিকা পাতা: ধাপে ধাপে ব্যবহারের নিয়ম।");
    const url = `https://crm.winstonebd.com/docs/${params.slug}`;
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "article" },
        { property: "og:url", content: url },
        { name: "twitter:card", content: "summary_large_image" },
      ],
      links: [{ rel: "canonical", href: url }],
      scripts: loaderData?.title
        ? [
            {
              type: "application/ld+json",
              children: JSON.stringify({
                "@context": "https://schema.org",
                "@type": "Article",
                headline: loaderData.title,
                name: loaderData.title,
                description,
                url,
              }),
            },
          ]
        : [],
    };
  },
  errorComponent: () => (
    <AppShell>
      <p className="text-sm text-destructive">পাতাটি খোলা যায়নি। আবার চেষ্টা করুন।</p>
    </AppShell>
  ),
  notFoundComponent: () => (
    <AppShell>
      <p className="text-sm text-muted-foreground">এই পাতাটি পাওয়া যায়নি।</p>
    </AppShell>
  ),
  component: DocPage,
});

function DocPage() {
  const { slug } = Route.useParams();
  const page = useQuery({
    queryKey: ["docs", "page", slug],
    queryFn: () => readPublishedDoc({ data: { slug } }),
  });
  const nav = useQuery({ queryKey: ["docs", "published"], queryFn: () => listPublishedDocs() });

  const pages = nav.data ?? [];
  const index = pages.findIndex((p) => p.slug === slug);
  const prev = index > 0 ? pages[index - 1] : null;
  const next = index >= 0 && index < pages.length - 1 ? pages[index + 1] : null;

  return (
    <AppShell>
      <div className="mx-auto grid w-full max-w-5xl gap-5 lg:grid-cols-[220px_1fr]">
        <aside className="card-elevated h-fit space-y-1 p-3 text-xs lg:sticky lg:top-4">
          <p className="px-2 pb-1 font-bold">সব পাতা</p>
          {pages.map((item) => (
            <Link
              key={item.slug}
              to="/docs/$slug"
              params={{ slug: item.slug }}
              className={`block rounded-lg px-2 py-1.5 hover:bg-muted ${
                item.slug === slug ? "bg-muted font-semibold" : ""
              }`}
            >
              {item.title}
            </Link>
          ))}
        </aside>

        <article className="space-y-4">
          <nav className="text-xs text-muted-foreground">
            <Link to="/docs" className="hover:underline">
              ডকুমেন্টেশন
            </Link>
            {page.data ? ` / ${page.data.category} / ${page.data.title}` : null}
          </nav>

          {page.isLoading ? (
            <p className="text-xs text-muted-foreground">আসছে…</p>
          ) : !page.data ? (
            <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              এই পাতাটি প্রকাশিত নয় বা পাওয়া যায়নি।
            </p>
          ) : (
            <>
              <header className="space-y-1">
                <h1 className="text-xl font-bold tracking-tight sm:text-2xl">{page.data.title}</h1>
                {page.data.summary ? (
                  <p className="text-sm text-muted-foreground">{page.data.summary}</p>
                ) : null}
                <p className="text-[11px] text-muted-foreground">
                  সর্বশেষ হালনাগাদ: {new Date(page.data.updated_at).toLocaleString("bn-BD")}
                </p>
              </header>
              <div className="card-elevated p-4">
                <MarkdownView source={page.data.body_markdown} />
              </div>
            </>
          )}

          <div className="flex flex-wrap justify-between gap-2 text-xs">
            {prev ? (
              <Link
                to="/docs/$slug"
                params={{ slug: prev.slug }}
                className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-2 hover:bg-muted"
              >
                <ChevronLeft className="size-3.5" /> {prev.title}
              </Link>
            ) : (
              <span />
            )}
            {next ? (
              <Link
                to="/docs/$slug"
                params={{ slug: next.slug }}
                className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-2 hover:bg-muted"
              >
                {next.title} <ChevronRight className="size-3.5" />
              </Link>
            ) : null}
          </div>
        </article>
      </div>
    </AppShell>
  );
}
