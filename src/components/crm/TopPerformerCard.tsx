import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowUpRight,
  ChevronDown,
  Clock,
  Crown,
  Database,
  Info,
  Lightbulb,
  Medal,
  Sparkles,
  Target,
  Trophy,
  Users,
} from "lucide-react";

import { topPerformerToday } from "@/lib/top-performer.functions";

const DHAKA_TZ_LABEL = "ঢাকা সময় (UTC+৬)";

/** Mirrors the server's TopPerformerSources payload (kept local: .server files stay off the client). */
type Sources = {
  windowStart: string;
  windowEnd: string;
  workDate: string;
  timeZone: string;
  activeAgents: number;
  callReportRows: number;
  submittedReportRows: number;
  connectedReportRows: number;
  followUpRows: number;
  assignedLeadRows: number;
  completedLeadRows: number;
  talkMinutes: number;
  empty: boolean;
};

function dhakaTime(iso: string) {
  return new Intl.DateTimeFormat("bn-BD", { timeStyle: "short", timeZone: "Asia/Dhaka" }).format(
    new Date(iso),
  );
}

function dhakaStamp(iso: string) {
  return new Intl.DateTimeFormat("bn-BD", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Dhaka",
  }).format(new Date(iso));
}

/** Live countdown to the next board change, in Bengali digits. */
function Countdown({ target, kind }: { target: string; kind: "reveal" | "rollover" }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const left = Math.max(0, new Date(target).getTime() - now);
  const totalSeconds = Math.floor(left / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (n: number) => n.toString().padStart(2, "0");
  const clock = `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;

  return (
    <div className="mt-3 grid gap-1 rounded-lg border border-primary/30 bg-primary/10 p-3">
      <p className="flex items-center gap-2 text-xs font-semibold text-primary">
        <Clock className="size-3.5 shrink-0" />
        {kind === "reveal" ? "ফলাফল প্রকাশ হবে" : "নতুন দিনের বোর্ড শুরু হবে"} {dhakaTime(target)}-এ
      </p>
      <p className="tabular text-2xl font-bold tracking-tight text-primary">{clock}</p>
      <p className="text-[11px] text-muted-foreground">
        বাকি সময় (ঘণ্টা:মিনিট:সেকেন্ড) · সব সময় {DHAKA_TZ_LABEL} অনুযায়ী
      </p>
    </div>
  );
}

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
    refetchInterval: 60_000,
  });

  if (isLoading) return <div className="skeleton h-40 w-full" />;
  if (!data) return null;

  const revealTime = dhakaTime(data.revealAt);
  const sources = data.sources;

  if (!data.revealed) {
    return (
      <section className="card-elevated p-4 sm:p-5">
        <header className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-3">
          <span className="grid size-11 shrink-0 place-items-center rounded-full bg-primary/15 text-primary">
            <Clock className="size-5" />
          </span>
          <div className="min-w-0">
            <h2 className="section-title truncate">
              আজকের সেরা পারফর্মার
            </h2>
            <p className="text-xs text-muted-foreground sm:text-sm">
              প্রতিদিন {revealTime} ({DHAKA_TZ_LABEL})-এ ঘোষণা করা হয়।
            </p>
          </div>
        </header>
        {data.nextUpdateAt ? (
          <Countdown target={data.nextUpdateAt} kind={data.nextUpdateKind ?? "reveal"} />
        ) : null}
        <dl className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Stat label="আজকের কল" value={data.team.called} />
          <Stat label="কথা হয়েছে" value={data.team.connected} />
          <Stat label="রিপোর্ট" value={data.team.reports} />
          <Stat label="কথার মিনিট" value={data.team.talkMinutes} />
        </dl>
        {sources?.empty ? <EmptyReason sources={sources} /> : null}
        {sources ? <SourcePanel sources={sources} /> : null}
      </section>
    );
  }

  const winner = data.winner ?? null;
  const topThree = data.topThree ?? [];
  const otherAgents = data.otherAgents ?? [];
  const dayLabel = data.dayLabel ?? "আজকের";
  const podium = [topThree[1], topThree[0], topThree[2]].filter(
    (entry): entry is NonNullable<typeof entry> => Boolean(entry),
  );

  return (
    <section className="card-elevated overflow-hidden p-4 sm:p-5">
      <header className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-3 border-b border-border pb-4">
        <span className="grid size-11 shrink-0 place-items-center rounded-full bg-primary/15 text-primary">
          <Trophy className="size-5" />
        </span>
        <div className="min-w-0">
          <h2 className="section-title truncate">
            {dayLabel} Top 3 পারফর্মার
          </h2>
          <p className="text-xs text-muted-foreground sm:text-sm">
            {revealTime}-এর হিসাব{data.isPreviousDay ? " (গতকাল)" : ""} — এজেন্টদের নিজের জমা দেওয়া আপডেট থেকে · {DHAKA_TZ_LABEL}
          </p>
        </div>
      </header>

      {data.nextUpdateAt ? (
        <Countdown target={data.nextUpdateAt} kind={data.nextUpdateKind ?? "rollover"} />
      ) : null}

      {winner ? (
        <>
          <div className="mt-4 flex flex-wrap items-center gap-3 rounded-lg border border-primary/30 bg-primary/10 p-3">
            <Sparkles className="size-5 shrink-0 text-primary" />
            <p className="min-w-0 text-sm font-semibold text-primary">
              অভিনন্দন {winner.name}! দিনের নেতৃত্ব আপনার — স্কোর {winner.score}
            </p>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-3 md:items-end">
            {podium.map((agent) => (
              <article
                key={agent.agentId}
                className={`relative min-w-0 rounded-lg border p-4 ${
                  agent.rank === 1
                    ? "border-primary/60 bg-primary/10 md:min-h-64 md:order-2"
                    : agent.rank === 2
                      ? "border-border bg-surface md:min-h-56 md:order-1"
                      : "border-accent bg-accent/10 md:min-h-52 md:order-3"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <span className="grid size-10 shrink-0 place-items-center rounded-full border border-primary/40 bg-ink text-primary">
                    {agent.rank === 1 ? <Crown className="size-5" /> : <Medal className="size-5" />}
                  </span>
                  <span className="tabular text-3xl font-bold text-primary">#{agent.rank}</span>
                </div>
                <h3 className="mt-3 break-words text-base font-bold">{agent.name}</h3>
                <p className="mt-1 text-xs text-muted-foreground">{agent.reason}</p>
                <div className="mt-3 flex items-center justify-between gap-2 border-t border-border pt-3 text-xs">
                  <span className="text-muted-foreground">স্কোর</span>
                  <strong className="tabular text-lg text-primary">{agent.score}</strong>
                </div>
                <p className="tabular mt-1 text-[11px] text-muted-foreground">
                  দৈনিক কোটা {agent.quota}টি · অনুপাত-স্কোর {agent.fairScore}
                </p>
                {agent.score === 0 ? (
                  <p className="mt-2 text-[11px] text-muted-foreground">
                    স্কোর ০ — এই ডেস্ক থেকে আজ কোনো সংযোগ, রিপোর্ট বা ফলো-আপ জমা পড়েনি।
                  </p>
                ) : null}
                <p className="mt-2 flex gap-2 text-xs text-warning">
                  <Target className="mt-0.5 size-3.5 shrink-0" />
                  <span>{agent.gap}</span>
                </p>
                <p className="mt-2 flex gap-2 text-xs text-muted-foreground">
                  <ArrowUpRight className="mt-0.5 size-3.5 shrink-0 text-primary" />
                  <span>{agent.advice}</span>
                </p>
                {agent.gapFromLeader > 0 ? (
                  <p className="tabular mt-3 text-[11px] text-muted-foreground">
                    লিডার থেকে {agent.gapFromLeader} স্কোর পিছিয়ে
                  </p>
                ) : null}
              </article>
            ))}
          </div>

          <div className="mt-5 rounded-lg border border-border bg-surface p-3 sm:p-4">
            <h3 className="flex items-center gap-2 text-sm font-semibold">
              <Lightbulb className="size-4 text-primary" /> কাল আরও ভালো করতে
            </h3>
            <p className="mt-1 text-xs text-muted-foreground">
              আজকের নিজের gap দেখে ছোট একটি লক্ষ্য নিয়ে শুরু করুন।
            </p>
            {otherAgents.length ? (
              <ul className="mt-3 divide-y divide-border">
                {otherAgents.map((agent) => (
                  <li key={agent.agentId} className="grid gap-2 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                    <div className="min-w-0">
                      <p className="break-words text-sm font-semibold">
                        {agent.name} <span className="tabular text-xs text-primary">· {agent.score}</span>
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">{agent.reason}</p>
                    </div>
                    <div className="min-w-0 sm:max-w-72 sm:text-right">
                      <p className="text-xs text-warning">Gap: {agent.gap}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{agent.advice}</p>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                <Users className="size-4 text-primary" /> আজ সক্রিয় অন্য কোনো এজেন্ট নেই।
              </p>
            )}
          </div>
        </>
      ) : sources ? (
        <EmptyReason sources={sources} fallback={data.advice?.[0]} />
      ) : (
        <p className="mt-4 rounded-xl border border-border bg-surface p-3 text-sm text-muted-foreground">
          {data.advice?.[0] ?? "আজ এখনো পর্যাপ্ত ডেটা নেই।"}
        </p>
      )}

      {sources ? <SourcePanel sources={sources} /> : null}
    </section>
  );
}

/** Explains, in plain Bengali, why every score is 0 — and what makes it non-zero. */
function EmptyReason({
  sources,
  fallback,
}: {
  sources: Sources;
  fallback?: string | undefined;
}) {
  const nothing = sources.empty;
  return (
    <div className="mt-4 rounded-lg border border-border bg-surface p-3 sm:p-4">
      <h3 className="flex items-center gap-2 text-sm font-semibold">
        <Info className="size-4 text-primary" /> স্কোর ০ কেন দেখাচ্ছে
      </h3>
      <p className="mt-2 text-xs text-muted-foreground">
        {nothing
          ? `${dhakaStamp(sources.windowStart)} থেকে এখন পর্যন্ত কোনো কল রিপোর্ট, সংযোগ বা ফলো-আপ জমা পড়েনি, তাই সবার স্কোর ০।`
          : `জমা পড়েছে ${sources.callReportRows}টি কল রিপোর্ট, ${sources.connectedReportRows}টি সংযোগ ও ${sources.followUpRows}টি ফলো-আপ — কিন্তু কোনো ডেস্কের কোটা-অগ্রগতি এখনো হিসাবে আসেনি।`}
      </p>
      <ul className="mt-2 grid gap-1 text-xs text-muted-foreground">
        <li>· স্কোর তৈরি হয় সংযোগ, জমা দেওয়া রিপোর্ট, ফলো-আপ ও কথার মিনিট থেকে।</li>
        <li>· কল শেষে রিপোর্ট জমা দিলেই স্কোর সঙ্গে সঙ্গে বাড়বে।</li>
        <li>· কোনো সংখ্যা বানানো হয় না — বাস্তব ডেটা না থাকলে ০ থাকে।</li>
      </ul>
      {fallback ? <p className="mt-2 text-xs text-primary">{fallback}</p> : null}
    </div>
  );
}

/** Collapsible audit panel: exactly which rows the leaderboard counted. */
function SourcePanel({ sources }: { sources: Sources }) {
  const [open, setOpen] = useState(false);
  const rows: Array<[string, string | number]> = [
    ["হিসাবের দিন (work_date)", sources.workDate],
    ["সময়সীমা শুরু", dhakaStamp(sources.windowStart)],
    ["সময়সীমা শেষ", dhakaStamp(sources.windowEnd)],
    ["টাইমজোন", DHAKA_TZ_LABEL],
    ["সক্রিয় এজেন্ট", sources.activeAgents],
    ["কল রিপোর্ট রেকর্ড", sources.callReportRows],
    ["জমা দেওয়া রিপোর্ট", sources.submittedReportRows],
    ["সংযোগ হয়েছে", sources.connectedReportRows],
    ["ফলো-আপ রেকর্ড", sources.followUpRows],
    ["বিতরণ হওয়া লিড", sources.assignedLeadRows],
    ["শেষ হওয়া লিড", sources.completedLeadRows],
    ["মোট কথার মিনিট", sources.talkMinutes],
  ];

  return (
    <div className="mt-4 rounded-lg border border-border bg-surface">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 rounded-lg px-3 py-3 text-left text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span className="flex min-w-0 items-center gap-2">
          <Database className="size-4 shrink-0 text-primary" />
          <span className="truncate">কোন ডেটা গণনা হয়েছে</span>
        </span>
        <ChevronDown className={`size-4 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open ? (
        <dl className="grid gap-2 border-t border-border px-3 py-3 sm:grid-cols-2">
          {rows.map(([label, value]) => (
            <div key={label} className="min-w-0 rounded-md border border-border bg-ink/20 px-3 py-2">
              <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</dt>
              <dd className="tabular mt-0.5 break-words text-sm font-semibold">{value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
    </div>
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
