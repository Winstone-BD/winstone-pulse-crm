import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, CalendarClock, Flame, Loader2, PhoneOff, Sparkles, TrendingDown, TrendingUp } from "lucide-react";

import { AppShell } from "@/components/crm/AppShell";
import { Button } from "@/components/ui/button";
import { getCrmInsights } from "@/lib/crm-insights.functions";
import type { CrmInsights, InsightItem } from "@/lib/crm-insights.server";
import { useLang, useT } from "@/lib/i18n";
import { useAdminToken } from "@/lib/local-session";

export const Route = createFileRoute("/insights")({
  head: () => ({
    meta: [
      { title: "AI Insights — Winstone Pulse" },
      { name: "description", content: "Follow-up priorities, overdue leads and 14-day call trends from your real CRM data, with a Winstone AI read-out." },
      { property: "og:title", content: "AI Insights — Winstone Pulse" },
      { property: "og:description", content: "See who to follow up first, what is overdue and how your calls are trending." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: InsightsPage,
});

const fmt = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("en-GB", { timeZone: "Asia/Dhaka", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "—";

function InsightsPage() {
  const t = useT();
  const lang = useLang();
  const adminToken = useAdminToken();
  const fn = useServerFn(getCrmInsights);
  const q = useQuery({
    queryKey: ["crm-insights", adminToken],
    queryFn: () => fn({ data: { adminToken, lang, withAi: false } }),
    staleTime: 60_000,
  });
  const ai = useMutation({ mutationFn: () => fn({ data: { adminToken, lang, withAi: true } }) });
  const d: CrmInsights | undefined = q.data;
  const aiData = ai.data?.ai;

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-7xl space-y-5 px-3 py-5 sm:px-5">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary"><Sparkles className="size-5" aria-hidden /></span>
            <div>
              <h1 className="text-xl font-bold sm:text-2xl">{t({ bn: "AI ইনসাইটস", en: "AI Insights" })}</h1>
              <p className="text-xs text-muted-foreground">
                {d?.scope === "floor" ? t({ bn: "পুরো সেলস ফ্লোর", en: "Whole sales floor" }) : t({ bn: "আপনার নিজের লিড", en: "Your own leads" })}
                {" · "}{t({ bn: "শুধু আসল ডেটা", en: "Real data only" })}
              </p>
            </div>
          </div>
          <Button onClick={() => ai.mutate()} disabled={ai.isPending || !d}>
            {ai.isPending ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
            {t({ bn: "AI বিশ্লেষণ করুন", en: "Ask Winstone AI" })}
          </Button>
        </header>

        {q.isError && <p className="rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">{(q.error as Error).message}</p>}
        {q.isPending && <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">{[0, 1, 2, 3, 4].map((i) => <div key={i} className="h-20 animate-pulse rounded-xl bg-muted/50" />)}</div>}

        {d && (
          <>
            <section className="grid grid-cols-2 gap-3 lg:grid-cols-5" aria-label="Key numbers">
              <Stat icon={<AlertTriangle className="size-4" />} tone="urgent" label={t({ bn: "সময় পেরোনো ফলো-আপ", en: "Overdue follow-ups" })} value={d.counts.overdueFollowUps} />
              <Stat icon={<CalendarClock className="size-4" />} label={t({ bn: "আজকের ফলো-আপ", en: "Due today" })} value={d.counts.dueToday} />
              <Stat icon={<Flame className="size-4" />} tone="good" label={t({ bn: "খোলা হট লিড", en: "Open hot leads" })} value={d.counts.hotOpen} />
              <Stat icon={<PhoneOff className="size-4" />} label={t({ bn: "৩+ দিন কল নেই", en: "No call 3+ days" })} value={d.counts.staleLeads} />
              <Stat icon={<PhoneOff className="size-4" />} label={t({ bn: "কখনো কল হয়নি", en: "Never called" })} value={d.counts.neverCalled} />
            </section>

            {(aiData || ai.data?.aiError || ai.isError) && (
              <section className="card-elevated space-y-3 border-primary/30 p-4" aria-live="polite">
                <h2 className="flex items-center gap-2 text-sm font-semibold"><Sparkles className="size-4 text-primary" />Winstone AI</h2>
                {aiData ? (
                  <>
                    {aiData.headline && <p className="text-base font-semibold">{aiData.headline}</p>}
                    <div className="grid gap-4 md:grid-cols-2">
                      <div>
                        <h3 className="mb-1 text-xs font-medium uppercase text-muted-foreground">{t({ bn: "পর্যবেক্ষণ", en: "What we see" })}</h3>
                        <ul className="list-disc space-y-1 pl-5 text-sm">{aiData.insights.map((s) => <li key={s}>{s}</li>)}</ul>
                      </div>
                      <div>
                        <h3 className="mb-1 text-xs font-medium uppercase text-muted-foreground">{t({ bn: "পরের কাজ", en: "Do next" })}</h3>
                        <ol className="list-decimal space-y-1 pl-5 text-sm">{aiData.actions.map((s) => <li key={s}>{s}</li>)}</ol>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">{t({ bn: "AI শুধু পরামর্শ দেয় — কিছুই নিজে বদলায় না।", en: "AI only suggests — it never changes anything on its own." })}</p>
                  </>
                ) : (
                  <p className="text-sm text-destructive">{ai.data?.aiError ?? (ai.error as Error)?.message}</p>
                )}
              </section>
            )}

            <div className="grid gap-4 lg:grid-cols-2">
              <ListCard title={t({ bn: "সময় পেরোনো ফলো-আপ", en: "Overdue follow-ups" })} empty={t({ bn: "কোনো ফলো-আপ বাকি নেই", en: "Nothing overdue — great." })} items={d.overdue} urgent />
              <ListCard title={t({ bn: "আগে কাকে কল করবেন (হট/ওয়ার্ম)", en: "Call first (hot / warm)" })} empty={t({ bn: "কোনো হট বা ওয়ার্ম লিড নেই", en: "No hot or warm leads open." })} items={d.priorities} />
              <ListCard title={t({ bn: "আজকের ফলো-আপ", en: "Due today" })} empty={t({ bn: "আজ কিছু নেই", en: "Nothing due today." })} items={d.dueToday} />
              <ListCard title={t({ bn: "ঠান্ডা হয়ে যাচ্ছে", en: "Going cold" })} empty={t({ bn: "সব লিডে সাম্প্রতিক কল আছে", en: "Every lead has a recent call." })} items={d.stale} />
            </div>

            <TrendCard d={d} />
          </>
        )}
      </div>
    </AppShell>
  );
}

function Stat({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: number; tone?: "urgent" | "good" }) {
  const cls = tone === "urgent" && value > 0 ? "border-destructive/40 text-destructive" : tone === "good" ? "border-primary/30 text-primary" : "border-border";
  return (
    <div className={`rounded-xl border bg-card p-3 ${cls}`}>
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">{icon}{label}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums">{value}</p>
    </div>
  );
}

function ListCard({ title, items, empty, urgent }: { title: string; items: InsightItem[]; empty: string; urgent?: boolean }) {
  return (
    <section className="card-elevated p-4">
      <h2 className={`mb-2 text-sm font-semibold ${urgent && items.length ? "text-destructive" : ""}`}>{title}</h2>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">{empty}</p>
      ) : (
        <ul className="divide-y divide-border">
          {items.map((i, n) => (
            <li key={`${i.leadId ?? i.name}-${n}`} className="flex items-start justify-between gap-3 py-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{i.name}</p>
                {i.detail && <p className="truncate text-xs text-muted-foreground">{i.detail}</p>}
              </div>
              <div className="shrink-0 text-right">
                {i.priority && <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] capitalize">{i.priority}</span>}
                <p className="mt-0.5 text-[11px] text-muted-foreground">{fmt(i.at)}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function TrendCard({ d }: { d: CrmInsights }) {
  const t = useT();
  const max = Math.max(1, ...d.trend.map((r) => r.calls));
  const delta = d.week.calls - d.week.prevCalls;
  const rate = (c: number, n: number) => (n ? Math.round((c / n) * 100) : 0);
  return (
    <section className="card-elevated grid gap-5 p-4 lg:grid-cols-3">
      <div className="lg:col-span-2">
        <h2 className="mb-1 flex items-center gap-2 text-sm font-semibold">
          {delta >= 0 ? <TrendingUp className="size-4 text-primary" /> : <TrendingDown className="size-4 text-destructive" />}
          {t({ bn: "১৪ দিনের কল ট্রেন্ড", en: "14-day call trend" })}
        </h2>
        <p className="mb-3 text-xs text-muted-foreground">
          {t({ bn: "এই সপ্তাহ", en: "This week" })}: {d.week.calls} {t({ bn: "কল", en: "calls" })} ({rate(d.week.connected, d.week.calls)}% {t({ bn: "কানেক্টেড", en: "connected" })}) ·{" "}
          {t({ bn: "আগের সপ্তাহ", en: "Last week" })}: {d.week.prevCalls} ({rate(d.week.prevConnected, d.week.prevCalls)}%)
        </p>
        <div className="flex h-36 items-end gap-1" role="img" aria-label="Daily calls for the last 14 days">
          {d.trend.map((r) => (
            <div key={r.day} className="flex flex-1 flex-col items-center gap-1" title={`${r.day}: ${r.calls} calls, ${r.connected} connected`}>
              <div className="relative w-full rounded-t bg-muted" style={{ height: `${(r.calls / max) * 120}px` }}>
                <div className="absolute bottom-0 w-full rounded-t bg-primary" style={{ height: `${r.calls ? (r.connected / r.calls) * 100 : 0}%` }} />
              </div>
              <span className="text-[10px] text-muted-foreground">{r.day.slice(8)}</span>
            </div>
          ))}
        </div>
      </div>
      <div>
        <h2 className="mb-2 text-sm font-semibold">{t({ bn: "রিপোর্টের ধরন (১৪ দিন)", en: "Report outcomes (14 days)" })}</h2>
        {d.topCategories.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t({ bn: "কোনো রিপোর্ট নেই", en: "No reports yet." })}</p>
        ) : (
          <ul className="space-y-1.5 text-sm">
            {d.topCategories.map((c) => (
              <li key={c.label} className="flex justify-between gap-2"><span className="truncate capitalize">{c.label.replace(/_/g, " ")}</span><span className="tabular-nums text-muted-foreground">{c.count}</span></li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
