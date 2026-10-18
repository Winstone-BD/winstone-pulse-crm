import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, CheckCircle2, ClipboardCheck } from "lucide-react";
import { useState } from "react";

import { Input } from "@/components/ui/input";
import { dailyNewLeadCheck } from "@/lib/assignment-history.functions";
import { dhakaDateOf } from "@/lib/business-day";
import { getAdminToken } from "@/lib/local-session";

/** IT Console: today's new-lead count per agent; anyone not at exactly 50 is flagged. */
export function DailyNewLeadCheckPanel() {
  const load = useServerFn(dailyNewLeadCheck);
  const [day, setDay] = useState(() => dhakaDateOf());
  const query = useQuery({
    queryKey: ["daily-new-lead-check", day],
    queryFn: () => load({ data: { adminToken: getAdminToken(), day, expected: 50 } }),
  });
  const rows = query.data?.rows ?? [];

  return (
    <section className="card-elevated space-y-3 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <ClipboardCheck className="size-4 text-primary" />
        <h2 className="text-sm font-semibold">New leads check — exactly 50 per agent</h2>
        <Input type="date" value={day} onChange={(e) => setDay(e.target.value)} className="ml-auto h-9 w-40" />
      </div>
      <p className="text-xs text-muted-foreground">
        Counts only fresh leads handed from the unassigned pool on this Dhaka day (not reassignments).
      </p>
      {query.isError && <p className="text-xs text-destructive">{(query.error as Error).message}</p>}
      {query.isPending ? (
        <p className="text-xs text-muted-foreground">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="text-xs text-muted-foreground">No active agents found.</p>
      ) : (
        <>
          <p className={`text-xs font-medium ${query.data!.flagged ? "text-destructive" : "text-primary"}`}>
            {query.data!.flagged
              ? `${query.data!.flagged} of ${rows.length} agents did not receive exactly 50`
              : `All ${rows.length} agents received exactly 50`}
          </p>
          <ul className="divide-y divide-border rounded-lg border border-border text-xs">
            {rows.map((r) => (
              <li key={r.agentId} className="flex items-center gap-2 p-2">
                {r.ok ? <CheckCircle2 className="size-4 text-primary" /> : <AlertTriangle className="size-4 text-destructive" />}
                <span className="min-w-0 flex-1 truncate">
                  {r.name} {r.employeeId && <span className="text-muted-foreground">· {r.employeeId}</span>}
                </span>
                <span className={`tabular font-semibold ${r.ok ? "" : "text-destructive"}`}>{r.newLeads} / {r.expected}</span>
                {!r.ok && (
                  <span className="text-destructive">{r.newLeads < r.expected ? `${r.expected - r.newLeads} short` : `${r.newLeads - r.expected} over`}</span>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
