import { createFileRoute } from "@tanstack/react-router";

import { DocPage } from "@/components/crm/DocPage";
import { AUDIT_COMMIT, AUDIT_DATE, AUDIT_ITEMS, AUDIT_PDF_PATH, AUDIT_SECTIONS, DOC_VERSION } from "@/lib/handover-docs";

export const Route = createFileRoute("/audit-report")({
  head: () => ({
    meta: [
      { title: "Production Readiness / Audit Report — WINSTONE CRM" },
      { name: "description", content: "Implementation audit of WINSTONE CRM: checks, evidence, test results and operational items not covered." },
      { property: "og:title", content: "WINSTONE CRM — Production Readiness / Audit Report" },
      { property: "og:description", content: "Implementation audit results and evidence for WINSTONE CRM." },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => (
    <DocPage
      kicker="WINSTONE CRM"
      title="Production Readiness / Audit Report"
      meta={`Document ${DOC_VERSION} · Audit ${AUDIT_DATE} · Version ${AUDIT_COMMIT}`}
      pdf={AUDIT_PDF_PATH}
      sections={AUDIT_SECTIONS}
    >
      <section className="mt-6">
        <h2 className="text-lg font-bold">Implementation audit: PASS (code, database and automated tests)</h2>
        <p className="mt-1 text-sm text-muted-foreground">This covers code, database and automated-test verification only. External operational checks are listed separately below and are not certified here. No legal or security guarantee is made.</p>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[560px] border-collapse text-sm">
            <thead><tr><th className="border border-border bg-muted p-2 text-left">Item</th><th className="border border-border bg-muted p-2 text-left">Result</th><th className="border border-border bg-muted p-2 text-left">Evidence</th></tr></thead>
            <tbody>{AUDIT_ITEMS.map((a) => (
              <tr key={a.item}><td className="border border-border p-2 align-top font-medium">{a.item}</td><td className="border border-border p-2 align-top text-primary">{a.result}</td><td className="border border-border p-2 align-top">{a.evidence}</td></tr>
            ))}</tbody>
          </table>
        </div>
      </section>
    </DocPage>
  ),
});
