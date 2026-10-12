import { Link } from "@tanstack/react-router";
import {
  Activity,
  CalendarClock,
  CheckCircle2,
  CheckSquare,
  Flame,
  Kanban,
  MessageCircle,
  PhoneCall,
  PhoneOff,
  Search,
  TrendingUp,
  UserPlus,
  Users,
} from "lucide-react";
import { useMemo, useState } from "react";

import { EmptyState, SectionTitle, StatCard } from "@/components/crm/ui-kit";
import { Input } from "@/components/ui/input";
import { CONNECTED_THRESHOLD_SECONDS, LEAD_EVENT_LABELS, useSnapshot, type Lead } from "@/lib/crm-data";
import { useLang, useT, type Lang } from "@/lib/i18n";

/**
 * Reference-style work views (Pipeline, Tasks, Activities, Outlook).
 * Read-only: every figure comes from the caller's own scoped snapshot, and every
 * action hands off to the existing desk flows (call, report, follow-up). No writes here.
 */

const fmtDate = (iso: string, lang: Lang) =>
  new Date(iso).toLocaleDateString(lang === "bn" ? "bn-BD" : "en-GB", {
    timeZone: "Asia/Dhaka",
    day: "numeric",
    month: "short",
  });
const fmtTime = (iso: string, lang: Lang) =>
  new Date(iso).toLocaleString(lang === "bn" ? "bn-BD" : "en-GB", {
    timeZone: "Asia/Dhaka",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
const num = (n: number, lang: Lang) => (lang === "bn" ? n.toLocaleString("bn-BD") : n.toLocaleString("en-GB"));

function LeadLink({ lead, children, className }: { lead: Lead; children: React.ReactNode; className?: string }) {
  return (
    <Link
      to="/desk"
      search={{ s: "today", lead: lead.id } as never}
      className={`block rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring ${className ?? ""}`}
    >
      {children}
    </Link>
  );
}

function TempBadge({ temp }: { temp: string | null }) {
  const t = useT();
  if (temp !== "hot" && temp !== "warm" && temp !== "cold") return null;
  const cls =
    temp === "hot"
      ? "border-destructive/30 bg-destructive/10 text-destructive"
      : temp === "warm"
        ? "border-chart-4/30 bg-chart-4/10 text-chart-4"
        : "border-primary/30 bg-primary/10 text-primary";
  const label =
    temp === "hot" ? t({ bn: "হট", en: "Hot" }) : temp === "warm" ? t({ bn: "ওয়ার্ম", en: "Warm" }) : t({ bn: "কোল্ড", en: "Cold" });
  return <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${cls}`}>{label}</span>;
}

function SearchBox({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <div className="relative w-full sm:max-w-sm">
      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
      <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} aria-label={placeholder} className="h-10 rounded-xl pl-9" />
    </div>
  );
}

const matches = (l: Lead, q: string) => {
  const s = q.trim().toLowerCase();
  if (!s) return true;
  return l.name.toLowerCase().includes(s) || l.phone_number.replace(/\D/g, "").includes(s.replace(/\D/g, "") || "\u0000");
};

/* ---------------- Pipeline ---------------- */

const STAGES = [
  { key: "pending", bn: "কল বাকি", en: "Pending", dot: "bg-primary" },
  { key: "contacted", bn: "কথা হয়েছে", en: "Contacted", dot: "bg-chart-2" },
  { key: "follow_up", bn: "ফলো-আপ", en: "Follow-up", dot: "bg-chart-4" },
  { key: "closed", bn: "বন্ধ", en: "Closed", dot: "bg-live" },
] as const;

export function PipelineBoard() {
  const t = useT();
  const lang = useLang();
  const { leads, isPending } = useSnapshot();
  const [q, setQ] = useState("");
  const cols = useMemo(
    () => STAGES.map((s) => ({ ...s, items: leads.filter((l) => l.status === s.key && matches(l, q)) })),
    [leads, q],
  );
  return (
    <section className="space-y-4" aria-labelledby="pipeline-title">
      <SectionTitle
        title={t({ bn: "পাইপলাইন", en: "Pipeline" })}
        sub={t({ bn: "আপনার লিড ধাপ অনুযায়ী। ধাপ বদলায় শুধু কল রিপোর্টে।", en: "Your leads by stage. Stages change only through call reports." })}
      />
      <SearchBox value={q} onChange={setQ} placeholder={t({ bn: "নাম বা নম্বর খুঁজুন…", en: "Search leads…" })} />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {cols.map((c) => (
          <div key={c.key} className="flex min-w-0 flex-col rounded-2xl border border-border bg-muted/30 p-3">
            <div className="mb-2 flex items-center justify-between gap-2 px-1">
              <span className="flex items-center gap-2 font-semibold">
                <span className={`size-2.5 rounded-full ${c.dot}`} aria-hidden />
                {t({ bn: c.bn, en: c.en })}
              </span>
              <span className="rounded-full bg-card px-2 py-0.5 text-xs font-semibold tabular-nums text-muted-foreground">
                {num(c.items.length, lang)}
              </span>
            </div>
            {isPending ? (
              <div className="space-y-2">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="h-16 animate-pulse rounded-xl bg-card motion-reduce:animate-none" />
                ))}
              </div>
            ) : c.items.length === 0 ? (
              <EmptyState compact icon={<Kanban />} title={t({ bn: "কোনো লিড নেই", en: "No leads yet" })} />
            ) : (
              <ul className="space-y-2">
                {c.items.slice(0, 30).map((l) => (
                  <li key={l.id}>
                    <LeadLink lead={l} className="border border-border bg-card p-3 shadow-sm transition-shadow hover:shadow-md">
                      <div className="flex items-start justify-between gap-2">
                        <p className="min-w-0 truncate font-semibold">{l.name}</p>
                        <TempBadge temp={l.temperature} />
                      </div>
                      <p className="mt-0.5 truncate text-xs tabular-nums text-muted-foreground">
                        {l.phone_number} · {num(l.call_attempts, lang)} {t({ bn: "বার চেষ্টা", en: "attempts" })}
                      </p>
                    </LeadLink>
                  </li>
                ))}
                {c.items.length > 30 ? (
                  <li className="px-1 text-xs text-muted-foreground">
                    +{num(c.items.length - 30, lang)} {t({ bn: "আরও — খুঁজে দেখুন", en: "more — use search" })}
                  </li>
                ) : null}
              </ul>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

/* ---------------- Tasks (follow-ups) ---------------- */

type Due = "overdue" | "today" | "upcoming" | "none";
const dhakaDay = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: "Asia/Dhaka" });
function dueOf(l: Lead, now = new Date()): Due {
  if (!l.retry_after) return "none";
  const at = new Date(l.retry_after);
  if (dhakaDay(at) === dhakaDay(now)) return at < now ? "overdue" : "today";
  return at < now ? "overdue" : "upcoming";
}

export function TasksView() {
  const t = useT();
  const lang = useLang();
  const { leads, isPending } = useSnapshot();
  const [tab, setTab] = useState<"todo" | "done">("todo");
  const [q, setQ] = useState("");
  const [due, setDue] = useState<"all" | Due>("all");
  const todo = leads.filter((l) => l.status === "follow_up");
  const done = leads.filter((l) => l.work_state === "completed" || l.status === "closed");
  const rows = (tab === "todo" ? todo : done)
    .filter((l) => matches(l, q) && (tab === "done" || due === "all" || dueOf(l) === due))
    .sort((a, b) =>
      tab === "todo"
        ? Date.parse(a.retry_after ?? a.updated_at) - Date.parse(b.retry_after ?? b.updated_at)
        : Date.parse(b.updated_at) - Date.parse(a.updated_at),
    );
  const dueLabel: Record<Due, { bn: string; en: string }> = {
    overdue: { bn: "সময় পেরিয়েছে", en: "Overdue" },
    today: { bn: "আজ", en: "Today" },
    upcoming: { bn: "আসছে", en: "Upcoming" },
    none: { bn: "তারিখ নেই", en: "No date" },
  };
  const dueCls: Record<Due, string> = {
    overdue: "border-destructive/30 bg-destructive/10 text-destructive",
    today: "border-primary/30 bg-primary/10 text-primary",
    upcoming: "border-border bg-muted text-muted-foreground",
    none: "border-border bg-muted text-muted-foreground",
  };
  return (
    <section className="space-y-4">
      <SectionTitle
        title={t({ bn: "কাজ", en: "Tasks" })}
        sub={t({ bn: "আপনার ফলো-আপ ও শেষ করা কাজ। নতুন ফলো-আপ কল রিপোর্ট থেকে তৈরি হয়।", en: "Your follow-ups and finished work. New follow-ups come from call reports." })}
      />
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <div role="tablist" aria-label={t({ bn: "কাজের ধরন", en: "Task type" })} className="inline-flex rounded-xl border border-border bg-muted/40 p-1">
          {(["todo", "done"] as const).map((k) => (
            <button
              key={k}
              role="tab"
              aria-selected={tab === k}
              onClick={() => setTab(k)}
              className={`min-h-9 rounded-lg px-4 text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring ${tab === k ? "bg-card shadow-sm" : "text-muted-foreground"}`}
            >
              {k === "todo" ? t({ bn: "করতে হবে", en: "To do" }) : t({ bn: "সম্পন্ন", en: "Completed" })} ·{" "}
              {num((k === "todo" ? todo : done).length, lang)}
            </button>
          ))}
        </div>
        <SearchBox value={q} onChange={setQ} placeholder={t({ bn: "কাজ খুঁজুন…", en: "Search tasks…" })} />
        {tab === "todo" ? (
          <select
            value={due}
            onChange={(e) => setDue(e.target.value as typeof due)}
            aria-label={t({ bn: "সময় অনুযায়ী ফিল্টার", en: "Filter by due date" })}
            className="h-10 rounded-xl border border-input bg-card px-3 text-sm"
          >
            <option value="all">{t({ bn: "সব সময়", en: "All due dates" })}</option>
            {(Object.keys(dueLabel) as Due[]).map((k) => (
              <option key={k} value={k}>{t(dueLabel[k])}</option>
            ))}
          </select>
        ) : null}
      </div>
      <div className="rounded-2xl border border-border bg-card">
        {isPending ? (
          <div className="space-y-2 p-4">
            {[0, 1, 2, 3].map((i) => <div key={i} className="h-12 animate-pulse rounded-lg bg-muted motion-reduce:animate-none" />)}
          </div>
        ) : rows.length === 0 ? (
          <EmptyState
            icon={<CheckSquare />}
            title={tab === "todo" ? t({ bn: "কোনো কাজ বাকি নেই", en: "No tasks to do" }) : t({ bn: "এখনো কিছু সম্পন্ন হয়নি", en: "No completed tasks" })}
            hint={tab === "todo" ? t({ bn: "কল রিপোর্টে ফলো-আপ দিলে এখানে আসবে।", en: "Follow-ups you set in a call report appear here." }) : t({ bn: "কাজ শেষ করলে এখানে দেখাবে।", en: "Finish a lead to see it here." })}
          />
        ) : (
          <ul className="divide-y divide-border">
            {rows.slice(0, 100).map((l) => {
              const d = dueOf(l);
              return (
                <li key={l.id}>
                  <LeadLink lead={l} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-none px-4 py-3 hover:bg-muted/40">
                    {tab === "todo" ? <CalendarClock className="size-4 text-muted-foreground" aria-hidden /> : <CheckCircle2 className="size-4 text-live" aria-hidden />}
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{l.name}</span>
                      <span className="block truncate text-xs tabular-nums text-muted-foreground">
                        {l.phone_number}
                        {l.retry_after ? ` · ${fmtTime(l.retry_after, lang)}` : ""}
                      </span>
                    </span>
                    {tab === "todo" ? (
                      <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${dueCls[d]}`}>{t(dueLabel[d])}</span>
                    ) : (
                      <span className="text-xs text-muted-foreground">{fmtDate(l.updated_at, lang)}</span>
                    )}
                  </LeadLink>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}

/* ---------------- Activities ---------------- */

type Kind = "all" | "calls" | "whatsapp" | "leads";
export function ActivitiesView() {
  const t = useT();
  const lang = useLang();
  const { leads, calls, messages, events, isPending } = useSnapshot();
  const [kind, setKind] = useState<Kind>("all");
  const nameOf = useMemo(() => new Map(leads.map((l) => [l.id, l.name])), [leads]);
  const items = useMemo(() => {
    const all = [
      ...calls.map((c) => ({
        id: `c-${c.id}`,
        kind: "calls" as const,
        at: c.created_at,
        icon: c.duration_seconds > CONNECTED_THRESHOLD_SECONDS ? <PhoneCall className="size-4 text-live" /> : <PhoneOff className="size-4 text-muted-foreground" />,
        title:
          c.duration_seconds > CONNECTED_THRESHOLD_SECONDS
            ? t({ bn: "কলে কথা হয়েছে", en: "Call connected" })
            : t({ bn: "কল ধরা হয়নি", en: "Call not answered" }),
        who: (c.lead_id && nameOf.get(c.lead_id)) || c.phone_number || "",
      })),
      ...messages.map((m) => ({
        id: `m-${m.id}`,
        kind: "whatsapp" as const,
        at: m.created_at,
        icon: <MessageCircle className="size-4 text-live" />,
        title: t({ bn: "হোয়াটসঅ্যাপ মেসেজ", en: "WhatsApp message" }),
        who: (m.lead_id && nameOf.get(m.lead_id)) || "",
      })),
      ...events.map((e) => ({
        id: `e-${e.id}`,
        kind: "leads" as const,
        at: e.created_at,
        icon: <Activity className="size-4 text-primary" />,
        title: lang === "bn" ? (LEAD_EVENT_LABELS[e.kind] ?? e.kind) : e.kind.replace(/_/g, " "),
        who: (e.lead_id && nameOf.get(e.lead_id)) || "",
      })),
      ...leads.map((l) => ({
        id: `l-${l.id}`,
        kind: "leads" as const,
        at: l.created_at,
        icon: <UserPlus className="size-4 text-primary" />,
        title: t({ bn: "লিড যোগ হয়েছে", en: "Lead added" }),
        who: l.name,
      })),
    ];
    return all.filter((x) => kind === "all" || x.kind === kind).sort((a, b) => Date.parse(b.at) - Date.parse(a.at)).slice(0, 80);
  }, [calls, messages, events, leads, kind, nameOf, t, lang]);
  const chips: { k: Kind; label: string }[] = [
    { k: "all", label: t({ bn: "সব", en: "All" }) },
    { k: "calls", label: t({ bn: "কল", en: "Calls" }) },
    { k: "whatsapp", label: "WhatsApp" },
    { k: "leads", label: t({ bn: "লিড", en: "Leads" }) },
  ];
  return (
    <section className="space-y-4">
      <SectionTitle title={t({ bn: "কার্যক্রম", en: "Activities" })} sub={t({ bn: "আপনার কল, মেসেজ ও লিডের সব ঘটনা এক জায়গায়।", en: "Your calls, messages and lead events in one timeline." })} />
      <div className="flex flex-wrap gap-1.5" role="group" aria-label={t({ bn: "ধরন অনুযায়ী ফিল্টার", en: "Filter by type" })}>
        {chips.map((c) => (
          <button
            key={c.k}
            aria-pressed={kind === c.k}
            onClick={() => setKind(c.k)}
            className={`min-h-9 rounded-full border px-4 text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring ${kind === c.k ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground hover:text-foreground"}`}
          >
            {c.label}
          </button>
        ))}
      </div>
      <div className="rounded-2xl border border-border bg-card">
        {isPending ? (
          <div className="space-y-2 p-4">{[0, 1, 2, 3].map((i) => <div key={i} className="h-10 animate-pulse rounded-lg bg-muted motion-reduce:animate-none" />)}</div>
        ) : items.length === 0 ? (
          <EmptyState icon={<Activity />} title={t({ bn: "এখনো কোনো কার্যক্রম নেই", en: "No activities yet" })} hint={t({ bn: "কল বা মেসেজ শুরু করলে এখানে দেখাবে।", en: "Start calling or messaging leads to see activity here." })} />
        ) : (
          <ol className="divide-y divide-border">
            {items.map((x) => (
              <li key={x.id} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-4 py-3">
                <span className="grid size-8 place-items-center rounded-full bg-muted" aria-hidden>{x.icon}</span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">{x.title}</span>
                  {x.who ? <span className="block truncate text-xs text-muted-foreground">{x.who}</span> : null}
                </span>
                <time dateTime={x.at} className="shrink-0 text-xs tabular-nums text-muted-foreground">{fmtTime(x.at, lang)}</time>
              </li>
            ))}
          </ol>
        )}
      </div>
    </section>
  );
}

/* ---------------- Outlook (real counts, no money) ---------------- */

export function OutlookView() {
  const t = useT();
  const lang = useLang();
  const { leads, isPending } = useSnapshot();
  const now = new Date();
  const weekEnd = new Date(now.getTime() + 7 * 864e5);
  const hot = leads.filter((l) => l.temperature === "hot" && l.status !== "closed").length;
  const dueWeek = leads.filter((l) => l.status === "follow_up" && l.retry_after && new Date(l.retry_after) <= weekEnd).length;
  const overdue = leads.filter((l) => l.status === "follow_up" && dueOf(l, now) === "overdue").length;
  const done = leads.filter((l) => l.work_state === "completed").length;
  const pct = leads.length ? Math.round((done / leads.length) * 100) : 0;
  // Follow-ups due over the next 4 weeks (from retry_after only — no invented values).
  const weeks = [0, 1, 2, 3].map((w) => {
    const a = now.getTime() + w * 7 * 864e5;
    const b = a + 7 * 864e5;
    const n = leads.filter((l) => l.status === "follow_up" && l.retry_after && Date.parse(l.retry_after) >= a && Date.parse(l.retry_after) < b).length;
    return { label: w === 0 ? t({ bn: "এই সপ্তাহ", en: "This week" }) : t({ bn: `${w + 1}য় সপ্তাহ`, en: `Week ${w + 1}` }), n };
  });
  const max = Math.max(1, ...weeks.map((w) => w.n));
  return (
    <section className="space-y-4">
      <SectionTitle title={t({ bn: "আউটলুক", en: "Outlook" })} sub={t({ bn: "সামনের কাজ — শুধু আসল সংখ্যা।", en: "What's ahead — real counts only." })} />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard loading={isPending} label={t({ bn: "সক্রিয় হট লিড", en: "Active hot leads" })} value={num(hot, lang)} icon={<Flame />} tone="destructive" />
        <StatCard loading={isPending} label={t({ bn: "৭ দিনে ফলো-আপ", en: "Follow-ups in 7 days" })} value={num(dueWeek, lang)} icon={<CalendarClock />} tone="chart4" />
        <StatCard loading={isPending} label={t({ bn: "সময় পেরিয়েছে", en: "Overdue" })} value={num(overdue, lang)} icon={<CalendarClock />} tone="destructive" />
        <StatCard loading={isPending} label={t({ bn: "কাজ শেষ", en: "Completed" })} value={`${num(pct, lang)}%`} sub={`${num(done, lang)} / ${num(leads.length, lang)}`} icon={<TrendingUp />} tone="live" />
      </div>
      <div className="rounded-2xl border border-border bg-card p-4">
        <h3 className="mb-3 flex items-center gap-2 text-base font-semibold">
          <Users className="size-4 text-primary" aria-hidden /> {t({ bn: "সামনের ৪ সপ্তাহের ফলো-আপ", en: "Follow-ups due, next 4 weeks" })}
        </h3>
        <ul className="space-y-2">
          {weeks.map((w) => (
            <li key={w.label} className="grid grid-cols-[6rem_minmax(0,1fr)_2.5rem] items-center gap-3 text-sm">
              <span className="truncate text-muted-foreground">{w.label}</span>
              <span className="h-3 overflow-hidden rounded-full bg-muted" role="img" aria-label={`${w.label}: ${w.n}`}>
                <span className="block h-full rounded-full bg-primary transition-[width] motion-reduce:transition-none" style={{ width: `${(w.n / max) * 100}%` }} />
              </span>
              <span className="text-right font-semibold tabular-nums">{num(w.n, lang)}</span>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-muted-foreground">
          {t({ bn: "টাকার অনুমান দেখানো হয় না — CRM-এ ডিলের মূল্য রাখা হয় না।", en: "No money projection is shown — the CRM does not store deal values." })}
        </p>
      </div>
    </section>
  );
}
