import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Clock, Lightbulb, Medal, Sparkles, Trophy } from "lucide-react";

import { topPerformerToday } from "@/lib/top-performer.functions";

/**
 * Entry-hall board that congratulates the day's best performer.
 * Before 5:30 pm Dhaka it shows a countdown instead of a winner, so nobody is
 * crowned while the floor is still calling.
 */
export function TopPerformerCard() {
  const fetchBoard = useServerFn(topPerformerToday);
  const { data, isLoading } = useQuery({
    queryKey: ["top-performer-today"],
    queryFn: () => fetchBoard(),
    refetchInterval: 5 * 60_000,
  });

  if (isLoading) return <div className="skeleton h-40 w-full" />;
  if (!data) return null;

  const revealTime = new Intl.DateTimeFormat("bn-BD", {
    timeStyle: "short",
    timeZone: "Asia/Dhaka",
  }).format(new Date(data.revealAt));

  if (!data.revealed) {
    return (
      <section className="card-elevated p-4 sm:p-5">
        <header className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-3">
          <span className="grid size-11 shrink-0 place-items-center rounded-full bg-primary/15 text-primary">
            <Clock className="size-5" />
          </span>
          <div className="min-w-0">
            <h2 className="truncate text-base font-semibold tracking-tight sm:text-lg">
              আজকের সেরা পারফর্মার
            </h2>
            <p className="text-xs text-muted-foreground sm:text-sm">
              প্রতিদিন {revealTime}-এ ঘোষণা করা হয় — দিন শেষ হলে বোর্ড এখানেই দেখা যাবে।
            </p>
          </div>
        </header>
        <dl className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Stat label="আজকের কল" value={data.team.called} />
          <Stat label="কথা হয়েছে" value={data.team.connected} />
          <Stat label="রিপোর্ট" value={data.team.reports} />
          <Stat label="কথার মিনিট" value={data.team.talkMinutes} />
        </dl>
      </section>
    );
  }

  const winner = data.winner;

  return (
    <section className="card-elevated p-4 sm:p-5">
      <header className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-full bg-primary/15 text-primary">
          <Trophy className="size-5" />
        </span>
        <div className="min-w-0">
          <h2 className="truncate text-base font-semibold tracking-tight sm:text-lg">
            আজকের সেরা পারফর্মার
          </h2>
          <p className="text-xs text-muted-foreground sm:text-sm">
            {revealTime}-এর হিসাব — এজেন্টদের নিজের জমা দেওয়া আপডেট থেকে
          </p>
        </div>
      </header>

      {winner ? (
        <>
          <div className="mt-4 flex flex-wrap items-center gap-3 rounded-xl border border-primary/30 bg-primary/10 p-3">
            <Sparkles className="size-5 shrink-0 text-primary" />
            <p className="min-w-0 text-sm font-semibold text-primary">
              অভিনন্দন {winner.name}! আজ আপনি ফ্লোরের সেরা — স্কোর {winner.score}
            </p>
          </div>

          <dl className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Stat label="কথা হয়েছে" value={winner.connected} />
            <Stat label="মোট কল" value={winner.called} />
            <Stat label="কানেক্ট হার" value={`${winner.connectRate}%`} />
            <Stat label="কথার মিনিট" value={winner.talkMinutes} />
          </dl>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <div className="rounded-xl border border-border bg-surface p-3">
              <h3 className="flex items-center gap-2 text-sm font-semibold">
                <Medal className="size-4 text-primary" /> কেন সেরা
              </h3>
              <ul className="mt-2 space-y-1.5 text-xs text-muted-foreground sm:text-sm">
                {data.reasons.map((line) => (
                  <li key={line} className="flex gap-2">
                    <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" />
                    <span className="min-w-0">{line}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-xl border border-warning/40 bg-warning/10 p-3">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-warning">
                <Lightbulb className="size-4" /> কাল আরও ভালো করতে
              </h3>
              <ul className="mt-2 space-y-1.5 text-xs text-warning/90 sm:text-sm">
                {data.advice.map((line) => (
                  <li key={line} className="flex gap-2">
                    <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-warning" />
                    <span className="min-w-0">{line}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </>
      ) : (
        <p className="mt-4 rounded-xl border border-border bg-surface p-3 text-sm text-muted-foreground">
          {data.advice[0]}
        </p>
      )}
    </section>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-xl border border-border bg-surface px-3 py-2">
      <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="tabular mt-0.5 text-lg font-bold">{value}</dd>
    </div>
  );
}
