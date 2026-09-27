import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { StatusBadge } from "@/components/crm/StatusBadge";
import { leadPoolStatus } from "@/lib/lead-pool.functions";
import { useAdminToken } from "@/lib/local-session";

/** Per-agent allocation for today: given / quota, remaining capacity, pool readiness. */
export function AllocationProgress() {
  const adminToken = useAdminToken();
  const statusFn = useServerFn(leadPoolStatus);
  const q = useQuery({
    queryKey: ["lead-pool", adminToken ? "pin" : "session"],
    queryFn: () => statusFn({ data: { adminToken } }),
    refetchInterval: 60_000,
  });
  const d = q.data;
  const quota = d?.dailyPerAgent ?? 50;
  const remainingCapacity = (d?.agents ?? []).reduce((sum, a) => sum + Math.max(0, quota - a.today), 0);

  return (
    <section className="card-elevated space-y-3 p-4">
      <header className="flex flex-wrap items-center gap-2">
        <h2 className="text-sm font-semibold">Today's allocation</h2>
        {d && (
          <StatusBadge
            label={d.poolCount >= remainingCapacity ? "Pool ready" : `Shortage · ${remainingCapacity - d.poolCount} short`}
            tone={d.poolCount >= remainingCapacity ? "success" : "danger"}
          />
        )}
        <span className="ml-auto text-xs text-muted-foreground">
          {d ? `${d.today} · ${quota}/agent · remaining capacity ${remainingCapacity} · ready pool ${d.poolCount}` : "…"}
        </span>
      </header>
      {q.isError && <p className="text-xs text-destructive">{(q.error as Error).message}</p>}
      <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {(d?.agents ?? []).map((a) => {
          const pct = Math.min(100, Math.round((a.today / Math.max(1, quota)) * 100));
          const full = a.today >= quota;
          return (
            <li key={a.id} className="rounded-lg border border-border p-3">
              <div className="flex items-center justify-between text-sm">
                <span className="truncate font-medium">{a.name}</span>
                <span className={`tabular font-semibold ${full ? "text-success" : "text-foreground"}`}>
                  {a.today}/{quota}
                </span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-surface-2" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={`${a.name} allocation`}>
                <div className={`h-full ${full ? "bg-success" : "bg-primary"}`} style={{ width: `${pct}%` }} />
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground">
                বাকি {Math.max(0, quota - a.today)} · চলমান pending {a.pending}
              </p>
            </li>
          );
        })}
      </ul>
      {d && d.agents.length === 0 && <p className="text-xs text-muted-foreground">কোনো সক্রিয় অনুমোদিত এজেন্ট নেই।</p>}
    </section>
  );
}
