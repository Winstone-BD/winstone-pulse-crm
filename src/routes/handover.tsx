import { createFileRoute } from "@tanstack/react-router";

import { DocPage } from "@/components/crm/DocPage";
import { AUDIT_DATE, DOC_VERSION, HANDOVER_PDF_PATH, HANDOVER_SECTIONS } from "@/lib/handover-docs";

const SHOTS = [
  { src: "/handover/home.png", caption: "Home — daily Top 3 board" },
  { src: "/handover/desk.png", caption: "Agent Desk" },
  { src: "/handover/manual.png", caption: "System Manual" },
];

export const Route = createFileRoute("/handover")({
  head: () => ({
    meta: [
      { title: "Client Handover & Feature Report — WINSTONE CRM" },
      { name: "description", content: "A–Z client handover for WINSTONE CRM: implemented features, roles, daily checklist, troubleshooting and support." },
      { property: "og:title", content: "WINSTONE CRM — Client Handover & Feature Report" },
      { property: "og:description", content: "Implemented features, roles and daily operations of WINSTONE CRM." },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => (
    <DocPage
      kicker="WINSTONE CRM"
      title="WINSTONE CRM — Client Handover & Feature Report"
      meta={`Document ${DOC_VERSION} · Audit date ${AUDIT_DATE}`}
      pdf={HANDOVER_PDF_PATH}
      sections={HANDOVER_SECTIONS}
    >
      <section className="mt-6 grid gap-4 sm:grid-cols-3">
        {SHOTS.map((s) => (
          <figure key={s.src} className="break-inside-avoid">
            <img src={s.src} alt={s.caption} className="w-full rounded-md border border-border" />
            <figcaption className="mt-1 text-xs text-muted-foreground">{s.caption}</figcaption>
          </figure>
        ))}
      </section>
    </DocPage>
  ),
});
