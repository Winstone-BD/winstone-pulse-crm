import { createFileRoute } from "@tanstack/react-router";

import { MANUAL_PDF_PATH, MANUAL_SECTIONS, MANUAL_UPDATED, MANUAL_VERSION } from "@/lib/system-manual";

export const Route = createFileRoute("/manual")({
  head: () => ({
    meta: [
      { title: "System Manual & Client Handover — Winstone Connect" },
      { name: "description", content: "Complete A–Z operating manual for Winstone Connect CRM: roles, workflows, history, exports and security." },
      { property: "og:title", content: "System Manual — Winstone Connect" },
      { property: "og:description", content: "A–Z operating manual and client handover for Winstone Connect CRM." },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ManualPage,
});

function ManualPage() {
  return (
    <main className="mx-auto max-w-3xl px-5 py-10 print:py-0">
      <header className="border-b border-border pb-5">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Winstone Connect</p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight">System Manual &amp; Client Handover</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Manual version {MANUAL_VERSION} · Last updated {MANUAL_UPDATED}
        </p>
        <a href={MANUAL_PDF_PATH} download className="mt-3 inline-block text-sm font-semibold text-primary hover:underline print:hidden">
          Download PDF
        </a>
      </header>
      <nav className="mt-6 grid gap-1 text-sm sm:grid-cols-2 print:hidden">
        {MANUAL_SECTIONS.map((s) => (
          <a key={s.id} href={`#${s.id}`} className="text-muted-foreground hover:text-foreground">{s.title}</a>
        ))}
      </nav>
      {MANUAL_SECTIONS.map((s) => (
        <section key={s.id} id={s.id} className="mt-8 break-inside-avoid scroll-mt-6">
          <h2 className="text-lg font-bold">{s.title}</h2>
          {s.body.map((p, i) => (
            <p key={i} className="mt-2 text-sm leading-relaxed">{p}</p>
          ))}
        </section>
      ))}
    </main>
  );
}
