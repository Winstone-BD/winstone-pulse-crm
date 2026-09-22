import { Link } from "@tanstack/react-router";
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
import { useMemo, useState } from "react";

import { CallbackLogButton } from "@/components/crm/CallbackLogButton";
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
import { useIsMobile } from "@/hooks/use-mobile";
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

const STATUS_LABELS: Record<string, string> = {
  pending: "কল হয়নি",
  contacted: "কথা হয়েছে",
  follow_up: "আবার যোগাযোগ",
  closed: "শেষ হয়েছে",
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

type QueueFilter = "pending" | "follow_up" | "hot" | "done" | "all";
type QueueSort = "priority" | "recent" | "name" | "serial";

const QUEUE_LABELS: Record<QueueFilter, string> = {
  pending: "কল বাকি",
  follow_up: "আবার যোগাযোগ",
  hot: "হট",
  done: "কথা হয়েছে",
  all: "সব",
};

const SORT_LABELS: Record<QueueSort, string> = {
  priority: "অগ্রাধিকার আগে",
  recent: "সাম্প্রতিক আগে",
  name: "নাম অনুযায়ী",
  serial: "সিরিয়াল অনুযায়ী",
};

function bn(n: number) {
  return n.toLocaleString("bn-BD");
}

function KpiCard({
  icon,
  label,
  value,
  sub,
  tone = "primary",
  progress,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  tone?: "primary" | "live" | "chart4" | "destructive";
  progress?: number;
}) {
  const toneClass = {
    primary: "bg-primary/12 text-primary",
    live: "bg-live/15 text-live",
    chart4: "bg-chart-4/15 text-chart-4",
    destructive: "bg-destructive/15 text-destructive",
  }[tone];
  return (
    <div className="card-elevated relative overflow-hidden p-3">
      <div className="flex items-center gap-2">
        <span className={cn("grid size-8 shrink-0 place-items-center rounded-xl", toneClass)}>
          {icon}
        </span>
        <p className="min-w-0 truncate text-[11px] font-medium text-muted-foreground">{label}</p>
      </div>
      <p className="tabular mt-2 text-xl font-bold leading-none">{value}</p>
      {sub && <p className="mt-1 text-[10px] text-muted-foreground">{sub}</p>}
      {progress !== undefined && (
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
          />
        </div>
      )}
    </div>
  );
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
  const { leads, profiles, calls, messages, events } = useSnapshot();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dossierId, setDossierId] = useState<string | null>(null);
  const [filter, setFilter] = useState<QueueFilter>("pending");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<QueueSort>("priority");
  const [mobile360Open, setMobile360Open] = useState(false);
  const isMobile = useIsMobile();

  const stats = useMemo(() => {
    const now = Date.now();
    const today = new Date().toDateString();
    const onToday = <T extends { created_at: string }>(rows: T[]) =>
      rows.filter((r) => new Date(r.created_at).toDateString() === today);

    const todayCalls = onToday(calls);
    const connected = todayCalls.filter(
      (c) => c.duration_seconds > CONNECTED_THRESHOLD_SECONDS,
    ).length;
    const followUps = leads.filter((l) => l.status === "follow_up");
    const overdue = followUps.filter((l) => l.retry_after && Date.parse(l.retry_after) < now);
    const dueToday = followUps.filter(
      (l) => l.retry_after && new Date(l.retry_after).toDateString() === today,
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
        if (filter === "pending") return l.status === "pending";
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
            ? `কল হয়েছে · ${formatTalkTime(c.duration_seconds)}`
            : "কল ধরা হয়নি",
        icon: <PhoneCall className="size-3.5" />,
      })),
      ...messages.map((m) => ({
        id: `m-${m.id}`,
        at: m.created_at,
        title: "হোয়াটসঅ্যাপ মেসেজ",
        icon: <MessageCircle className="size-3.5" />,
      })),
      ...leads.map((l) => ({
        id: `l-${l.id}`,
        at: l.created_at,
        title: `লিড যোগ · ${l.name}`,
        icon: <UserPlus className="size-3.5" />,
      })),
    ];
    return rowsAll
      .sort((a, b) => Date.parse(b.at) - Date.parse(a.at))
      .slice(0, 8)
      .map((r) => ({
        ...r,
        when: new Date(r.at).toLocaleTimeString("bn-BD", { hour: "2-digit", minute: "2-digit" }),
      }));
  }, [calls, leads, messages]);

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
                ? `কল · ${formatTalkTime(entry.call.duration_seconds)}`
                : "কল ধরা হয়নি"
              : entry.kind === "message"
                ? "হোয়াটসঅ্যাপ মেসেজ"
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
    if (isMobile) setMobile360Open(true);
  };

  return (
    <section className="space-y-3">
      {/* Agent / status bar */}
      <div className="card-elevated grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 p-4 sm:flex sm:flex-wrap sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-primary/12 text-sm font-bold text-primary">
            {(account?.profile?.name ?? "এ").slice(0, 2)}
          </span>
          <div className="min-w-0">
            <p className="truncate text-base font-bold tracking-tight sm:text-lg">
              {account?.profile?.name ?? "এজেন্ট"}
            </p>
            <p className="truncate text-[11px] text-muted-foreground">
              {account?.profile?.employee_id ?? "এজেন্ট"} ·{" "}
              {new Date().toLocaleDateString("bn-BD", {
                weekday: "long",
                day: "numeric",
                month: "long",
              })}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-live/30 bg-live/10 px-2.5 py-1 text-[11px] font-semibold text-live">
            <span className="size-1.5 rounded-full bg-live" /> ডেস্ক চালু
          </span>
          {stats.overdue > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full border border-destructive/30 bg-destructive/10 px-2.5 py-1 text-[11px] font-semibold text-destructive">
              <AlarmClock className="size-3" /> {bn(stats.overdue)}টি সময় পেরিয়েছে
            </span>
          )}
          {actions}
        </div>
      </div>

      {/* KPI strip — every figure from the agent's own snapshot */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <KpiCard
          icon={<Users className="size-4" />}
          label="আমার লিড"
          value={bn(stats.total)}
          sub={`${bn(stats.pending)}টি কল বাকি`}
          progress={stats.donePct}
        />
        <KpiCard
          icon={<PhoneOutgoing className="size-4" />}
          label="আজকের কল"
          value={bn(stats.calls)}
          sub={`${bn(stats.connected)}টিতে কথা · ${bn(stats.connectRate)}%`}
          tone="live"
          progress={stats.connectRate}
        />
        <KpiCard
          icon={<Timer className="size-4" />}
          label="আজকের কথার সময়"
          value={formatTalkTime(stats.talk)}
          sub={`${bn(stats.whatsapp)}টি হোয়াটসঅ্যাপ আজ`}
        />
        <KpiCard
          icon={<CalendarClock className="size-4" />}
          label="ফলো-আপ"
          value={bn(stats.followUp)}
          sub={`আজ ${bn(stats.dueToday)}টি · সময় পেরিয়েছে ${bn(stats.overdue)}টি`}
          tone="chart4"
        />
        <KpiCard
          icon={<Flame className="size-4" />}
          label="হট লিড"
          value={bn(stats.hot)}
          sub={`${bn(stats.uncalled)}টিতে এখনো কল হয়নি`}
          tone="destructive"
        />
        <KpiCard
          icon={<CheckCircle2 className="size-4" />}
          label="শেষ হয়েছে"
          value={`${bn(stats.done)} / ${bn(stats.total)}`}
          sub={`${bn(stats.donePct)}% কাজ শেষ`}
          tone="live"
          progress={stats.donePct}
        />
      </div>

      <div className="grid min-w-0 gap-3 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-3">
          {/* Lead queue */}
          <div className="card-elevated p-3 sm:p-4">
            <div className="grid min-w-0 gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
              <div className="min-w-0">
                <h3 className="truncate text-sm font-semibold">আমার লিড কিউ</h3>
                <p className="text-[11px] text-muted-foreground">
                  {bn(rows.length)}টি দেখা যাচ্ছে · লিড বেছে নিলে ৩৬০ খুলবে
                </p>
              </div>
              <div className="relative min-w-0 sm:w-64">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="নাম বা নম্বর"
                  className="h-10 pl-9 pr-9"
                />
                {search && (
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="absolute right-1 top-1/2 size-8 -translate-y-1/2"
                    onClick={() => setSearch("")}
                    aria-label="সার্চ মুছুন"
                  >
                    <X className="size-3.5" />
                  </Button>
                )}
              </div>
            </div>

            <div className="mt-3 grid min-w-0 gap-2 sm:grid-cols-[minmax(0,1fr)_190px]">
              <div className="flex min-w-0 gap-1.5 overflow-x-auto pb-1">
                {(Object.keys(QUEUE_LABELS) as QueueFilter[]).map((key) => (
                  <Button
                    key={key}
                    type="button"
                    size="sm"
                    variant={filter === key ? "default" : "outline"}
                    onClick={() => setFilter(key)}
                    className="h-9 shrink-0 rounded-full px-3 text-[11px]"
                  >
                    {QUEUE_LABELS[key]}
                  </Button>
                ))}
              </div>
              <Select value={sort} onValueChange={(value) => setSort(value as QueueSort)}>
                <SelectTrigger className="h-9 w-full" aria-label="লিড সাজান">
                  <SlidersHorizontal className="size-3.5 shrink-0 text-muted-foreground" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(SORT_LABELS) as QueueSort[]).map((key) => (
                    <SelectItem key={key} value={key}>{SORT_LABELS[key]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="mt-2 flex min-w-0 items-center gap-2 overflow-x-auto rounded-lg border border-border/70 bg-surface-2/60 px-2.5 py-2 text-[11px]">
              <SlidersHorizontal className="size-3.5 shrink-0 text-primary" />
              <span className="shrink-0 text-muted-foreground">সক্রিয়:</span>
              <span className="shrink-0 rounded-full bg-primary/12 px-2 py-0.5 font-semibold text-primary">
                {QUEUE_LABELS[filter]}
              </span>
              {search.trim() && (
                <span className="max-w-40 shrink-0 truncate rounded-full bg-accent px-2 py-0.5 font-semibold text-accent-foreground">
                  খোঁজ: {search.trim()}
                </span>
              )}
              <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-muted-foreground">
                {SORT_LABELS[sort]}
              </span>
              <span className="tabular ml-auto shrink-0 text-muted-foreground">{bn(rows.length)} ফল</span>
              {hasQueueState && (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-7 shrink-0 gap-1 px-2 text-[11px]"
                  onClick={resetQueue}
                >
                  <RotateCcw className="size-3" /> রিসেট
                </Button>
              )}
            </div>

            <div className="mt-3 max-h-[520px] overflow-y-auto">
              <ul className="space-y-2">
                {rows.map((lead) => {
                  const overdue = lead.retry_after ? Date.parse(lead.retry_after) < Date.now() : false;
                  return (
                    <li
                      key={lead.id}
                      className={cn(
                        "rounded-xl border p-2.5 transition-colors",
                        selected?.id === lead.id
                          ? "border-primary/40 bg-primary/5"
                          : "border-border/70 bg-surface-2/40 hover:bg-surface-2",
                      )}
                    >
                      <button
                        type="button"
                         onClick={() => selectLead(lead.id)}
                        className="block w-full min-w-0 text-left"
                      >
                        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold">{lead.name}</p>
                            <p className="tabular truncate text-[11px] text-muted-foreground">
                              {lead.phone_number}
                              {lead.address ? ` · ${lead.address}` : ""}
                            </p>
                          </div>
                          <span className="tabular shrink-0 text-[10px] text-muted-foreground">
                            #{lead.serial_no ?? "—"}
                          </span>
                        </div>
                        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                          <span
                            className={cn(
                              "rounded-full border px-2 py-0.5 text-[10px] font-semibold",
                              STATUS_STYLES[lead.status],
                            )}
                          >
                            {STATUS_LABELS[lead.status] ?? lead.status}
                          </span>
                          {lead.temperature && (
                            <span
                              className={cn(
                                "rounded-full border px-2 py-0.5 text-[10px] font-semibold capitalize",
                                TEMP_STYLES[lead.temperature] ?? "border-border bg-surface-2",
                              )}
                            >
                              {lead.temperature}
                            </span>
                          )}
                          {overdue && (
                            <span className="rounded-full border border-destructive/30 bg-destructive/10 px-2 py-0.5 text-[10px] font-semibold text-destructive">
                              সময় পেরিয়েছে
                            </span>
                          )}
                          <span className="tabular ml-auto text-[10px] text-muted-foreground">
                            {lead.last_call_at
                              ? relativeTime(lead.last_call_at)
                              : `${bn(lead.call_attempts)} বার চেষ্টা`}
                          </span>
                        </div>
                      </button>
                      <div className="mt-2 grid grid-cols-[minmax(0,1fr)_auto_auto_auto] items-center gap-2">
                        <WebCallButton
                          leadId={lead.id}
                          phone={lead.phone_number}
                          label="কল"
                          className="h-9 min-w-0 text-sm"
                        />
                        <WhatsAppAction phone={lead.phone_number} leadId={lead.id} label="" />
                        <CallbackLogButton leadId={lead.id} label="" />
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-9 px-2 text-[11px]"
                          onClick={() => setDossierId(lead.id)}
                        >
                          বিস্তারিত
                        </Button>
                      </div>
                    </li>
                  );
                })}
                {rows.length === 0 && (
                  <li className="rounded-xl border border-dashed border-border p-8 text-center text-xs text-muted-foreground">
                    এই তালিকায় এখন কোনো লিড নেই
                  </li>
                )}
              </ul>
            </div>
          </div>

          {/* Priority + performance */}
          <div className="grid gap-3 lg:grid-cols-2">
            <div className="card-elevated p-4">
              <h3 className="flex items-center gap-2 text-sm font-semibold">
                <Flame className="size-4 text-destructive" /> অগ্রাধিকার তালিকা
              </h3>
              <ul className="mt-3 space-y-2">
                {priority.map(({ lead, overdue }) => (
                  <li key={lead.id}>
                    <button
                      type="button"
                       onClick={() => selectLead(lead.id)}
                      className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-lg px-1 py-1 text-left hover:bg-surface-2"
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
                        {overdue ? "সময় পেরিয়েছে" : (lead.temperature ?? lead.status)}
                      </span>
                    </button>
                  </li>
                ))}
                {priority.length === 0 && (
                  <li className="text-[11px] text-muted-foreground">
                    এখন কোনো হট লিড বা বাকি ফলো-আপ নেই।
                  </li>
                )}
              </ul>
            </div>

            <div className="card-elevated p-4">
              <h3 className="flex items-center gap-2 text-sm font-semibold">
                <TrendingUp className="size-4 text-primary" /> আমার পারফরম্যান্স (আজ)
              </h3>
              <dl className="mt-3 space-y-2.5 text-xs">
                <Meter label="লিড শেষ" value={stats.done} total={stats.total} />
                <Meter label="কথা হয়েছে" value={stats.connected} total={stats.calls} />
                <Meter
                  label="ফলো-আপ সময়মতো"
                  value={Math.max(stats.followUp - stats.overdue, 0)}
                  total={stats.followUp}
                />
              </dl>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <MiniStat label="আজ যোগ হওয়া লিড" value={bn(stats.newToday)} />
                <MiniStat label="কথার সময়" value={formatTalkTime(stats.talk)} />
              </div>
              {onJumpTab && (
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button size="sm" variant="secondary" onClick={() => onJumpTab("reports")}>
                    আমার রিপোর্ট
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => onJumpTab("calendar")}>
                    ফলো-আপ ক্যালেন্ডার
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
              <h3 className="text-sm font-semibold">লিড ৩৬০</h3>
              {selected && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2 text-[11px]"
                  onClick={() => setDossierId(selected.id)}
                >
                  পুরো ফাইল
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
                    {STATUS_LABELS[selected.status] ?? selected.status}
                  </span>
                  {selected.temperature && (
                    <span
                      className={cn(
                        "rounded-full border px-2 py-0.5 text-[10px] font-semibold capitalize",
                        TEMP_STYLES[selected.temperature] ?? "border-border bg-surface-2",
                      )}
                    >
                      {selected.temperature}
                    </span>
                  )}
                  {selected.grade && (
                    <span className="rounded-full border border-border bg-surface-2 px-2 py-0.5 text-[10px] font-semibold">
                      গ্রেড {selected.grade}
                    </span>
                  )}
                </div>
                <dl className="grid grid-cols-2 gap-2 text-[11px]">
                  <Field label="ঠিকানা" value={selected.address} />
                  <Field label="প্রতিষ্ঠান" value={selected.company} />
                  <Field label="রেফারেন্স" value={selected.reference_by} />
                  <Field label="সোর্স" value={selected.source} />
                  <Field
                    label="শেষ কল"
                    value={selected.last_call_at ? relativeTime(selected.last_call_at) : null}
                  />
                  <Field label="চেষ্টা" value={bn(selected.call_attempts)} />
                  <Field
                    label="পরের যোগাযোগ"
                    value={selected.retry_after ? shortDate(selected.retry_after) : null}
                  />
                  <Field label="কাজের দিন" value={selected.work_date} />
                </dl>
                <div className="flex items-center gap-2">
                  <WebCallButton
                    leadId={selected.id}
                    phone={selected.phone_number}
                    label="কল"
                    className="h-10 flex-1"
                  />
                  <WhatsAppAction phone={selected.phone_number} leadId={selected.id} label="" />
                  <CallbackLogButton leadId={selected.id} label="" />
                </div>
                <div>
                  <p className="text-[11px] font-semibold text-muted-foreground">এই লিডের ইতিহাস</p>
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
                        এখনো কোনো কল বা মেসেজ নেই।
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
                কিউ থেকে একটি লিড বেছে নিন।
              </p>
            )}
          </div>

          <div className="card-elevated p-4">
            <h3 className="text-sm font-semibold">আমার সাম্প্রতিক কাজ</h3>
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
              {activity.length === 0 && (
                <li className="text-[11px] text-muted-foreground">আজ এখনো কোনো কাজ নেই।</li>
              )}
            </ul>
            <Button asChild size="sm" variant="secondary" className="mt-3 w-full">
              <Link to="/reports">রিপোর্ট পাতা</Link>
            </Button>
          </div>
        </aside>
      </div>

      <Sheet open={mobile360Open} onOpenChange={setMobile360Open}>
        <SheetContent
          side="bottom"
          className="inset-x-0 bottom-0 h-[88dvh] w-full max-w-none gap-0 overflow-y-auto rounded-t-xl border-x border-t p-0 xl:hidden"
        >
          <SheetHeader className="sticky top-0 z-10 m-0 border-b border-border bg-background px-4 py-3 text-left">
            <SheetTitle>লিড ৩৬০</SheetTitle>
          </SheetHeader>
          <div className="p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
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

function Field({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="min-w-0">
      <dt className="truncate text-[10px] uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className="truncate font-medium">{value ?? "—"}</dd>
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
  const pct = total ? Math.round((value / total) * 100) : 0;
  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <dt className="truncate text-muted-foreground">{label}</dt>
        <dd className="tabular shrink-0 font-semibold">
          {bn(value)} / {bn(total)} · {bn(pct)}%
        </dd>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
