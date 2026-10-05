import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ClipboardList } from "lucide-react";

import { ReportDetails } from "@/components/crm/ReportDetails";
import { listLeadReports } from "@/lib/lead-notes.functions";
import { useAdminToken } from "@/lib/local-session";

/** Original call/contact reports for this lead, with full manual description. */
export function LeadReportsSection({ leadId }: { leadId: string }) {
  const adminToken = useAdminToken();
  const fetchReports = useServerFn(listLeadReports);
  const { data: reports = [], isPending } = useQuery({
    queryKey: ["lead-reports", leadId, adminToken ? "pin" : "session"],
    queryFn: () => fetchReports({ data: { adminToken, leadId } }),
  });
  return (
    <section className="space-y-3 rounded-xl border bg-card p-4">
      <h3 className="flex items-center gap-2 text-sm font-semibold">
        <ClipboardList className="size-4 text-primary" /> কল / যোগাযোগ রিপোর্ট ({reports.length})
      </h3>
      {isPending ? (
        <p className="text-xs text-muted-foreground">রিপোর্ট আনা হচ্ছে…</p>
      ) : reports.length === 0 ? (
        <p className="text-xs text-muted-foreground">এই লিডে এখনো কোনো রিপোর্ট নেই।</p>
      ) : (
        <ul className="space-y-2">
          {reports.map((r) => (
            <li key={r.id} className="rounded-lg border bg-background p-3">
              <ReportDetails report={r} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
