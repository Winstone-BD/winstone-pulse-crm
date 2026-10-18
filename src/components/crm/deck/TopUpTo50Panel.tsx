import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, CheckCircle2, Loader2, Target } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getAdminToken } from "@/lib/local-session";
import { previewNewLeadTopUp, topUpNewLeadsTo50 } from "@/lib/lead-pool.functions";

/** LeadHub: give every agent exactly the new leads they need to reach 50 today — one reviewed operation. */
export function TopUpTo50Panel() {
  const qc = useQueryClient();
  const preview = useServerFn(previewNewLeadTopUp);
  const run = useServerFn(topUpNewLeadsTo50);
  const [reason, setReason] = useState("");
  const [ack, setAck] = useState(false);
  const [requestId, setRequestId] = useState(() => crypto.randomUUID());
  const [results, setResults] = useState<{ name: string; need: number; moved: number; error: string | null }[] | null>(null);

  const q = useQuery({
    queryKey: ["topup-50-preview"],
    queryFn: () => preview({ data: { adminToken: getAdminToken() } }),
  });
  const plan = q.data;
  const short = plan ? plan.available < plan.total : false;

  const go = useMutation({
    mutationFn: () =>
      run({
        data: {
          adminToken: getAdminToken(),
          reason: reason.trim(),
          acknowledgeOverQuota: true,
          requestId,
          expectedPlan: Object.fromEntries((plan?.rows ?? []).map((r) => [r.agentId, r.need])),
        },
      }),
    onSuccess: (res) => {
      setResults(res.results);
      toast.success(`মোট ${res.moved}টি নতুন লিড দেওয়া হয়েছে`);
      setReason(""); setAck(false); setRequestId(crypto.randomUUID());
      for (const k of ["topup-50-preview", "daily-new-lead-check", "quota-overview", "lead-pool", "lead-pool-status", "crm-snapshot", "bulk-extra-history"])
        void qc.invalidateQueries({ queryKey: [k] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const canRun = !!plan && plan.total > 0 && !short && reason.trim().length >= 5 && ack && !go.isPending;

  return (
    <section className="card-elevated space-y-3 p-4">
      <div className="flex items-center gap-2">
        <Target className="size-4 text-primary" />
        <h2 className="text-sm font-semibold">Top up to 50 new leads — today</h2>
        <Button size="sm" variant="outline" className="ml-auto" onClick={() => void q.refetch()} disabled={q.isFetching}>
          {q.isFetching ? <Loader2 className="size-3.5 animate-spin" /> : "Refresh preview"}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Each agent gets exactly the gap between today's new leads and 50. Agents already at 50 get nothing.
      </p>
      {q.isError && <p className="text-xs text-destructive">{(q.error as Error).message}</p>}
      {plan && (
        <>
          <ul className="divide-y divide-border rounded-lg border border-border text-xs">
            {plan.rows.map((r) => (
              <li key={r.agentId} className="flex items-center gap-2 p-2">
                {r.need === 0 ? <CheckCircle2 className="size-4 text-primary" /> : <AlertTriangle className="size-4 text-destructive" />}
                <span className="min-w-0 flex-1 truncate">{r.name}</span>
                <span className="tabular text-muted-foreground">{r.have} / 50</span>
                <span className="tabular w-16 text-right font-semibold">+{r.need}</span>
              </li>
            ))}
          </ul>
          <p className={`text-xs font-medium ${short ? "text-destructive" : ""}`}>
            Total to give: {plan.total} · available in pool: {plan.available}
            {short && " — not enough leads, nothing will be given"}
          </p>
          <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason (required, min 5 characters)" />
          <label className="flex items-start gap-2 text-xs">
            <input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} className="mt-0.5" />
            I reviewed the numbers above. Some agents may go above their usual daily quota.
          </label>
          <Button disabled={!canRun} onClick={() => go.mutate()}>
            {go.isPending ? <Loader2 className="size-4 animate-spin" /> : null} Confirm — give {plan.total} leads
          </Button>
        </>
      )}
      {results && (
        <ul className="space-y-1 text-xs">
          {results.map((r) => (
            <li key={r.name} className={r.error || r.moved !== r.need ? "text-destructive" : ""}>
              {r.moved === r.need && !r.error ? "✓" : "⚠"} {r.name}: {r.moved}/{r.need}{r.error ? ` — ${r.error}` : ""}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
