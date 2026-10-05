import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, RefreshCw, Send } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { useAdminToken } from "@/lib/local-session";
import { getOsSyncStatus, retryOsSyncEvent, runOsDispatch } from "@/lib/os-outbound.functions";
import { dhakaTime } from "@/lib/maintenance-rules";

const LABEL: Record<string, string> = {
  queued: "অপেক্ষায়",
  sending: "পাঠানো হচ্ছে",
  sent: "পাঠানো হয়েছে",
  failed: "আবার চেষ্টা হবে",
  dead: "বন্ধ — হাতে retry দরকার",
};

/** IT Console → CRM থেকে Winstone OS-এ বুকিং পাঠানোর অবস্থা। */
export function OsSyncPanel() {
  const adminToken = useAdminToken();
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["os-sync", adminToken],
    queryFn: () => getOsSyncStatus({ data: { adminToken } }),
    enabled: Boolean(adminToken),
    refetchInterval: 30_000,
  });
  const refresh = () => void qc.invalidateQueries({ queryKey: ["os-sync"] });
  const run = useMutation({
    mutationFn: () => runOsDispatch({ data: { adminToken } }),
    onSuccess: (r) => {
      if (!r.configured) toast.error(`কনফিগারেশন দরকার: ${r.missing.join(", ")}`);
      else toast.success(`পাঠানো ${r.sent} · আবার চেষ্টা ${r.failed} · বন্ধ ${r.dead}`);
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const retry = useMutation({
    mutationFn: (id: string) => retryOsSyncEvent({ data: { adminToken, id } }),
    onSuccess: () => { toast.success("আবার সারিতে দেওয়া হয়েছে"); refresh(); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <section className="space-y-3 rounded-xl border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold">Winstone OS বুকিং সিঙ্ক</h2>
        <Button size="sm" disabled={run.isPending} onClick={() => run.mutate()}>
          {run.isPending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />} এখন পাঠান
        </Button>
      </div>
      {q.isLoading ? <Loader2 className="size-4 animate-spin" /> : null}
      {q.data?.health ? (
        <ul className="grid gap-1.5 text-xs sm:grid-cols-2">
          {q.data.health.map((h) => (
            <li key={h.name} className="flex items-start gap-2 rounded-lg border border-border p-2">
              <span className={h.ok ? "text-success" : "text-destructive"}>{h.ok ? "✓" : "✕"}</span>
              <span className="min-w-0">
                <span className="font-medium">{h.name}</span>
                {h.ok ? null : <span className="block break-words text-muted-foreground">দরকার: {h.setting}</span>}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
      {q.data?.missing.length ? (
        <p className="rounded-lg border border-warning/40 bg-warning/10 p-3 text-xs">
          কনফিগারেশন দরকার: {q.data.missing.join(", ")} — বুকিং নিরাপদে সারিতে জমা থাকবে।
        </p>
      ) : null}
      {q.data ? (
        <div className="flex flex-wrap gap-2 text-xs">
          {Object.entries(q.data.counts).map(([k, v]) => (
            <span key={k} className="rounded-full border border-border px-2.5 py-1">{LABEL[k] ?? k}: {v}</span>
          ))}
        </div>
      ) : null}
      <ul className="divide-y divide-border text-sm">
        {(q.data?.rows ?? []).map((r) => (
          <li key={r.id} className="flex flex-wrap items-center gap-2 py-2">
            <span className="font-medium">{r.event_type.replace("crm_to_os_", "")}</span>
            <span className="text-xs text-muted-foreground">{LABEL[r.status] ?? r.status} · চেষ্টা {r.retry_count}</span>
            {r.error_message ? <span className="text-xs text-destructive">{r.error_message}</span> : null}
            <span className="tabular ml-auto text-xs text-muted-foreground">{dhakaTime(r.processed_at ?? r.created_at)}</span>
            {r.status === "failed" || r.status === "dead" ? (
              <Button size="sm" variant="outline" disabled={retry.isPending} onClick={() => retry.mutate(r.id)}>
                <RefreshCw className="size-3.5" /> Retry
              </Button>
            ) : null}
          </li>
        ))}
        {q.data && q.data.rows.length === 0 ? (
          <li className="py-3 text-xs text-muted-foreground">এখনো কোনো বুকিং সারিতে নেই।</li>
        ) : null}
      </ul>
    </section>
  );
}
