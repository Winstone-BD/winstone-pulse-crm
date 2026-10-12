import { Flame, MessageCircle, Phone, Snowflake, Sun } from "lucide-react";
import { useMemo } from "react";

import { useSnapshot, type Lead } from "@/lib/crm-data";

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
  if (!t) return <span className="rounded-full border border-border px-2 py-0.5 text-[11px] text-muted-foreground">স্কোর হয়নি</span>;
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
  const r = 26, c = 2 * Math.PI * r;
  return (
    <svg viewBox="0 0 64 64" className="size-16 -rotate-90" role="img" aria-label={`আজ ${pct}% সম্পন্ন`}>
      <circle cx="32" cy="32" r={r} className="fill-none stroke-muted" strokeWidth="6" />
      <circle cx="32" cy="32" r={r} className="fill-none stroke-primary transition-all duration-700" strokeWidth="6" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - pct / 100)} />
    </svg>
  );
}

function greeting() {
  const h = Number(new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Dhaka", hour: "numeric", hourCycle: "h23" }).format(new Date()));
  if (h < 12) return "শুভ সকাল";
  if (h < 16) return "শুভ দুপুর";
  if (h < 19) return "শুভ বিকেল";
  return "শুভ সন্ধ্যা";
}

function mood(pct: number) {
  if (pct >= 90) return "অসাধারণ! আজকের লক্ষ্য প্রায় শেষ।";
  if (pct >= 60) return "দারুণ গতি — আর একটু বাকি।";
  if (pct >= 30) return "ভালো শুরু, এগিয়ে চলুন।";
  return "চলুন, আজকের প্রথম কলগুলো দিয়ে শুরু করি।";
}

const bn = (n: number) => n.toLocaleString("bn-BD");

/** Greeting + daily progress + the single most useful action: the next call. */
export function TodayHero({ name }: { name: string | null }) {
  const { leads, isPending } = useSnapshot();
  const next = useMemo(() => pickNextLead(leads), [leads]);
  const done = leads.filter((l) => l.work_state === "completed").length;
  const remaining = leads.length - done;
  const hot = leads.filter((l) => l.temperature === "hot" && l.work_state !== "completed").length;
  const followUps = leads.filter((l) => l.status === "follow_up").length;
  const pct = leads.length ? Math.round((done / leads.length) * 100) : 0;
  const phone = next?.phone_number?.replace(/[^\d+]/g, "") ?? "";
  const wa = phone.replace(/^\+/, "").replace(/^0/, "880");
  const first = (name ?? "এজেন্ট").split(" ")[0];
  const today = new Date().toLocaleDateString("bn-BD", { timeZone: "Asia/Dhaka", weekday: "long", day: "numeric", month: "long" });

  return (
    <section aria-label="আজকের কাজ" className="relative overflow-hidden rounded-3xl bg-foreground text-background shadow-lg">
      <div aria-hidden className="pointer-events-none absolute -right-20 -top-24 size-72 rounded-full bg-primary/30 blur-3xl" />
      <div aria-hidden className="pointer-events-none absolute -bottom-28 left-1/3 size-64 rounded-full bg-primary/15 blur-3xl" />
      <div className="relative grid gap-6 p-5 sm:p-7 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] lg:items-center">
        <div className="flex min-w-0 items-center gap-5">
          <div className="relative shrink-0">
            <svg viewBox="0 0 64 64" className="size-24 -rotate-90 sm:size-28" role="img" aria-label={`আজ ${pct}% সম্পন্ন`}>
              <circle cx="32" cy="32" r="27" className="fill-none stroke-background/15" strokeWidth="6" />
              <circle cx="32" cy="32" r="27" className="fill-none stroke-primary transition-all duration-700" strokeWidth="6" strokeLinecap="round" strokeDasharray={2 * Math.PI * 27} strokeDashoffset={2 * Math.PI * 27 * (1 - pct / 100)} />
            </svg>
            <span className="absolute inset-0 grid place-items-center">
              <span className="text-center">
                <span className="block text-2xl font-black tabular-nums sm:text-3xl">{bn(pct)}%</span>
                <span className="block text-[10px] opacity-60">সম্পন্ন</span>
              </span>
            </span>
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-primary">{greeting()} · {today}</p>
            <h1 className="mt-1 truncate text-3xl font-black tracking-tight sm:text-4xl">স্বাগতম, {first}</h1>
            <p className="mt-1 text-sm opacity-70">{mood(pct)}</p>
            <div className="mt-3 flex flex-wrap gap-2 text-xs">
              <span className="rounded-full bg-background/10 px-3 py-1"><b className="tabular-nums">{bn(done)}</b> / {bn(leads.length)} শেষ</span>
              <span className="rounded-full bg-background/10 px-3 py-1"><b className="tabular-nums">{bn(remaining)}</b> বাকি</span>
              <span className="rounded-full bg-destructive/25 px-3 py-1"><Flame className="mr-1 inline size-3" aria-hidden /><b className="tabular-nums">{bn(hot)}</b> হট</span>
              <span className="rounded-full bg-background/10 px-3 py-1"><b className="tabular-nums">{bn(followUps)}</b> ফলো-আপ</span>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-background/15 bg-background/5 p-4 backdrop-blur">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-primary">পরবর্তী কল</p>
          {isPending ? (
            <div className="mt-2 h-14 animate-pulse rounded-lg bg-background/10" />
          ) : !next ? (
            <p className="mt-2 text-sm opacity-70">আজকের সব লিড শেষ — দারুণ কাজ! নতুন লিড LeadHub থেকে আসবে।</p>
          ) : (
            <>
              <div className="mt-1 flex min-w-0 flex-wrap items-center gap-2">
                <h2 className="truncate text-lg font-bold">{next.name}</h2>
                <TempBadge t={next.temperature} />
              </div>
              <p className="mt-0.5 truncate text-xs tabular-nums opacity-70">
                {next.phone_number}
                {next.last_call_at ? ` · শেষ কল ${new Date(next.last_call_at).toLocaleDateString("bn-BD", { timeZone: "Asia/Dhaka", day: "numeric", month: "short" })}` : " · এখনো কল হয়নি"}
              </p>
              <div className="mt-3 grid grid-cols-[1fr_auto] gap-2">
                <a href={`tel:${phone}`} className="inline-flex h-11 items-center justify-center gap-1.5 rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground shadow-sm transition-transform active:scale-95">
                  <Phone className="size-4" aria-hidden />এখনই কল করুন
                </a>
                <a href={`https://wa.me/${wa}`} target="_blank" rel="noreferrer" aria-label="WhatsApp" className="inline-flex h-11 items-center gap-1.5 rounded-xl border border-background/20 px-3 text-sm font-semibold transition-transform active:scale-95">
                  <MessageCircle className="size-4" aria-hidden />
                </a>
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
