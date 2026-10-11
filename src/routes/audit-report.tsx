import { createFileRoute } from "@tanstack/react-router";

import { AuditWorkspace } from "@/components/crm/audit/AuditWorkspace";

const str = (v: unknown) => (typeof v === "string" ? v : "");

export const Route = createFileRoute("/audit-report")({
  validateSearch: (s: Record<string, unknown>): { q?: string; result?: string; item?: string } => ({
    q: str(s.q) || undefined,
    result: str(s.result) || undefined,
    item: str(s.item) || (typeof s.item === "number" ? String(s.item) : undefined),
  }),
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
  component: AuditReportPage,
});

function AuditReportPage() {
  const { q, result, item } = Route.useSearch();
  return <AuditWorkspace q={q ?? ""} result={result ?? ""} item={item ?? ""} />;
}
