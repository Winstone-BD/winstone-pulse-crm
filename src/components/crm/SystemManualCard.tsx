import { Link } from "@tanstack/react-router";
import { BookOpenCheck, Download } from "lucide-react";

import { Button } from "@/components/ui/button";
import { AUDIT_PDF_PATH, DOC_VERSION, HANDOVER_PDF_PATH } from "@/lib/handover-docs";
import { MANUAL_PDF_PATH, MANUAL_UPDATED, MANUAL_VERSION } from "@/lib/system-manual";

/** Reference card for the one canonical manual; shown in HQ and IT Console. */
export function SystemManualCard() {
  return (
    <div className="space-y-3">
    <section className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
          <BookOpenCheck className="size-5" />
        </span>
        <div>
          <h2 className="font-semibold">System Manual / Client Handover</h2>
          <p className="text-xs text-muted-foreground">Manual version {MANUAL_VERSION} · Last updated {MANUAL_UPDATED}</p>
        </div>
      </div>
      <div className="flex gap-2">
        <Button asChild variant="outline" size="sm"><Link to="/manual">পড়ুন</Link></Button>
        <Button asChild size="sm"><a href={MANUAL_PDF_PATH} download><Download className="size-4" /> PDF</a></Button>
      </div>
    </section>
    <section className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h2 className="font-semibold">Client Handover &amp; Audit Report</h2>
        <p className="text-xs text-muted-foreground">Document version {DOC_VERSION}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button asChild variant="outline" size="sm"><Link to="/handover">Handover</Link></Button>
        <Button asChild size="sm"><a href={HANDOVER_PDF_PATH} download><Download className="size-4" /> PDF</a></Button>
        <Button asChild variant="outline" size="sm"><Link to="/audit-report">Audit</Link></Button>
        <Button asChild size="sm"><a href={AUDIT_PDF_PATH} download><Download className="size-4" /> PDF</a></Button>
      </div>
    </section>
    </div>
  );
}
