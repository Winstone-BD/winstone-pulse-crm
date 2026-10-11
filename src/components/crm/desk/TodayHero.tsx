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

function Ring({ pct }: { pct: number }) {
  const r = 26, c = 2 * Math.PI * r;
  return (
    <svg viewBox="0 0 64 64" className="size-16 -rotate-90" role="img" aria-label={`আজ ${pct}% সম্পন্ন`}>
      <circle cx="32" cy="32" r={r} className="fill-none stroke-muted" strokeWidth="6" />
      <circle cx="32" cy="32" r={r} className="fill-none stroke-primary transition-all duration-700" strokeWidth="6" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - pct / 100)} />
    </svg>
  );
}

/** Greeting + daily progress + the single most useful action: the next call. */
export function TodayHero({ name }: { name: string | null }) {
  const { leads, isPending } = useSnapshot();
  const next = useMemo(() => pickNextLead(leads), [leads]);
  const done = leads.filter((l) => l.work_state === "completed").length;
  const pct = leads.length ? Math.round((done / leads.length) * 100) : 0;
  const phone = next?.phone_number?.replace(/[^\d+]/g, "") ?? "";
  const wa = phone.replace(/^\+/, "").replace(/^0/, "880");

  return (
    <section aria-label="আজকের কাজ" className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)]">
      <div className="card-elevated flex items-center gap-4 p-4">
        <div className="relative">
          <Ring pct={pct} />
          <span className="absolute inset-0 grid place-items-center text-xs font-bold tabular-nums">{pct}%</span>
        </div>
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">স্বাগতম</p>
          <h1 className="truncate text-lg font-bold tracking-tight">{name ?? "এজেন্ট"}</h1>
          <p className="text-xs text-muted-foreground"><span className="font-semibold tabular-nums text-foreground">{done}</span> / {leads.length} লিড সম্পন্ন</p>
        </div>
      </div>

      <div className="card-elevated relative overflow-hidden p-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">পরবর্তী কল</p>
        {isPending ? (
          <div className="mt-2 h-14 animate-pulse rounded-lg bg-muted" />
        ) : !next ? (
          <p className="mt-2 text-sm text-muted-foreground">আজকের সব লিড শেষ — দারুণ কাজ! নতুন লিড LeadHub থেকে আসবে।</p>
        ) : (
          <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="truncate text-base font-semibold">{next.name}</h2>
                <TempBadge t={next.temperature} />
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground tabular-nums">
                {next.phone_number}{next.company ? ` · ${next.company}` : ""}
                {next.last_call_at ? ` · শেষ কল ${new Date(next.last_call_at).toLocaleDateString("bn-BD", { timeZone: "Asia/Dhaka", day: "numeric", month: "short" })}` : " · এখনো কল হয়নি"}
              </p>
            </div>
            <div className="flex gap-2">
              <a href={`tel:${phone}`} className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-sm transition-transform active:scale-95">
                <Phone className="size-4" aria-hidden />কল
              </a>
              <a href={`https://wa.me/${wa}`} target="_blank" rel="noreferrer" className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-border px-3 text-sm font-semibold transition-transform active:scale-95">
                <MessageCircle className="size-4" aria-hidden />WhatsApp
              </a>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
