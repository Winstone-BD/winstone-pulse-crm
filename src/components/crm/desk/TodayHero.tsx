import { Flame, Snowflake, Sun } from "lucide-react";
import { useMemo } from "react";

import { useLang, useT } from "@/lib/i18n";

import { useSnapshot, type Lead } from "@/lib/crm-data";
import { WebCallButton } from "@/components/crm/WebCallButton";

const TEMP_RANK: Record<string, number> = { hot: 0, warm: 1, cold: 2 };

/** Next lead to work: open leads first by temperature, then the longest untouched. */
export function pickNextLead(leads: Lead[]): Lead | null {
  const open = leads.filter((l) => l.work_state !== "completed" && l.status !== "closed");
  open.sort((a, b) =>
    (TEMP_RANK[a.temperature ?? ""] ?? 3) - (TEMP_RANK[b.temperature ?? ""] ?? 3) ||
    String(a.last_call_at ?? "").localeCompare(String(b.last_call_at ?? "")) ||
    String(a.updated_at).localeCompare(String(b.updated_at)));
  return open[0] ?? null;
}

function TempBadge({ t }: { t: string | null }) {
  const label = useT();
  if (!t) return <span className="rounded-full border border-border px-2 py-0.5 text-[11px] text-muted-foreground">{label({ bn: "স্কোর হয়নি", en: "Not scored" })}</span>;
  const map = {
    hot: { Icon: Flame, label: "Hot", cls: "border-destructive/30 bg-destructive/10 text-destructive" },
    warm: { Icon: Sun, label: "Warm", cls: "border-warning/40 bg-warning/10 text-warning-foreground" },
    cold: { Icon: Snowflake, label: "Cold", cls: "border-primary/30 bg-primary/10 text-primary" },
  } as const;
  const m = map[t as keyof typeof map];
  if (!m) return null;
  return <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${m.cls}`}><m.Icon className="size-3" aria-hidden />{m.label}</span>;
}

export function Ring({ pct }: { pct: number }) {
  const t = useT();
  const r = 26, c = 2 * Math.PI * r;
  return (
    <svg viewBox="0 0 64 64" className="size-16 -rotate-90" role="img" aria-label={t({ bn: `আজ ${pct}% সম্পন্ন`, en: `${pct}% done today` })}>
      <circle cx="32" cy="32" r={r} className="fill-none stroke-muted" strokeWidth="6" />
      <circle cx="32" cy="32" r={r} className="fill-none stroke-primary transition-all duration-700" strokeWidth="6" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - pct / 100)} />
    </svg>
  );
}

function greeting(lang: "bn" | "en") {
  const h = Number(new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Dhaka", hour: "numeric", hourCycle: "h23" }).format(new Date()));
  if (lang === "bn") {
    if (h < 12) return "শুভ সকাল";
    if (h < 16) return "শুভ দুপুর";
    if (h < 19) return "শুভ বিকেল";
    return "শুভ সন্ধ্যা";
  }
  if (h < 12) return "Good morning";
  if (h < 16) return "Good afternoon";
  if (h < 19) return "Good evening";
  return "Good evening";
}

function mood(pct: number, lang: "bn" | "en") {
  if (lang === "bn") {
    if (pct >= 90) return "অসাধারণ! আজকের লক্ষ্য প্রায় শেষ।";
    if (pct >= 60) return "দারুণ গতি — আর একটু বাকি।";
    if (pct >= 30) return "ভালো শুরু, এগিয়ে চলুন।";
    return "চলুন, আজকের প্রথম কলগুলো দিয়ে শুরু করি।";
  }
  if (pct >= 90) return "Amazing! Today's goal is almost done.";
  if (pct >= 60) return "Great pace — just a bit more.";
  if (pct >= 30) return "Good start, keep going.";
  return "Let's start with today's first calls.";
}

const fmtNum = (n: number, lang: "bn" | "en") => (lang === "bn" ? n.toLocaleString("bn-BD") : String(n));

/** Greeting + daily progress + the single most useful action: the next call. */
export function TodayHero({ name }: { name: string | null }) {
  const t = useT();
  const lang = useLang();
  const bn = (n: number) => fmtNum(n, lang);
  const { leads, isPending } = useSnapshot();
  const next = useMemo(() => pickNextLead(leads), [leads]);
  const done = leads.filter((l) => l.work_state === "completed").length;
  const remaining = leads.length - done;
  const hot = leads.filter((l) => l.temperature === "hot" && l.work_state !== "completed").length;
  const followUps = leads.filter((l) => l.status === "follow_up").length;
  const pct = leads.length ? Math.round((done / leads.length) * 100) : 0;
  const displayName = (name ?? "").trim();
  const today = new Date().toLocaleDateString(lang === "bn" ? "bn-BD" : "en-GB", { timeZone: "Asia/Dhaka", weekday: "long", day: "numeric", month: "long" });

  return (
    <section aria-label={t({ bn: "আজকের কাজ", en: "Today's work" })} className="relative overflow-hidden rounded-3xl bg-foreground text-background shadow-lg">
      <div aria-hidden className="pointer-events-none absolute -right-20 -top-24 size-72 rounded-full bg-primary/30 blur-3xl" />
      <div aria-hidden className="pointer-events-none absolute -bottom-28 left-1/3 size-64 rounded-full bg-primary/15 blur-3xl" />
      <div className="relative grid gap-6 p-5 sm:p-7 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] lg:items-center">
        <div className="flex min-w-0 items-center gap-5">
          <div className="relative shrink-0">
            <svg viewBox="0 0 64 64" className="size-24 -rotate-90 sm:size-28" role="img" aria-label={t({ bn: `আজ ${pct}% সম্পন্ন`, en: `${pct}% done today` })}>
              <circle cx="32" cy="32" r="27" className="fill-none stroke-background/15" strokeWidth="6" />
              <circle cx="32" cy="32" r="27" className="fill-none stroke-primary transition-all duration-700" strokeWidth="6" strokeLinecap="round" strokeDasharray={2 * Math.PI * 27} strokeDashoffset={2 * Math.PI * 27 * (1 - pct / 100)} />
            </svg>
            <span className="absolute inset-0 grid place-items-center">
              <span className="text-center">
                <span className="block text-2xl font-black tabular-nums sm:text-3xl">{bn(pct)}%</span>
                <span className="block text-[10px] opacity-60">{t({ bn: "সম্পন্ন", en: "done" })}</span>
              </span>
            </span>
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-primary">{greeting(lang)} · {today}</p>
            <h1 className="mt-1 break-words text-3xl font-black leading-tight tracking-tight sm:text-5xl">
              {t({ bn: "স্বাগতম", en: "Welcome back" })}
              {displayName ? <span className="block text-primary">{displayName}</span> : null}
            </h1>
            <p className="mt-0.5 text-sm font-medium opacity-80">{t({ bn: "আজকের কাজের এক নজর দেখে নিন।", en: "Here's your day at a glance." })}</p>
            <p className="mt-1 text-sm opacity-70">{mood(pct, lang)}</p>
            <div className="mt-3 flex flex-wrap gap-2 text-xs">
              <span className="rounded-full bg-background/10 px-3 py-1"><b className="tabular-nums">{bn(done)}</b> / {bn(leads.length)} {t({ bn: "শেষ", en: "done" })}</span>
              <span className="rounded-full bg-background/10 px-3 py-1"><b className="tabular-nums">{bn(remaining)}</b> {t({ bn: "বাকি", en: "remaining" })}</span>
              <span className="rounded-full bg-destructive/25 px-3 py-1"><Flame className="mr-1 inline size-3" aria-hidden /><b className="tabular-nums">{bn(hot)}</b> {t({ bn: "হট", en: "hot" })}</span>
              <span className="rounded-full bg-background/10 px-3 py-1"><b className="tabular-nums">{bn(followUps)}</b> {t({ bn: "ফলো-আপ", en: "follow-ups" })}</span>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-background/10 bg-background/5 p-3 backdrop-blur">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted opacity-70">{t({ bn: "পরবর্তী কল (সংক্ষিপ্ত)", en: "Next call (quick glance)" })}</p>
          {isPending ? (
            <div className="mt-2 h-12 animate-pulse rounded-lg bg-background/10 motion-reduce:animate-none" />
          ) : !next ? (
            <p className="mt-2 text-xs opacity-70">{t({ bn: "আজকের সব লিড শেষ — দারুণ কাজ! নতুন লিড LeadHub থেকে আসবে।", en: "All of today's leads are done — great work! New leads will arrive from LeadHub." })}</p>
          ) : (
            <>
              <div className="mt-1 flex min-w-0 flex-wrap items-center gap-2">
                <h2 className="truncate text-sm font-bold">{next.name}</h2>
                <TempBadge t={next.temperature} />
              </div>
              <p className="mt-0.5 truncate text-[11px] tabular-nums opacity-70">
                {next.phone_number}
                {next.last_call_at ? ` · ${t({ bn: "শেষ কল", en: "Last call" })} ${new Date(next.last_call_at).toLocaleDateString(lang === "bn" ? "bn-BD" : "en-GB", { timeZone: "Asia/Dhaka", day: "numeric", month: "short" })}` : ` · ${t({ bn: "এখনো কল হয়নি", en: "No call yet" })}`}
              </p>
              <div className="mt-2 [&_button]:h-10 [&_button]:text-sm">
                <WebCallButton
                  leadId={next.id}
                  phone={next.phone_number}
                  name={next.name}
                  label={t({ bn: "এখনই কল করুন", en: "Call now" })}
                  ariaLabel={t({ bn: `${next.name}-কে কল করুন`, en: `Call ${next.name}` })}
                  className="h-10 rounded-xl text-sm"
                />
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
