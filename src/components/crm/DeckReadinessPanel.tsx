import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, CheckCircle2 } from "lucide-react";

import { leadPoolStatus } from "@/lib/lead-pool.functions";
import { getAdminToken, useAdminToken } from "@/lib/local-session";
import { cn } from "@/lib/utils";

/** Pool readiness + per-agent quota progress for today, from real data only. */
export function DeckReadinessPanel() {
  const status = useServerFn(leadPoolStatus);
  const token = useAdminToken();
  const query = useQuery({
    queryKey: ["lead-pool", token ? "pin" : "session"],
    queryFn: () => status({ data: { adminToken: getAdminToken() ?? null } }),
    refetchInterval: 60_000,
  });

  if (query.isPending) return <div className="card-elevated h-40 animate-pulse" aria-busy />;
  if (query.isError)
    return (
      <p role="alert" className="card-elevated p-4 text-sm text-destructive">
        হেড ডেটাবেজের অবস্থা আনা যায়নি — {(query.error as Error).message}
      </p>
    );

  const d = query.data;
  const assignedToday = d.agents.reduce((s, a) => s + a.today, 0);
  const pendingTotal = d.agents.reduce((s, a) => s + a.pending, 0);
  const ready = !d.shortage;

  return (
    <section className="card-elevated p-4" aria-labelledby="deck-ready-title">
      <h2 id="deck-ready-title" className="text-sm font-semibold">
        বণ্টনের প্রস্তুতি / Distribution readiness · {d.today}
      </h2>
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="হেড পুলে লিড" value={d.poolCount} />
        <Stat label="আজ বণ্টিত" value={assignedToday} />
        <Stat label="কল বাকি (সব এজেন্ট)" value={pendingTotal} tone={pendingTotal > 0 ? "warn" : "ok"} />
        <Stat label="প্রতি এজেন্ট / দিন" value={d.dailyPerAgent} />
      </div>

      <div
        role="status"
        className={cn(
          "mt-3 flex items-start gap-2 rounded-md border p-3 text-sm",
          ready ? "border-success/40 bg-success/10" : "border-destructive/40 bg-destructive/10",
        )}
      >
        {ready ? (
          <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />
        ) : (
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden />
        )}
        <p>
          {ready
            ? `পরের পূর্ণ রাউন্ডের জন্য প্রস্তুত — আনুমানিক ${d.daysLeft} দিনের লিড আছে।`
            : `পরের পূর্ণ রাউন্ডে (${d.agents.length} জন × ${d.dailyPerAgent}) আরও ${d.neededForNextRound}টি লিড দরকার।`}
          {d.lastRunDate ? ` শেষ বণ্টন: ${d.lastRunDate}` : ""}
        </p>
      </div>

      <ul className="mt-3 space-y-2" aria-label="এজেন্টভিত্তিক আজকের কোটা">
        {d.agents.map((a) => {
          const pct = d.dailyPerAgent > 0 ? Math.min(100, Math.round((a.today / d.dailyPerAgent) * 100)) : 0;
          const full = a.today >= d.dailyPerAgent;
          return (
            <li key={a.id} className="text-xs">
              <div className="flex justify-between gap-2">
                <span className="truncate font-medium">{a.name}</span>
                <span className="tabular text-muted-foreground">
                  {a.today}/{d.dailyPerAgent} · কল বাকি {a.pending}
                </span>
              </div>
              <div className="mt-1 h-1.5 rounded-full bg-muted" aria-hidden>
                <div
                  className={cn("h-full rounded-full", full ? "bg-success" : "bg-warning")}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: "ok" | "warn" }) {
  return (
    <div className="rounded-md border border-border bg-card p-3">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p
        className={cn(
          "tabular text-xl font-semibold",
          tone === "warn" && "text-warning",
          tone === "ok" && "text-success",
        )}
      >
        {value.toLocaleString("bn-BD")}
      </p>
    </div>
  );
}
