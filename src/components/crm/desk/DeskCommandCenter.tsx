import { dhakaDay } from "@/lib/lead-groups";
import { Link, useRouterState } from "@tanstack/react-router";
import {
  AlarmClock,
  CalendarClock,
  CheckCircle2,
  Flame,
  MessageCircle,
  PhoneCall,
  PhoneOutgoing,
  RotateCcw,
  Search,
  SlidersHorizontal,
  Timer,
  TrendingUp,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { matchCallShortcut, pickNextEligible, SHORTCUT_LABELS } from "@/lib/call-shortcuts";
import { useLang, useT, type Lang } from "@/lib/i18n";

import { CallbackLogButton } from "@/components/crm/CallbackLogButton";
import { LeadCallControls } from "@/components/crm/desk/LeadCallControls";
import { FollowUpResolveActions } from "@/components/crm/FollowUpResolveActions";
import { LeadDossier } from "@/components/crm/LeadDossier";
import { WebCallButton } from "@/components/crm/WebCallButton";
import { WhatsAppAction } from "@/components/crm/WhatsAppAction";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { EmptyState, StatCard } from "@/components/crm/ui-kit";
import {
  buildTimeline,
  CONNECTED_THRESHOLD_SECONDS,
  LEAD_EVENT_LABELS,
  useSnapshot,
  type Lead,
} from "@/lib/crm-data";
import { formatTalkTime, relativeTime, shortDate } from "@/lib/crm-format";
import { useMyAccount } from "@/lib/session";
import { cn } from "@/lib/utils";
import { isParked } from "@/lib/no-answer-cadence";

const STATUS_LABELS: Record<string, { bn: string; en: string }> = {
  pending: { bn: "কল হয়নি", en: "Not called" },
  contacted: { bn: "কথা হয়েছে", en: "Contacted" },
  follow_up: { bn: "আবার যোগাযোগ", en: "Follow-up" },
  closed: { bn: "শেষ হয়েছে", en: "Closed" },
};

const STATUS_STYLES: Record<string, string> = {
  pending: "border-idle/30 bg-idle/15 text-idle-foreground",
  contacted: "border-primary/25 bg-accent text-accent-foreground",
  follow_up: "border-chart-4/30 bg-chart-4/10 text-chart-4",
  closed: "border-live/30 bg-live/10 text-live",
};

const TEMP_STYLES: Record<string, string> = {
  hot: "border-destructive/30 bg-destructive/10 text-destructive",
  warm: "border-chart-4/30 bg-chart-4/10 text-chart-4",
  cold: "border-primary/25 bg-primary/10 text-primary",
};

const TEMP_LABELS: Record<string, { bn: string; en: string }> = {
  hot: { bn: "হট", en: "Hot" },
  warm: { bn: "গরম", en: "Warm" },
  cold: { bn: "ঠান্ডা", en: "Cold" },
};

function statusLabel(status: string, lang: Lang) {
  return STATUS_LABELS[status]?.[lang] ?? status;
}

function tempLabel(temp: string | null | undefined, lang: Lang) {
  if (!temp) return temp ?? "";
  return TEMP_LABELS[temp]?.[lang] ?? temp;
}

type QueueFilter = "pending" | "follow_up" | "parked" | "hot" | "done" | "all";
type QueueSort = "priority" | "recent" | "name" | "serial";

const QUEUE_LABELS: Record<QueueFilter, { bn: string; en: string }> = {
  pending: { bn: "কল বাকি", en: "Pending" },
  follow_up: { bn: "আবার যোগাযোগ", en: "Follow-up" },
  parked: { bn: "স্নুজ / সাড়াহীন", en: "Snoozed / Unresponsive" },
  hot: { bn: "হট", en: "Hot" },
  done: { bn: "কথা হয়েছে", en: "Contacted" },
  all: { bn: "সব", en: "All" },
};

const SORT_LABELS: Record<QueueSort, { bn: string; en: string }> = {
  priority: { bn: "অগ্রাধিকার আগে", en: "Priority first" },
  recent: { bn: "সাম্প্রতিক আগে", en: "Most recent" },
  name: { bn: "নাম অনুযায়ী", en: "By name" },
  serial: { bn: "সিরিয়াল অনুযায়ী", en: "By serial" },
};

/** Headline with a muted sub-label underneath, used across the whole board. */
function DualHeading({
  bnText,
  enText,
  icon,
  id,
}: {
  bnText: string;
  enText: string;
  icon?: React.ReactNode;
  id?: string;
}) {
  const lang = useLang();
  return (
    <div className="min-w-0">
      <h3 id={id} className="flex items-center gap-2 truncate text-sm font-semibold">
        {icon}
        {lang === "en" ? enText : bnText}
      </h3>
      <p className="truncate text-[10px] uppercase tracking-wide text-muted-foreground">
        {lang === "en" ? bnText : enText}
      </p>
    </div>
  );
}

/**
 * The follow-up resolve pair only makes sense once the lead has actually been
 * contacted: it is parked for follow-up, or a call/attempt is already on record.
 */
function canResolveFollowUp(lead: Lead) {
  if (lead.status === "closed") return false;
  // Only a lead actually parked for follow-up can be rescheduled or finished.
  return lead.status === "follow_up" || Boolean(lead.retry_after);
}

function bn(n: number, lang: Lang) {
  return n.toLocaleString(lang === "en" ? "en-GB" : "bn-BD");
}

function useCompactDesk() {
  const [compact, setCompact] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 1279px)");
    const update = () => setCompact(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  return compact;
}


/**
 * Sales command centre for the agent's own desk: KPI strip, quick actions, the
 * agent's lead queue and a Lead 360 side panel. Every number here comes from the
 * same scoped snapshot the rest of V1 uses — no new rules, no extra data.
 */
export function DeskCommandCenter({
  onJumpTab,
  actions,
}: {
  onJumpTab?: (tab: string) => void;
  actions?: React.ReactNode;
}) {
  const { account } = useMyAccount();
  const { leads, profiles, calls, messages, events, isPending } = useSnapshot();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // ?lead=<id> (from Pipeline / Tasks / search) selects that lead if it is in the caller's own snapshot.
  const leadParam = useRouterState({ select: (st) => (st.location.search as Record<string, unknown>)["lead"] });
  useEffect(() => {
    if (typeof leadParam === "string") setSelectedId(leadParam);
  }, [leadParam]);
  const [dossierId, setDossierId] = useState<string | null>(null);
  const [filter, setFilter] = useState<QueueFilter>("pending");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<QueueSort>("priority");
  const [mobile360Open, setMobile360Open] = useState(false);
  const [callMode, setCallMode] = useState(false);
  const t = useT();
  const lang = useLang();
  const [doneIds, setDoneIds] = useState<string[]>([]);
  const queueItemRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const mobile360HeadingRef = useRef<HTMLHeadingElement | null>(null);
  const compactDesk = useCompactDesk();

  const stats = useMemo(() => {
    const now = Date.now();
    const today = dhakaDay(new Date());
    const onToday = <T extends { created_at: string }>(rows: T[]) =>
      rows.filter((r) => dhakaDay(new Date(r.created_at)) === today);

    const todayCalls = onToday(calls);
    const connected = todayCalls.filter(
      (c) => c.duration_seconds > CONNECTED_THRESHOLD_SECONDS,
    ).length;
    const followUps = leads.filter((l) => l.status === "follow_up");
    const overdue = followUps.filter((l) => l.retry_after && Date.parse(l.retry_after) < now);
    const dueToday = followUps.filter(
      (l) => l.retry_after && dhakaDay(new Date(l.retry_after)) === today,
    );
    const done = leads.filter((l) => l.work_state === "completed").length;
    return {
      total: leads.length,
      pending: leads.filter((l) => l.status === "pending").length,
      done,
      donePct: leads.length ? Math.round((done / leads.length) * 100) : 0,
      calls: todayCalls.length,
      connected,
      connectRate: todayCalls.length ? Math.round((connected / todayCalls.length) * 100) : 0,
      talk: todayCalls.reduce((s, c) => s + c.duration_seconds, 0),
      whatsapp: onToday(messages).length,
      followUp: followUps.length,
      overdue: overdue.length,
      dueToday: dueToday.length,
      hot: leads.filter((l) => l.temperature === "hot" && l.status !== "closed").length,
      newToday: onToday(leads).length,
      uncalled: leads.filter((l) => l.call_attempts === 0 && !l.last_call_at).length,
    };
  }, [calls, leads, messages]);

  const rows = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const now = Date.now();
    return leads
      .filter((l) => {
        if (filter === "parked") return isParked(l);
        if (filter === "pending") return l.status === "pending" && !isParked(l);
        if (filter === "follow_up") return l.status === "follow_up";
        if (filter === "hot") return l.temperature === "hot" && l.status !== "closed";
        if (filter === "done") return l.status === "contacted" || l.status === "closed";
        return true;
      })
      .filter(
        (l) =>
          !needle ||
          l.name.toLowerCase().includes(needle) ||
          l.phone_number.includes(needle) ||
          (l.address ?? "").toLowerCase().includes(needle) ||
          (l.serial_no ?? "").toLowerCase().includes(needle),
      )
      .sort((a, b) => {
        if (sort === "recent") {
          return Date.parse(b.last_call_at ?? b.created_at) - Date.parse(a.last_call_at ?? a.created_at);
        }
        if (sort === "name") return a.name.localeCompare(b.name, "bn");
        if (sort === "serial") {
          return (a.serial_no ?? "").localeCompare(b.serial_no ?? "", "bn", { numeric: true });
        }
        const aOver = a.retry_after && Date.parse(a.retry_after) < now ? 0 : 1;
        const bOver = b.retry_after && Date.parse(b.retry_after) < now ? 0 : 1;
        if (aOver !== bOver) return aOver - bOver;
        // Not connected / busy / failed retries go to the end of the queue and
        // come back in order: the longest-waiting retry first.
        const retry = (lead: Lead) => (lead.status === "pending" && lead.last_call_at ? 1 : 0);
        if (retry(a) !== retry(b)) return retry(a) - retry(b);
        if (retry(a) && retry(b)) {
          return Date.parse(a.last_call_at!) - Date.parse(b.last_call_at!);
        }
        const rank = (lead: Lead) =>
          lead.temperature === "hot" ? 0 : lead.temperature === "warm" ? 1 : 2;
        const byTemperature = rank(a) - rank(b);
        if (byTemperature !== 0) return byTemperature;
        return (a.serial_no ?? "").localeCompare(b.serial_no ?? "", "bn", { numeric: true });
      })
      .slice(0, 60);
  }, [leads, filter, search, sort]);

  const priority = useMemo(() => {
    const now = Date.now();
    return leads
      .filter((l) => l.status !== "closed")
      .map((l) => {
        const overdue = l.retry_after ? Date.parse(l.retry_after) < now : false;
        const score =
          (overdue ? 100 : 0) +
          (l.temperature === "hot" ? 50 : l.temperature === "warm" ? 20 : 0) +
          (l.status === "follow_up" ? 15 : 0);
        return { lead: l, overdue, score };
      })
      .filter((r) => r.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 6);
  }, [leads]);

  const activity = useMemo(() => {
    const rowsAll = [
      ...calls.map((c) => ({
        id: `c-${c.id}`,
        at: c.created_at,
        title:
          c.duration_seconds > CONNECTED_THRESHOLD_SECONDS
            ? (lang === "en"
                ? `Call connected · ${formatTalkTime(c.duration_seconds)}`
                : `কল হয়েছে · ${formatTalkTime(c.duration_seconds)}`)
            : t({ bn: "কল ধরা হয়নি", en: "Call not answered" }),
        icon: <PhoneCall className="size-3.5" />,
      })),
      ...messages.map((m) => ({
        id: `m-${m.id}`,
        at: m.created_at,
        title: t({ bn: "হোয়াটসঅ্যাপ মেসেজ", en: "WhatsApp message" }),
        icon: <MessageCircle className="size-3.5" />,
      })),
      ...leads.map((l) => ({
        id: `l-${l.id}`,
        at: l.created_at,
        title: t({ bn: `লিড যোগ · ${l.name}`, en: `Lead added · ${l.name}` }),
        icon: <UserPlus className="size-3.5" />,
      })),
    ];
    return rowsAll
      .sort((a, b) => Date.parse(b.at) - Date.parse(a.at))
      .slice(0, 8)
      .map((r) => ({
        ...r,
        when: new Date(r.at).toLocaleTimeString(lang === "en" ? "en-GB" : "bn-BD", {
          hour: "2-digit",
          minute: "2-digit",
        }),
      }));
  }, [calls, leads, messages, lang, t]);

  const upcoming = useMemo(() => {
    const now = Date.now();
    const horizon = now + 7 * 24 * 60 * 60 * 1000;
    return leads
      .filter((l) => l.status === "follow_up" && l.retry_after)
      .map((l) => ({ lead: l, at: l.retry_after as string }))
      .filter(({ at }) => Date.parse(at) >= now - 24 * 60 * 60 * 1000 && Date.parse(at) <= horizon)
      .sort((a, b) => Date.parse(a.at) - Date.parse(b.at))
      .slice(0, 6);
  }, [leads]);

  const selected: Lead | null =
    leads.find((l) => l.id === selectedId) ?? priority[0]?.lead ?? rows[0] ?? null;
  const dossierLead = leads.find((l) => l.id === dossierId) ?? null;

  const selectedHistory = selected
    ? buildTimeline(calls, messages, selected.id, events)
        .slice()
        .reverse()
        .slice(0, 6)
        .map((entry, i) => ({
          key: `${entry.at}-${i}`,
          at: entry.at,
          title:
            entry.kind === "call"
              ? entry.call.duration_seconds > CONNECTED_THRESHOLD_SECONDS
                ? `${t({ bn: "কল", en: "Call" })} · ${formatTalkTime(entry.call.duration_seconds)}`
                : t({ bn: "কল ধরা হয়নি", en: "Call not answered" })
              : entry.kind === "message"
                ? t({ bn: "হোয়াটসঅ্যাপ মেসেজ", en: "WhatsApp message" })
                : (LEAD_EVENT_LABELS[entry.event.kind] ?? entry.event.kind),
        }))
    : [];

  const hasQueueState = filter !== "pending" || search.trim().length > 0 || sort !== "priority";
  const resetQueue = () => {
    setFilter("pending");
    setSearch("");
    setSort("priority");
  };
  const selectLead = (leadId: string) => {
    setSelectedId(leadId);
    if (compactDesk) setMobile360Open(true);
  };
  // Call mode: after a report is saved, open the next open lead in the queue.
  const rowsRef = useRef(rows);
  rowsRef.current = rows;
  useEffect(() => {
    if (!callMode) return;
    const onSubmitted = (e: Event) => {
      const leadId = (e as CustomEvent<{ leadId: string | null }>).detail?.leadId;
      setDoneIds((prev) => (leadId ? [...prev, leadId] : prev));
      const next = pickNextEligible(rowsRef.current, [...doneIds, leadId].filter(Boolean) as string[]);
      if (next) {
        setSelectedId(next.id);
        toast.success(t({ bn: `পরের লিড: ${next.name}`, en: `Next lead: ${next.name}` }));
      } else toast.success(t({ bn: "এই তালিকার সব লিড শেষ!", en: "All leads in this list are done!" }));
    };
    window.addEventListener("winstone:report-submitted", onSubmitted);
    return () => window.removeEventListener("winstone:report-submitted", onSubmitted);
  }, [callMode, doneIds, t]);
  // Alt+Shift+N: same selection rule as auto-advance. Blocked while any dialog
  // (incl. the mandatory call report) is open, so it can never skip a pending report.
  const selectedIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (!callMode) return;
    const onKey = (e: KeyboardEvent) => {
      if (matchCallShortcut(e) !== "next") return;
      if (document.querySelector('[role="dialog"], [role="alertdialog"]')) return;
      e.preventDefault();
      const next = pickNextEligible(rowsRef.current, doneIds, selectedIdRef.current);
      if (next) setSelectedId(next.id);
      else toast.message(t({ bn: "এই তালিকায় আর কোনো যোগ্য লিড নেই", en: "No more eligible leads" }));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [callMode, doneIds, t]);
  selectedIdRef.current = selected?.id ?? null;
  const stepLead = (dir: 1 | -1) => {
    const i = rows.findIndex((l) => l.id === selected?.id);
    const next = rows[Math.min(Math.max(i + dir, 0), rows.length - 1)];
    if (next) setSelectedId(next.id);
  };

  const moveQueueFocus = (leadId: string, key: string) => {
    const currentIndex = rows.findIndex((lead) => lead.id === leadId);
    if (currentIndex < 0 || rows.length === 0) return;
    let nextIndex = currentIndex;
    if (key === "ArrowDown") nextIndex = Math.min(currentIndex + 1, rows.length - 1);
    if (key === "ArrowUp") nextIndex = Math.max(currentIndex - 1, 0);
    if (key === "Home") nextIndex = 0;
    if (key === "End") nextIndex = rows.length - 1;
    if (nextIndex === currentIndex && !["Home", "End"].includes(key)) return;
    const nextLead = rows[nextIndex];
    if (!nextLead) return;
    queueItemRefs.current[nextLead.id]?.focus();
  };

  return (
    <section className="space-y-3">
      {/* Agent / status bar */}
      <div className="card-elevated grid min-w-0 gap-3 p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-primary/12 text-sm font-bold text-primary">
            {(account?.profile?.name ?? t({ bn: "এ", en: "A" })).slice(0, 2)}
          </span>
          <div className="min-w-0">
            <p className="truncate text-base font-bold tracking-tight sm:text-lg">
              {account?.profile?.name ?? t({ bn: "এজেন্ট", en: "Agent" })}
            </p>
            <p className="truncate text-[11px] text-muted-foreground">
              {account?.profile?.employee_id ?? t({ bn: "এজেন্ট", en: "Agent" })} ·{" "}
              {new Date().toLocaleDateString(lang === "en" ? "en-GB" : "bn-BD", {
                weekday: "long",
                day: "numeric",
                month: "long",
              })}
            </p>
          </div>
        </div>
        <div className="flex min-w-0 flex-wrap items-center gap-2 sm:justify-end">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-live/30 bg-live/10 px-2.5 py-1 text-[11px] font-semibold text-live">
            <span className="size-1.5 rounded-full bg-live" /> {t({ bn: "ডেস্ক চালু", en: "Live" })}
          </span>
          {stats.overdue > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full border border-destructive/30 bg-destructive/10 px-2.5 py-1 text-[11px] font-semibold text-destructive">
              <AlarmClock className="size-3" />{" "}
              {t({ bn: `${bn(stats.overdue, lang)}টি সময় পেরিয়েছে`, en: `${bn(stats.overdue, lang)} overdue` })}
            </span>
          )}
          {actions}
        </div>
      </div>

      {/* Next best action — the single highest-priority lead from the agent's own queue.
          This is where calls start, so it is the most prominent card on the desk. */}
      {priority[0] && (
        <section
          aria-labelledby="nba-heading"
          className="relative overflow-hidden rounded-3xl border-2 border-primary/40 bg-gradient-to-br from-primary/15 via-card to-card p-4 shadow-lg sm:p-5"
        >
          <div className="grid min-w-0 gap-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
            <div className="flex min-w-0 items-center gap-3 sm:gap-4">
              <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-md sm:size-14">
                <PhoneCall className="size-6" aria-hidden />
              </span>
              <div className="min-w-0">
                <p id="nba-heading" className="text-xs font-bold uppercase tracking-[0.18em] text-primary">
                  {t({ bn: "পরবর্তী সেরা কল", en: "Next best call" })}
                </p>
                <p className="mt-0.5 truncate text-xl font-extrabold tracking-tight sm:text-2xl">
                  {priority[0].lead.name}
                </p>
                <div className="mt-1 flex min-w-0 flex-wrap items-center gap-2">
                  <span className="tabular-nums text-sm text-muted-foreground">{priority[0].lead.phone_number}</span>
                  <span
                    className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${
                      priority[0].overdue
                        ? "border-destructive/30 bg-destructive/10 text-destructive"
                        : priority[0].lead.temperature === "hot"
                          ? "border-primary/30 bg-primary/10 text-primary"
                          : "border-border bg-muted text-muted-foreground"
                    }`}
                  >
                    {priority[0].overdue ? <AlarmClock className="size-3" aria-hidden /> : <Flame className="size-3" aria-hidden />}
                    {priority[0].overdue
                      ? t({ bn: "ফলো-আপের সময় পেরিয়েছে", en: "Follow-up overdue" })
                      : priority[0].lead.temperature === "hot"
                        ? t({ bn: "হট লিড — আগে কল করুন", en: "Hot lead — call first" })
                        : t({ bn: "অগ্রাধিকার লিড", en: "Priority lead" })}
                  </span>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 md:flex md:items-center">
              <WebCallButton
                leadId={priority[0].lead.id}
                phone={priority[0].lead.phone_number}
                label={t({ bn: "এখনই কল করুন", en: "Call now" })}
                className="h-12 px-6 text-base font-bold shadow-md"
                ariaLabel={t({ bn: `${priority[0].lead.name}-কে কল করুন`, en: `Call ${priority[0].lead.name}` })}
              />
              <Button variant="outline" className="h-12" onClick={() => selectLead(priority[0]!.lead.id)}>
                {t({ bn: "লিড ৩৬০", en: "Lead 360" })}
              </Button>
            </div>
          </div>
        </section>
      )}

      {/* KPI strip — every figure from the agent's own snapshot */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <StatCard
          icon={<Users />}
          label={t({ bn: "আমার লিড", en: "My leads" })}
          value={bn(stats.total, lang)}
          sub={t({ bn: `${bn(stats.pending, lang)}টি কল বাকি`, en: `${bn(stats.pending, lang)} pending` })}
          loading={isPending}
        />
        <StatCard
          icon={<PhoneOutgoing />}
          label={t({ bn: "আজকের কল", en: "Today's calls" })}
          value={bn(stats.calls, lang)}
          sub={t({
            bn: `${bn(stats.connected, lang)}টিতে কথা · ${bn(stats.connectRate, lang)}%`,
            en: `${bn(stats.connected, lang)} connected · ${bn(stats.connectRate, lang)}%`,
          })}
          tone="live"
          loading={isPending}
        />
        <StatCard
          icon={<Timer />}
          label={t({ bn: "আজকের কথার সময়", en: "Talk time today" })}
          value={formatTalkTime(stats.talk)}
          sub={t({ bn: `${bn(stats.whatsapp, lang)}টি হোয়াটসঅ্যাপ আজ`, en: `${bn(stats.whatsapp, lang)} WhatsApp today` })}
          loading={isPending}
        />
        <StatCard
          icon={<CalendarClock />}
          label={t({ bn: "ফলো-আপ", en: "Follow-ups" })}
          value={bn(stats.followUp, lang)}
          sub={t({
            bn: `আজ ${bn(stats.dueToday, lang)}টি · সময় পেরিয়েছে ${bn(stats.overdue, lang)}টি`,
            en: `${bn(stats.dueToday, lang)} due today · ${bn(stats.overdue, lang)} overdue`,
          })}
          tone="chart4"
          loading={isPending}
        />
        <StatCard
          icon={<Flame />}
          label={t({ bn: "হট লিড", en: "Hot leads" })}
          value={bn(stats.hot, lang)}
          sub={t({ bn: `${bn(stats.uncalled, lang)}টিতে এখনো কল হয়নি`, en: `${bn(stats.uncalled, lang)} not yet called` })}
          tone="destructive"
          loading={isPending}
        />
        <StatCard
          icon={<CheckCircle2 />}
          label={t({ bn: "শেষ হয়েছে", en: "Completed" })}
          value={`${bn(stats.done, lang)} / ${bn(stats.total, lang)}`}
          sub={t({ bn: `${bn(stats.donePct, lang)}% কাজ শেষ`, en: `${bn(stats.donePct, lang)}% complete` })}
          tone="live"
          loading={isPending}
        />
      </div>

      {/* Reference-style summary cards: what's coming up, and what already happened */}
      <div className="grid min-w-0 gap-3 lg:grid-cols-2">
        <div className="card-elevated p-4">
          <DualHeading bnText="আগামী ৭ দিনে ফলো-আপ" enText="Coming up (next 7 days)" />
          {upcoming.length > 0 ? (
            <ul className="mt-3 space-y-1.5">
              {upcoming.map(({ lead, at }) => (
                <li key={lead.id}>
                  <button
                    type="button"
                    onClick={() => selectLead(lead.id)}
                    className="flex min-h-10 w-full min-w-0 items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[11px] transition-colors hover:bg-muted"
                  >
                    <CalendarClock className="size-3.5 shrink-0 text-chart-4" aria-hidden />
                    <span className="min-w-0 flex-1 truncate font-medium text-foreground">{lead.name}</span>
                    <span className="shrink-0 tabular-nums text-muted-foreground">{shortDate(at)}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState
              compact
              icon={<CalendarClock />}
              title={t({ bn: "আগামী ৭ দিনে কিছু বাকি নেই।", en: "Nothing due in the next 7 days." })}
            />
          )}
        </div>

        <div className="card-elevated p-4">
          <DualHeading bnText="আমার সাম্প্রতিক কাজ" enText="Recent activity" />
          {activity.length > 0 ? (
            <ul className="mt-3 space-y-2">
              {activity.map((row) => (
                <li key={row.id} className="flex items-center gap-2 text-[11px]">
                  <span className="grid size-6 shrink-0 place-items-center rounded-full bg-primary/12 text-primary">
                    {row.icon}
                  </span>
                  <span className="min-w-0 flex-1 truncate">{row.title}</span>
                  <span className="shrink-0 text-muted-foreground">{row.when}</span>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState
              compact
              icon={<PhoneCall />}
              title={t({
                bn: "এখনো কোনো কাজ নেই। পরবর্তী সেরা লিডকে কল করে শুরু করুন।",
                en: "No activity yet. Start by calling your next best lead.",
              })}
            />
          )}
        </div>
      </div>

      <div className="grid min-w-0 gap-3 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-3">
          {/* Lead queue */}
          <div className="card-elevated p-3 sm:p-4" role="region" aria-labelledby="lead-queue-heading">
            {/* Pinned controls: stay visible while the page scrolls — no nested scroll box. */}
            <div className="sticky top-14 z-20 -mx-3 -mt-3 rounded-t-xl border-b border-border/60 bg-card/95 px-3 pb-2 pt-3 backdrop-blur sm:-mx-4 sm:-mt-4 sm:px-4 sm:pt-4">
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="text-[11px] text-muted-foreground">
                {callMode
                  ? t({
                      bn: "কল মোড চালু — রিপোর্টের পর পরের লিড নিজেই খুলবে",
                      en: "Call mode on — the next lead opens automatically after each report",
                    })
                  : t({
                      bn: "কল মোডে বর্তমান লিড ও কলের বোতাম সবসময় উপরে থাকে",
                      en: "Call mode keeps the current lead and call button pinned at the top",
                    })}
              </span>
              <Button type="button" size="sm" variant={callMode ? "default" : "outline"} className="h-8 shrink-0 gap-1.5" onClick={() => setCallMode((v) => !v)} aria-pressed={callMode}>
                <PhoneCall className="size-3.5" /> {callMode ? t({ bn: "কল মোড বন্ধ", en: "Turn off call mode" }) : t({ bn: "কল মোড চালু", en: "Turn on call mode" })}
              </Button>
            </div>
            {callMode && (
              <p className="mb-2 text-[11px] text-muted-foreground" aria-live="polite">
                <span className="sr-only">Keyboard shortcuts: </span>
                <kbd className="rounded border border-border bg-muted px-1 font-mono">Ctrl/⌘ + Enter</kbd>{" "}
                {t(SHORTCUT_LABELS.save).split("—")[1]} ·{" "}
                <kbd className="rounded border border-border bg-muted px-1 font-mono">Alt + Shift + N</kbd>{" "}
                {t(SHORTCUT_LABELS.next).split("—")[1]}
              </p>
            )}
            {callMode && selected && (
              <div className="mb-3 rounded-xl border border-primary/30 bg-primary/5 p-3">
                <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
                  <div className="min-w-0">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-primary">
                      {t({ bn: "এখনকার লিড", en: "Current lead" })}
                    </p>
                    <p className="truncate text-base font-bold">{selected.name}</p>
                    <p className="truncate text-xs tabular-nums text-muted-foreground">
                      {selected.phone_number}
                      {selected.temperature ? ` · ${tempLabel(selected.temperature, lang)}` : ""}
                      {` · ${t({ bn: `${bn(selected.call_attempts, lang)} বার চেষ্টা`, en: `${bn(selected.call_attempts, lang)} attempts` })}`}
                      {selected.last_call_at
                        ? ` · ${t({ bn: `শেষ কল ${relativeTime(selected.last_call_at)}`, en: `Last call ${relativeTime(selected.last_call_at)}` })}`
                        : ""}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <Button type="button" size="icon" variant="outline" className="size-9" onClick={() => stepLead(-1)} aria-label={t({ bn: "আগের লিড", en: "Previous lead" })}>‹</Button>
                    <Button type="button" size="icon" variant="outline" className="size-9" onClick={() => stepLead(1)} aria-label={t({ bn: "পরের লিড", en: "Next lead" })}>›</Button>
                  </div>
                </div>
                <LeadCallControls leadId={selected.id} phone={selected.phone_number} name={selected.name}
                  onDetails={() => setDossierId(selected.id)} />
              </div>
            )}
            <div className="grid min-w-0 gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
              <div className="min-w-0">
                <h3 id="lead-queue-heading" className="truncate text-sm font-semibold">
                  {t({ bn: "আমার লিড কিউ", en: "My Lead Queue" })}
                </h3>
                <p id="lead-queue-help" className="text-[11px] text-muted-foreground">
                  {t({ bn: `${bn(rows.length, lang)}টি দেখা যাচ্ছে`, en: `Showing ${rows.length} leads` })}
                </p>
              </div>
              <div className="relative min-w-0 sm:w-64">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={t({ bn: "নাম বা নম্বর", en: "Name or number" })}
                  className="h-10 pl-9 pr-9"
                  aria-label={t({ bn: "আমার লিড কিউতে নাম, নম্বর, ঠিকানা বা সিরিয়াল দিয়ে খুঁজুন", en: "Search my lead queue by name, number, address or serial" })}
                  aria-controls="agent-lead-queue-results"
                />
                {search && (
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="absolute right-1 top-1/2 size-8 -translate-y-1/2"
                    onClick={() => setSearch("")}
                    aria-label={t({ bn: "সার্চ মুছুন", en: "Clear search" })}
                  >
                    <X className="size-3.5" />
                  </Button>
                )}
              </div>
            </div>

            <div className="mt-2 grid min-w-0 gap-2 sm:grid-cols-[minmax(0,1fr)_190px]">
              <div
                className="flex min-w-0 flex-wrap items-center gap-1.5"
                role="group"
                aria-label={t({ bn: "লিড কিউ ফিল্টার", en: "Lead queue filters" })}
              >
                {(Object.keys(QUEUE_LABELS) as QueueFilter[]).map((key) => (
                  <Button
                    key={key}
                    type="button"
                    size="sm"
                    variant={filter === key ? "default" : "outline"}
                    onClick={() => setFilter(key)}
                    className={cn("h-8 min-h-8 min-w-0 whitespace-nowrap rounded-lg px-3 text-xs", key === "pending" || key === "hot" ? "border-destructive/30" : key === "done" ? "border-success/30" : key === "follow_up" ? "border-chart-4/30" : "border-chart-2/30")}
                    aria-pressed={filter === key}
                    aria-controls="agent-lead-queue-results"
                  >
                    {t(QUEUE_LABELS[key])}
                  </Button>
                ))}
              </div>
              <Select value={sort} onValueChange={(value) => setSort(value as QueueSort)}>
                <SelectTrigger className="h-9 w-full" aria-label={t({ bn: "লিড সাজান", en: "Sort leads" })}>
                  <SlidersHorizontal className="size-3.5 shrink-0 text-muted-foreground" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(SORT_LABELS) as QueueSort[]).map((key) => (
                    <SelectItem key={key} value={key}>
                      {t(SORT_LABELS[key])}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div
              className="mt-2 grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-lg border border-border/70 bg-surface-2/60 p-2 text-[11px]"
              aria-live="polite"
            >
              <div className="flex min-w-0 flex-wrap items-center gap-2 px-0.5 pb-0.5">
                <SlidersHorizontal className="size-3.5 shrink-0 text-primary" />
                <span className="shrink-0 text-muted-foreground">{t({ bn: "সক্রিয়:", en: "Active:" })}</span>
                <span className="shrink-0 rounded-full bg-primary/12 px-2 py-0.5 font-semibold text-primary">
                  {t(QUEUE_LABELS[filter])}
                </span>
                {search.trim() && (
                  <span className="max-w-40 shrink-0 truncate rounded-full bg-accent px-2 py-0.5 font-semibold text-accent-foreground">
                    {t({ bn: `খোঁজ: ${search.trim()}`, en: `Search: ${search.trim()}` })}
                  </span>
                )}
                <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-muted-foreground">
                  {t(SORT_LABELS[sort])}
                </span>
                <span className="tabular shrink-0 text-muted-foreground" role="status">
                  {t({ bn: `${bn(rows.length, lang)} ফল`, en: `${bn(rows.length, lang)} results` })}
                </span>
              </div>
              <Button
                type="button"
                size="sm"
                variant={hasQueueState ? "secondary" : "ghost"}
                className="h-8 shrink-0 gap-1 px-2 text-[11px]"
                onClick={resetQueue}
                disabled={!hasQueueState}
                aria-label={t({ bn: "লিড কিউয়ের ফিল্টার, সার্চ ও সাজানো রিসেট করুন", en: "Reset lead queue filters, search and sort" })}
              >
                <RotateCcw className="size-3" /> {t({ bn: "রিসেট", en: "Reset" })}
              </Button>
            </div>
            </div>

            <div className="mt-3">
              <ul
                id="agent-lead-queue-results"
                 className="grid grid-cols-1 items-start gap-3 sm:grid-cols-2"
                aria-label={t({
                  bn: `${t(QUEUE_LABELS[filter])} লিড, ${t(SORT_LABELS[sort])}, ${bn(rows.length, lang)} ফল`,
                  en: `${t(QUEUE_LABELS[filter])} leads, ${t(SORT_LABELS[sort])}, ${bn(rows.length, lang)} results`,
                })}
                aria-describedby="lead-queue-help"
              >
                {rows.map((lead) => {
                  const overdue = lead.retry_after ? Date.parse(lead.retry_after) < Date.now() : false;
                  return (
                    <li
                      key={lead.id}
                      className={cn(
                         "min-w-0 rounded-2xl border bg-card p-4 transition-colors",
                        selected?.id === lead.id
                          ? "border-primary/40 bg-primary/5"
                           : "border-border/70 hover:border-primary/30",
                      )}
                    >
                      <Button
                        type="button"
                         variant="ghost"
                         ref={(node) => {
                           queueItemRefs.current[lead.id] = node;
                         }}
                         onClick={() => selectLead(lead.id)}
                         onKeyDown={(event) => {
                           if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
                             event.preventDefault();
                             moveQueueFocus(lead.id, event.key);
                           }
                         }}
                         aria-current={selected?.id === lead.id ? "true" : undefined}
                         aria-label={t({
                           bn: `${lead.name}, ${lead.phone_number}, ${statusLabel(lead.status, "bn")}${lead.temperature ? `, ${tempLabel(lead.temperature, "bn")}` : ""}. লিড ৩৬০ খুলুন`,
                           en: `${lead.name}, ${lead.phone_number}, ${statusLabel(lead.status, "en")}${lead.temperature ? `, ${tempLabel(lead.temperature, "en")}` : ""}. Open Lead 360`,
                         })}
                          className="block h-auto w-full min-w-0 whitespace-normal rounded-lg p-0 text-center hover:bg-transparent focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <div className="relative min-w-0 pb-2">
                          <span aria-hidden="true" className="mx-auto mb-3 grid size-14 place-items-center rounded-full bg-primary/10 text-xl font-semibold text-primary">
                             {String(lead.name).trim().slice(0, 1) || "—"}
                          </span>
                          <div className="min-w-0">
                            <p className="break-words text-base font-semibold">{lead.name}</p>
                            <p className="mt-1 break-all font-mono text-base font-medium text-foreground">
                              {lead.phone_number}
                            </p>
                             {lead.address && <p className="mt-1 truncate text-xs text-muted-foreground">{lead.address}</p>}
                          </div>
                          <span className="mt-2 flex min-w-0 flex-wrap items-center justify-center gap-x-2 gap-y-1 text-[10px] text-muted-foreground">
                            <span className="tabular">#{lead.serial_no ?? "—"}</span>
                            {lead.reference_by ? (
                              <span
                                className="max-w-[9rem] truncate"
                                title={t({ bn: `রেফারেন্স: ${lead.reference_by}`, en: `Reference: ${lead.reference_by}` })}
                              >
                                {t({ bn: "রেফ:", en: "Ref:" })} {lead.reference_by}
                              </span>
                            ) : null}
                          </span>
                        </div>
                        <div className="mb-3 mt-1.5 flex flex-wrap items-center justify-center gap-1.5">
                          <span
                            className={cn(
                              "rounded-full border px-2 py-0.5 text-[10px] font-semibold",
                              STATUS_STYLES[lead.status],
                            )}
                          >
                            {statusLabel(lead.status, lang)}
                          </span>
                          {lead.temperature && (
                            <span
                              className={cn(
                                "rounded-full border px-2 py-0.5 text-[10px] font-semibold capitalize",
                                TEMP_STYLES[lead.temperature] ?? "border-border bg-surface-2",
                              )}
                            >
                              {tempLabel(lead.temperature, lang)}
                            </span>
                          )}
                          {overdue && (
                            <span className="rounded-full border border-destructive/30 bg-destructive/10 px-2 py-0.5 text-[10px] font-semibold text-destructive">
                              {t({ bn: "সময় পেরিয়েছে", en: "Overdue" })}
                            </span>
                          )}
                          <span className="w-full text-[10px] text-muted-foreground">
                            {lead.last_call_at
                              ? relativeTime(lead.last_call_at)
                              : t({ bn: `${bn(lead.call_attempts, lang)} বার চেষ্টা`, en: `${bn(lead.call_attempts, lang)} attempts` })}
                          </span>
                        </div>
                      </Button>
                      <LeadCallControls leadId={lead.id} phone={lead.phone_number} name={lead.name}
                        onDetails={() => setDossierId(lead.id)} />
                      {canResolveFollowUp(lead) && (
                        <FollowUpResolveActions
                          leadId={lead.id}
                          leadName={lead.name}
                          compact
                          className="mt-2 border-t border-border/60 pt-2"
                        />
                      )}
                    </li>
                  );
                })}
                {rows.length === 0 && (
                  <li className="rounded-xl border border-dashed border-border p-8 text-center text-xs text-muted-foreground">
                    {t({ bn: "এই তালিকায় এখন কোনো লিড নেই", en: "No leads in this view" })}
                  </li>
                )}
              </ul>
            </div>
          </div>

          {/* Priority + performance */}
          <div className="grid gap-3 lg:grid-cols-2">
            <div className="card-elevated border-t-2 border-t-destructive bg-destructive/5 p-4">
              <DualHeading
                icon={<Flame className="size-4 text-destructive" />}
                bnText="অগ্রাধিকার কেন্দ্র"
                enText="Priority Center"
              />
              <ul className="mt-3 space-y-2">
                {priority.map(({ lead, overdue }) => (
                  <li key={lead.id}>
                    <button
                      type="button"
                       onClick={() => selectLead(lead.id)}
                       aria-label={t({
                         bn: `${lead.name}, ${overdue ? "ফলো-আপের সময় পেরিয়েছে" : tempLabel(lead.temperature, "bn") || statusLabel(lead.status, "bn")}. লিড ৩৬০ খুলুন`,
                         en: `${lead.name}, ${overdue ? "Follow-up overdue" : tempLabel(lead.temperature, "en") || statusLabel(lead.status, "en")}. Open Lead 360`,
                       })}
                       className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-lg px-1 py-1 text-left outline-none hover:bg-surface-2 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-xs font-semibold">{lead.name}</span>
                        <span className="tabular block truncate text-[10px] text-muted-foreground">
                          {lead.phone_number}
                          {lead.retry_after ? ` · ${shortDate(lead.retry_after)}` : ""}
                        </span>
                      </span>
                      <span
                        className={cn(
                          "shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold",
                          overdue
                            ? "border-destructive/30 bg-destructive/10 text-destructive"
                            : (TEMP_STYLES[lead.temperature ?? ""] ??
                              "border-border bg-surface-2 text-muted-foreground"),
                        )}
                      >
                        {overdue ? t({ bn: "সময় পেরিয়েছে", en: "Overdue" }) : (tempLabel(lead.temperature, lang) || statusLabel(lead.status, lang))}
                      </span>
                    </button>
                  </li>
                ))}
                {priority.length === 0 && (
                  <li className="text-[11px] text-muted-foreground">
                    {t({ bn: "এখন কোনো হট লিড বা বাকি ফলো-আপ নেই", en: "Nothing urgent right now" })}
                  </li>
                )}
              </ul>
            </div>

            <div className="card-elevated border-t-2 border-t-success bg-success/5 p-4">
              <DualHeading
                icon={<TrendingUp className="size-4 text-primary" />}
                bnText="আমার পারফরম্যান্স (আজ)"
                enText="My performance today"
              />
              <div className="mt-3 space-y-2.5 text-xs">
                <Meter label={t({ bn: "লিড শেষ", en: "Completed" })} value={stats.done} total={stats.total} />
                <Meter label={t({ bn: "কথা হয়েছে", en: "Connected" })} value={stats.connected} total={stats.calls} />
                <Meter
                  label={t({ bn: "ফলো-আপ সময়মতো", en: "On-time follow-ups" })}
                  value={Math.max(stats.followUp - stats.overdue, 0)}
                  total={stats.followUp}
                />
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <MiniStat label={t({ bn: "আজ যোগ হওয়া লিড", en: "New today" })} value={bn(stats.newToday, lang)} />
                <MiniStat label={t({ bn: "কথার সময়", en: "Talk time" })} value={formatTalkTime(stats.talk)} />
              </div>
              {onJumpTab && (
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button size="sm" variant="secondary" onClick={() => onJumpTab("reports")}>
                    {t({ bn: "আমার রিপোর্ট", en: "Reports" })}
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => onJumpTab("calendar")}>
                    {t({ bn: "ফলো-আপ ক্যালেন্ডার", en: "Calendar" })}
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Lead 360 */}
        <aside className="hidden min-w-0 space-y-3 xl:block">
          <div className="card-elevated p-4 xl:sticky xl:top-20">
            <div className="flex items-center justify-between gap-2">
              <DualHeading bnText="লিড ৩৬০" enText="Lead 360" />
              {selected && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2 text-[11px]"
                  onClick={() => setDossierId(selected.id)}
                   aria-label={t({ bn: `${selected.name}-এর পুরো লিড বিস্তারিত খুলুন`, en: `Open full lead details for ${selected.name}` })}
                >
                  {t({ bn: "পুরো ফাইল", en: "Full file" })}
                </Button>
              )}
            </div>
            {selected ? (
              <div className="mt-3 space-y-3">
                <div>
                  <p className="truncate text-base font-bold">{selected.name}</p>
                  <p className="tabular truncate text-xs text-muted-foreground">
                    {selected.phone_number}
                  </p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <span
                    className={cn(
                      "rounded-full border px-2 py-0.5 text-[10px] font-semibold",
                      STATUS_STYLES[selected.status],
                    )}
                  >
                    {statusLabel(selected.status, lang)}
                  </span>
                  {selected.temperature && (
                    <span
                      className={cn(
                        "rounded-full border px-2 py-0.5 text-[10px] font-semibold capitalize",
                        TEMP_STYLES[selected.temperature] ?? "border-border bg-surface-2",
                      )}
                    >
                      {tempLabel(selected.temperature, lang)}
                    </span>
                  )}
                  {selected.grade && (
                    <span className="rounded-full border border-border bg-surface-2 px-2 py-0.5 text-[10px] font-semibold">
                      {t({ bn: `গ্রেড ${selected.grade}`, en: `Grade ${selected.grade}` })}
                    </span>
                  )}
                </div>
                <dl className="grid grid-cols-2 gap-2 text-[11px]">
                  <Field label={t({ bn: "ঠিকানা", en: "Address" })} value={selected.address} />
                  <Field label={t({ bn: "প্রতিষ্ঠান", en: "Company" })} value={selected.company} />
                  <Field label={t({ bn: "রেফারেন্স", en: "Reference" })} value={selected.reference_by} />
                  <Field label={t({ bn: "সোর্স", en: "Source" })} value={selected.source} />
                  <Field
                    label={t({ bn: "শেষ কল", en: "Last call" })}
                    value={selected.last_call_at ? relativeTime(selected.last_call_at) : null}
                  />
                  <Field label={t({ bn: "চেষ্টা", en: "Attempts" })} value={bn(selected.call_attempts, lang)} />
                  <Field
                    label={t({ bn: "পরের যোগাযোগ", en: "Next follow-up" })}
                    value={selected.retry_after ? shortDate(selected.retry_after) : null}
                  />
                  <Field label={t({ bn: "কাজের দিন", en: "Work date" })} value={selected.work_date} />
                </dl>
                <div className="flex items-center gap-2">
                  <WebCallButton
                    leadId={selected.id}
                    phone={selected.phone_number}
                    label={t({ bn: "কল", en: "Call" })}
                    className="h-10 flex-1"
                     ariaLabel={t({ bn: `${selected.name}-কে কল করুন`, en: `Call ${selected.name}` })}
                  />
                  <WhatsAppAction phone={selected.phone_number} leadId={selected.id} label="" ariaLabel={t({ bn: `${selected.name}-কে হোয়াটসঅ্যাপ করুন`, en: `WhatsApp ${selected.name}` })} />
                  <CallbackLogButton leadId={selected.id} label="" ariaLabel={t({ bn: `${selected.name}-এর কলব্যাক রিপোর্ট করুন`, en: `Log callback for ${selected.name}` })} />
                </div>
                {canResolveFollowUp(selected) && (
                  <div className="rounded-xl border border-chart-4/25 bg-chart-4/5 p-2.5">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-chart-4">
                      {t({ bn: "যোগাযোগ হয়েছে — এখন কী করবেন?", en: "Contacted — what's next?" })}
                    </p>
                    <FollowUpResolveActions
                      leadId={selected.id}
                      leadName={selected.name}
                      className="mt-2"
                    />
                    <p className="mt-2 text-[10px] text-muted-foreground">
                      {t({ bn: "সম্পন্ন করলে লিডটি নিজেই কিউ থেকে সরে যাবে।", en: "Once resolved, the lead leaves the queue automatically." })}
                    </p>
                  </div>
                )}
                <div>
                  <p className="text-[11px] font-semibold text-muted-foreground">{t({ bn: "এই লিডের ইতিহাস", en: "History for this lead" })}</p>
                  <ul className="mt-1.5 space-y-1.5">
                    {selectedHistory.map((entry) => (
                      <li key={entry.key} className="flex items-start gap-2 text-[11px]">
                        <span className="mt-1 size-1.5 shrink-0 rounded-full bg-primary/60" />
                        <span className="min-w-0 flex-1 truncate">{entry.title}</span>
                        <span className="shrink-0 text-muted-foreground">{shortDate(entry.at)}</span>
                      </li>
                    ))}
                    {selectedHistory.length === 0 && (
                      <li className="text-[11px] text-muted-foreground">
                        {t({ bn: "এখনো কোনো কল বা মেসেজ নেই।", en: "No calls or messages yet." })}
                      </li>
                    )}
                  </ul>
                </div>
                {selected.notes && (
                  <p className="rounded-lg bg-surface-2 p-2 text-[11px] text-muted-foreground">
                    {selected.notes}
                  </p>
                )}
              </div>
            ) : (
              <p className="mt-3 text-[11px] text-muted-foreground">
                {t({ bn: "কিউ থেকে একটি লিড বেছে নিন", en: "Pick a lead from the queue" })}
              </p>
            )}
          </div>

        </aside>
      </div>

      <Sheet open={mobile360Open} onOpenChange={setMobile360Open}>
        <SheetContent
          side="bottom"
          className="inset-x-0 bottom-0 flex h-[min(88dvh,760px)] w-full max-w-none flex-col gap-0 overflow-hidden rounded-t-xl border-x border-t p-0 xl:hidden"
          aria-describedby="mobile-lead-360-description"
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            mobile360HeadingRef.current?.focus();
          }}
        >
          <SheetHeader className="relative z-10 m-0 shrink-0 border-b border-border bg-background px-4 pb-3 pt-2 text-left">
            <span aria-hidden className="mx-auto mb-1 block h-1 w-10 rounded-full bg-muted-foreground/35" />
            <SheetTitle ref={mobile360HeadingRef} tabIndex={-1} className="pr-10 outline-none focus-visible:ring-2 focus-visible:ring-ring">
              {t({ bn: "লিড ৩৬০", en: "Lead 360" })}{selected ? ` — ${selected.name}` : ""}
            </SheetTitle>
            <p id="mobile-lead-360-description" className="sr-only">
              {t({
                bn: "নির্বাচিত লিডের পরিচিতি, দ্রুত অ্যাকশন এবং সাম্প্রতিক ইতিহাস। Escape চাপলে প্যানেল বন্ধ হবে।",
                en: "Selected lead's profile, quick actions and recent history. Press Escape to close the panel.",
              })}
            </p>
          </SheetHeader>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
            <Lead360Content
              selected={selected}
              selectedHistory={selectedHistory}
              onOpenDossier={(id) => {
                setMobile360Open(false);
                setDossierId(id);
              }}
            />
          </div>
        </SheetContent>
      </Sheet>

      <LeadDossier
        lead={dossierLead}
        agents={profiles}
        timeline={
          dossierLead
            ? buildTimeline(
                calls.filter((c) => c.lead_id === dossierLead.id),
                messages.filter((m) => m.lead_id === dossierLead.id),
                dossierLead.id,
                events,
              )
            : []
        }
        open={dossierId !== null}
        onOpenChange={(next) => !next && setDossierId(null)}
      />
    </section>
  );
}

function Field({
  label,
  value,
}: {
  label: string;
  value?: string | null;
}) {
  return (
    <div className="min-w-0">
      <dt className="truncate text-[10px] uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className="truncate font-medium">{value ?? "—"}</dd>
    </div>
  );
}

function Lead360Content({
  selected,
  selectedHistory,
  onOpenDossier,
}: {
  selected: Lead | null;
  selectedHistory: { key: string; at: string; title: string }[];
  onOpenDossier: (id: string) => void;
}) {
  const t = useT();
  const lang = useLang();

  if (!selected) {
    return <p className="text-sm text-muted-foreground">{t({ bn: "কিউ থেকে একটি লিড বেছে নিন", en: "Pick a lead from the queue" })}</p>;
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
        <div className="min-w-0">
          <p className="truncate text-lg font-bold">{selected.name}</p>
          <p className="tabular truncate text-sm text-muted-foreground">{selected.phone_number}</p>
        </div>
        <Button
          size="sm"
          variant="outline"
          className="shrink-0"
          onClick={() => onOpenDossier(selected.id)}
          aria-label={t({ bn: `${selected.name}-এর পুরো লিড বিস্তারিত খুলুন`, en: `Open full lead details for ${selected.name}` })}
        >
          {t({ bn: "পুরো ফাইল", en: "Full file" })}
        </Button>
      </div>

      <div className="flex flex-wrap gap-1.5">
        <span
          className={cn(
            "rounded-full border px-2 py-0.5 text-[11px] font-semibold",
            STATUS_STYLES[selected.status],
          )}
        >
          {statusLabel(selected.status, lang)}
        </span>
        {selected.temperature && (
          <span
            className={cn(
              "rounded-full border px-2 py-0.5 text-[11px] font-semibold capitalize",
              TEMP_STYLES[selected.temperature] ?? "border-border bg-surface-2",
            )}
          >
            {tempLabel(selected.temperature, lang)}
          </span>
        )}
        {selected.grade && (
          <span className="rounded-full border border-border bg-surface-2 px-2 py-0.5 text-[11px] font-semibold">
            {t({ bn: `গ্রেড ${selected.grade}`, en: `Grade ${selected.grade}` })}
          </span>
        )}
      </div>

      <dl className="grid grid-cols-2 gap-x-3 gap-y-4 text-xs">
        <Field label={t({ bn: "ঠিকানা", en: "Address" })} value={selected.address} />
        <Field label={t({ bn: "প্রতিষ্ঠান", en: "Company" })} value={selected.company} />
        <Field label={t({ bn: "রেফারেন্স", en: "Reference" })} value={selected.reference_by} />
        <Field label={t({ bn: "সোর্স", en: "Source" })} value={selected.source} />
        <Field label={t({ bn: "শেষ কল", en: "Last call" })} value={selected.last_call_at ? relativeTime(selected.last_call_at) : null} />
        <Field label={t({ bn: "চেষ্টা", en: "Attempts" })} value={bn(selected.call_attempts, lang)} />
        <Field label={t({ bn: "পরের যোগাযোগ", en: "Next follow-up" })} value={selected.retry_after ? shortDate(selected.retry_after) : null} />
        <Field label={t({ bn: "কাজের দিন", en: "Work date" })} value={selected.work_date} />
      </dl>

      <div className="sticky bottom-0 z-10 grid grid-cols-[minmax(0,1fr)_auto_auto] gap-2 border-y border-border bg-background py-3">
        <WebCallButton
          leadId={selected.id}
          phone={selected.phone_number}
          label={t({ bn: "কল", en: "Call" })}
          className="h-11 min-w-0"
          ariaLabel={t({ bn: `${selected.name}-কে কল করুন`, en: `Call ${selected.name}` })}
        />
        <WhatsAppAction phone={selected.phone_number} leadId={selected.id} label="" ariaLabel={t({ bn: `${selected.name}-কে হোয়াটসঅ্যাপ করুন`, en: `WhatsApp ${selected.name}` })} />
        <CallbackLogButton leadId={selected.id} label="" ariaLabel={t({ bn: `${selected.name}-এর কলব্যাক রিপোর্ট করুন`, en: `Log callback for ${selected.name}` })} />
      </div>

      {canResolveFollowUp(selected) && (
        <div className="rounded-xl border border-chart-4/25 bg-chart-4/5 p-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-chart-4">
            {t({ bn: "যোগাযোগ হয়েছে — এখন কী করবেন?", en: "Contacted — what's next?" })}
          </p>
          <FollowUpResolveActions
            leadId={selected.id}
            leadName={selected.name}
            className="mt-2"
          />
          <p className="mt-2 text-[11px] text-muted-foreground">
            {t({ bn: "সম্পন্ন করলে লিডটি নিজেই কিউ থেকে সরে যাবে।", en: "Once resolved, the lead leaves the queue automatically." })}
          </p>
        </div>
      )}

      <div>
        <p className="text-xs font-semibold text-muted-foreground">{t({ bn: "এই লিডের ইতিহাস", en: "History for this lead" })}</p>
        <ul className="mt-2 space-y-2">
          {selectedHistory.map((entry) => (
            <li key={entry.key} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-2 text-xs">
              <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary/60" />
              <span className="min-w-0">{entry.title}</span>
              <span className="shrink-0 text-muted-foreground">{shortDate(entry.at)}</span>
            </li>
          ))}
          {selectedHistory.length === 0 && (
            <li className="text-xs text-muted-foreground">{t({ bn: "এখনো কোনো কল বা মেসেজ নেই।", en: "No calls or messages yet." })}</li>
          )}
        </ul>
      </div>

      {selected.notes && (
        <p className="rounded-lg bg-surface-2 p-3 text-xs text-muted-foreground">{selected.notes}</p>
      )}
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-surface-2 p-2">
      <p className="truncate text-[10px] text-muted-foreground">{label}</p>
      <p className="tabular text-sm font-bold">{value}</p>
    </div>
  );
}

function Meter({ label, value, total }: { label: string; value: number; total: number }) {
  const lang = useLang();
  const pct = total ? Math.round((value / total) * 100) : 0;
  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <span className="block truncate text-muted-foreground">{label}</span>
        <span className="tabular shrink-0 font-semibold">
          {bn(value, lang)} / {bn(total, lang)} · {bn(pct, lang)}%
        </span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
