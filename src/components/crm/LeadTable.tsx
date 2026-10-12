import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, ChevronDown, MapPin, Search, X } from "lucide-react";
import { useT, useLang } from "@/lib/i18n";

import { CallbackLogButton } from "@/components/crm/CallbackLogButton";
import { LeadDossier } from "@/components/crm/LeadDossier";
import {
  LeadQuickFilter,
  matchesCategory,
  matchesPeriod,
  type LeadCategory,
  type LeadPeriod,
} from "@/components/crm/LeadQuickFilter";
import { SnapshotSkeleton } from "@/components/crm/SnapshotSkeleton";
import { ErrorState, LeadStatusBadge } from "@/components/crm/DataState";
import { WhatsAppAction } from "@/components/crm/WhatsAppAction";
import { WebCallButton } from "@/components/crm/WebCallButton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { buildTimeline, useSnapshot } from "@/lib/crm-data";
import { DeskRangeChip, useDeskRange } from "@/lib/desk-range";
import { relativeTime, shortDate } from "@/lib/crm-format";
import { cn } from "@/lib/utils";
import { myLeadExtras } from "@/lib/call-reports.functions";
import { useAdminToken } from "@/lib/local-session";
import {
  DESK_BUCKET_LABEL,
  DESK_BUCKET_LABEL_EN,
  GROUP_LABEL,
  GROUP_LABEL_EN,
  followUpState,
  groupLeads,
  inBucket,
  matchesSearch,
  type DeskBucket,
  type DeskExtras,
  type GroupKey,
} from "@/lib/lead-groups";

function FollowUpCell({ at }: { at: string | null }) {
  const lang = useLang();
  const state = followUpState(at);
  if (state === "none") return <span className="text-muted-foreground">—</span>;
  const when = new Date(at!).toLocaleString(lang === "en" ? "en-GB" : "bn-BD", {
    timeZone: "Asia/Dhaka",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold",
        state === "overdue"
          ? "border-destructive/30 bg-destructive/10 text-destructive"
          : state === "due_today"
            ? "border-warning/30 bg-warning/10 text-warning"
            : "border-border bg-surface-2 text-foreground",
      )}
    >
      {state === "overdue" ? "OVERDUE · " : ""}
      {when}
    </span>
  );
}

type Filter = "pending" | "follow_up" | "done" | "all";

const FILTER_LABELS: Record<Filter, { bn: string; en: string }> = {
  pending: { bn: "কল বাকি", en: "Pending calls" },
  follow_up: { bn: "আবার যোগাযোগ", en: "Follow-up" },
  done: { bn: "কথা হয়েছে", en: "Contacted" },
  all: { bn: "সব লিড", en: "All leads" },
};

const STATUS_LABELS: Record<string, { bn: string; en: string }> = {
  pending: { bn: "কল হয়নি", en: "Not called" },
  contacted: { bn: "কথা হয়েছে", en: "Contacted" },
  follow_up: { bn: "আবার যোগাযোগ", en: "Follow-up" },
  closed: { bn: "শেষ হয়েছে", en: "Closed" },
};

const TEMP_STYLES: Record<string, string> = {
  hot: "border-destructive/30 bg-destructive/10 text-destructive",
  warm: "border-chart-4/30 bg-chart-4/10 text-chart-4",
  cold: "border-primary/25 bg-primary/10 text-primary",
};

const STATUS_STYLES: Record<string, string> = {
  pending: "border-idle/30 bg-idle/15 text-idle-foreground",
  contacted: "border-primary/25 bg-accent text-accent-foreground",
  follow_up: "border-chart-4/30 bg-chart-4/10 text-chart-4",
  closed: "border-live/30 bg-live/10 text-live",
};

/**
 * The agent's lead dashboard: one row per lead with serial, name, address,
 * number and who referred it, and a Call button right beside it. A lead only
 * leaves the "কল বাকি" list once a call report says the talk actually happened,
 * so end-of-day it is obvious who still has to be contacted again.
 */
export function LeadTable() {
  const t = useT();
  const lang = useLang();
  const snap = useSnapshot();
  const range = useDeskRange();
  // Date range from the Command Center: leads added within the range.
  const leads = useMemo(() => snap.leads.filter((l) => range.inRange(l.created_at)), [snap.leads, range.from, range.to]);
  const { profiles, calls, messages, events, isPending, isError, refetch } = snap;
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("pending");
  const [openLeadId, setOpenLeadId] = useState<string | null>(null);
  const [period, setPeriod] = useState<LeadPeriod>("all");
  const [category, setCategory] = useState<LeadCategory>("all");
  const [bucket, setBucket] = useState<DeskBucket>("all");
  const [groupBy, setGroupBy] = useState<GroupKey>("none");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const adminToken = useAdminToken();
  const fetchExtras = useServerFn(myLeadExtras);
  const extrasQuery = useQuery({
    queryKey: ["lead-extras", adminToken ? "pin" : "session"],
    queryFn: () => fetchExtras({ data: { adminToken } }),
    refetchInterval: 60_000,
  });
  const extras = useMemo(
    () =>
      new Map<string, DeskExtras>(
        (extrasQuery.data ?? []).map((e) => [
          e.leadId,
          { requirement: e.requirement, nextFollowUpAt: e.nextFollowUpAt },
        ]),
      ),
    [extrasQuery.data],
  );

  // The quick filter narrows the pool first; the status tabs then count within it.
  const scoped = useMemo(
    () => leads.filter((lead) => matchesPeriod(lead, period) && matchesCategory(lead, category)),
    [leads, period, category],
  );

  const counts = useMemo(
    () => ({
      pending: scoped.filter((l) => l.status === "pending").length,
      follow_up: scoped.filter((l) => l.status === "follow_up").length,
      done: scoped.filter((l) => l.status === "contacted" || l.status === "closed").length,
      all: scoped.length,
    }),
    [scoped],
  );

  const bucketCounts = useMemo(() => {
    const out = {} as Record<DeskBucket, number>;
    for (const key of Object.keys(DESK_BUCKET_LABEL) as DeskBucket[])
      out[key] = scoped.filter((l) => inBucket(l, extras.get(l.id), key)).length;
    return out;
  }, [scoped, extras]);

  const rows = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return scoped
      .filter((lead) => inBucket(lead, extras.get(lead.id), bucket))
      .filter((lead) => {
        if (filter === "pending") return lead.status === "pending";
        if (filter === "follow_up") return lead.status === "follow_up";
        if (filter === "done") return lead.status === "contacted" || lead.status === "closed";
        return true;
      })
      .filter(
        (lead) =>
          !needle ||
          matchesSearch(lead, needle) ||
          (lead.address ?? "").toLowerCase().includes(needle) ||
          (lead.serial_no ?? "").toLowerCase().includes(needle),
      )
      .sort((a, b) =>
        (a.serial_no ?? "").localeCompare(b.serial_no ?? "", "bn", { numeric: true }),
      );
  }, [scoped, filter, search, bucket, extras]);

  const groups = useMemo(() => groupLeads(rows, extras, groupBy, Date.now(), lang), [rows, extras, groupBy, lang]);
  const toggleGroup = (key: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  const filtersActive = bucket !== "all" || search.trim() !== "" || period !== "all" || category !== "all";

  const openLead = leads.find((l) => l.id === openLeadId) ?? null;

  if (isPending) return <div aria-busy="true" aria-label={t({ bn: "লিড লোড হচ্ছে", en: "Loading leads" })}><SnapshotSkeleton /></div>;
  if (isError) return <ErrorState onRetry={refetch} />;

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold tracking-tight">{t({ bn: "লিড ড্যাশবোর্ড", en: "Lead dashboard" })}</h2>
          <DeskRangeChip />
          <p className="text-xs text-muted-foreground sm:text-sm">
            {t({
              bn: `আজ ${counts.pending}টি লিডে কল বাকি · ${counts.follow_up}টিতে আবার যোগাযোগ করতে হবে · ${counts.done}টিতে কথা হয়ে গেছে`,
              en: `${counts.pending} leads pending calls today · ${counts.follow_up} need follow-up · ${counts.done} already contacted`,
            })}
          </p>
        </div>
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t({ bn: "নাম, নম্বর, রেফারেন্স, কোম্পানি", en: "Name, number, reference, company" })}
            className="pl-9"
          />
        </div>
      </div>

      <LeadQuickFilter
        leads={leads}
        period={period}
        category={category}
        onPeriodChange={setPeriod}
        onCategoryChange={(next) => {
          setCategory(next);
          // Show every matching lead, not just the ones still awaiting a call.
          if (next !== "all") setFilter("all");
        }}
        onClear={() => {
          setPeriod("all");
          setCategory("all");
        }}
      />

      <Tabs value={filter} onValueChange={(v) => setFilter(v as Filter)}>
        <TabsList className="flex w-full flex-wrap">
          {(Object.keys(FILTER_LABELS) as Filter[]).map((key) => (
            <TabsTrigger key={key} value={key}>
              {t(FILTER_LABELS[key])} ({counts[key]})
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label={t({ bn: "দ্রুত ভাগ", en: "Quick buckets" })}>
        {(Object.keys(DESK_BUCKET_LABEL) as DeskBucket[]).map((key) => (
          <button
            key={key}
            type="button"
            aria-pressed={bucket === key}
            onClick={() => setBucket(key)}
            className={cn(
              "min-h-9 rounded-full border px-3 text-xs font-semibold transition-colors",
              bucket === key
                ? key === "overdue"
                  ? "border-destructive bg-destructive text-destructive-foreground"
                  : "border-foreground bg-foreground text-background"
                : "border-border bg-card text-foreground hover:bg-surface-2",
            )}
          >
            {lang === "en" ? DESK_BUCKET_LABEL_EN[key] : DESK_BUCKET_LABEL[key]} ({bucketCounts[key]})
          </button>
        ))}
        <label className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground">
          {t({ bn: "গ্রুপ:", en: "Group:" })}
          <select
            value={groupBy}
            onChange={(e) => setGroupBy(e.target.value as GroupKey)}
            className="h-9 rounded-md border border-border bg-card px-2 text-xs text-foreground"
          >
            {(Object.keys(GROUP_LABEL) as GroupKey[]).map((key) => (
              <option key={key} value={key}>
                {lang === "en" ? GROUP_LABEL_EN[key] : GROUP_LABEL[key]}
              </option>
            ))}
          </select>
        </label>
      </div>
      <p className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span className="font-semibold text-foreground">{t({ bn: `${rows.length}টি লিড`, en: `${rows.length} leads` })}</span>
        <span>{t({ bn: "· সব ফিল্টার একসাথে (AND) প্রযোজ্য", en: "· All filters apply together (AND)" })}</span>
        {filtersActive && (
          <button
            type="button"
            className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-foreground hover:bg-surface-2"
            onClick={() => {
              setBucket("all");
              setSearch("");
              setPeriod("all");
              setCategory("all");
              setFilter("all");
            }}
          >
            <X className="size-3" /> {t({ bn: "সব ফিল্টার মুছুন", en: "Clear all filters" })}
          </button>
        )}
      </p>

      {groups.map((group) => {
        const isOpen = !collapsed.has(group.key);
        return (
          <div key={group.key} className="space-y-2">
            {groupBy !== "none" && (
              <button
                type="button"
                onClick={() => toggleGroup(group.key)}
                aria-expanded={isOpen}
                className="flex w-full items-center justify-between rounded-lg border border-border bg-surface-2 px-3 py-2 text-left text-sm font-semibold"
              >
                <span className="truncate">{group.key}</span>
                <span className="flex items-center gap-2 text-xs text-muted-foreground">
                  {t({ bn: `${group.items.length}টি`, en: `${group.items.length}` })} · Hot {group.items.filter((l) => l.temperature === "hot").length}
                  <ChevronDown className={cn("size-4 transition-transform", isOpen && "rotate-180")} />
                </span>
              </button>
            )}
            {isOpen && (
              <LeadRows
                rows={group.items}
                extras={extras}
                onOpen={setOpenLeadId}
              />
            )}
          </div>
        );
      })}
      {rows.length === 0 && (
        <p role="status" className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          {t({ bn: "এই ফিল্টারে কোনো লিড নেই", en: "No leads match this filter" })}
        </p>
      )}

      <LeadDossier
        lead={openLead}
        agents={profiles}
        timeline={openLead ? buildTimeline(calls, messages, openLead.id, events) : []}
        open={openLeadId !== null}
        onOpenChange={(next) => !next && setOpenLeadId(null)}
      />
    </section>
  );
}

type Row = ReturnType<typeof useSnapshot>["leads"][number];

function LeadRows({
  rows,
  extras,
  onOpen,
}: {
  rows: Row[];
  extras: Map<string, DeskExtras>;
  onOpen: (id: string) => void;
}) {
  const t = useT();
  const setOpenLeadId = onOpen;
  return (
    <>
      {/* Mobile: cards, no horizontal scrolling. Same rows, same data. */}
      <ul className="space-y-3 md:hidden">
        {rows.map((lead, index) => (
          <li key={lead.id} className="card-elevated w-full max-w-full overflow-hidden p-3">
            <button
              type="button"
              className="block w-full min-w-0 text-left"
              onClick={() => setOpenLeadId(lead.id)}
            >
              <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2">
                <div className="min-w-0">
                  <p className="truncate text-base font-semibold">{lead.name}</p>
                  <p className="tabular truncate text-sm text-muted-foreground">
                    {lead.phone_number}
                  </p>
                </div>
                <span className="tabular shrink-0 text-[11px] text-muted-foreground">
                  #{lead.serial_no ?? index + 1}
                </span>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                {lead.temperature && (
                  <span
                    className={cn(
                      "rounded-full border px-2 py-0.5 text-[11px] font-semibold capitalize",
                      TEMP_STYLES[lead.temperature] ?? "border-border bg-surface-2",
                    )}
                  >
                    {lead.temperature}
                  </span>
                )}
                {lead.grade && (
                  <span className="rounded-full border border-border bg-surface-2 px-2 py-0.5 text-[11px] font-semibold">
                    {t({ bn: "গ্রেড", en: "Grade" })} {lead.grade}
                  </span>
                )}
                <LeadStatusBadge status={lead.status} />
                <span className="tabular ml-auto text-[11px] text-muted-foreground">
                  {shortDate(lead.classified_at ?? lead.last_call_at ?? lead.created_at)}
                </span>
              </div>
              <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                <dt className="text-muted-foreground">{t({ bn: "রেফারেন্স", en: "Reference" })}</dt>
                <dd className="truncate text-right">{lead.reference_by ?? "—"}</dd>
                <dt className="text-muted-foreground">{t({ bn: "চাহিদা", en: "Requirement" })}</dt>
                <dd className="truncate text-right">{extras.get(lead.id)?.requirement ?? "—"}</dd>
                <dt className="text-muted-foreground">{t({ bn: "পরের ফলো-আপ", en: "Next follow-up" })}</dt>
                <dd className="text-right">
                  <FollowUpCell at={extras.get(lead.id)?.nextFollowUpAt ?? null} />
                </dd>
              </dl>
            </button>
            {lead.address && (
              <details className="group/addr mt-2 text-xs">
                <summary className="flex cursor-pointer list-none items-center gap-1 text-muted-foreground [&::-webkit-details-marker]:hidden">
                  <MapPin className="size-3 shrink-0" />
                  <span className="truncate">{lead.address}</span>
                  <ChevronDown className="size-3 shrink-0 transition-transform group-open/addr:rotate-180" />
                </summary>
                <p className="mt-1 rounded-lg bg-surface-2 p-2 leading-relaxed">{lead.address}</p>
              </details>
            )}
            <div className="mt-3 flex items-center gap-2">
              <WebCallButton
                leadId={lead.id}
                phone={lead.phone_number}
                label={t({ bn: "কল", en: "Call" })}
                className="h-11 flex-1 text-base"
              />
              <WhatsAppAction phone={lead.phone_number} leadId={lead.id} label="" />
              <CallbackLogButton leadId={lead.id} label="" />
            </div>
          </li>
        ))}
        {rows.length === 0 && (
          <li role="status" className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            {t({ bn: "এই তালিকায় এখন কোনো লিড নেই", en: "No leads in this list right now" })}
          </li>
        )}
      </ul>

      <div className="card-elevated hidden overflow-x-auto md:block">
        <table className="w-full min-w-[960px] text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs text-muted-foreground">
              <th className="px-3 py-2.5 font-medium">{t({ bn: "ক্রমিক", en: "No." })}</th>
              <th className="px-3 py-2.5 font-medium">{t({ bn: "নাম", en: "Name" })}</th>
              <th className="px-3 py-2.5 font-medium">{t({ bn: "ফোন নম্বর", en: "Phone number" })}</th>
              <th className="px-3 py-2.5 font-medium">{t({ bn: "রেফারেন্স", en: "Reference" })}</th>
              <th className="px-3 py-2.5 font-medium">{t({ bn: "ঠিকানা", en: "Address" })}</th>
              <th className="px-3 py-2.5 font-medium">{t({ bn: "চাহিদা", en: "Requirement" })}</th>
              <th className="px-3 py-2.5 font-medium">{t({ bn: "অবস্থা", en: "Status" })}</th>
              <th className="px-3 py-2.5 font-medium">{t({ bn: "পরের ফলো-আপ", en: "Next follow-up" })}</th>
              <th className="px-3 py-2.5 text-right font-medium">{t({ bn: "কাজ", en: "Actions" })}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((lead, index) => (
              <tr
                key={lead.id}
                className="border-b border-border/60 last:border-0 hover:bg-surface-2"
              >
                <td className="tabular px-3 py-2.5 text-muted-foreground">
                  {lead.serial_no ?? index + 1}
                </td>
                <td className="px-3 py-2.5">
                  <button
                    className="text-left font-medium hover:underline"
                    onClick={() => setOpenLeadId(lead.id)}
                  >
                    {lead.name}
                  </button>
                  {lead.company && (
                    <p className="truncate text-xs text-muted-foreground">{lead.company}</p>
                  )}
                </td>
                <td className="tabular px-3 py-2.5">{lead.phone_number}</td>
                <td className="px-3 py-2.5 text-xs text-muted-foreground">
                  {lead.reference_by ?? "—"}
                </td>
                <td
                  className="max-w-[160px] truncate px-3 py-2.5 text-xs text-muted-foreground"
                  title={lead.address ?? undefined}
                >
                  {lead.address ?? "—"}
                </td>
                <td className="max-w-[180px] truncate px-3 py-2.5 text-xs">
                  {extras.get(lead.id)?.requirement ?? "—"}
                </td>
                <td className="px-3 py-2.5">
                  <LeadStatusBadge status={lead.status} />
                </td>
                <td className="px-3 py-2.5 text-xs">
                  <FollowUpCell at={extras.get(lead.id)?.nextFollowUpAt ?? null} />
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    {lead.last_call_at
                      ? t({ bn: `শেষ কল ${relativeTime(lead.last_call_at)}`, en: `Last call ${relativeTime(lead.last_call_at)}` })
                      : t({ bn: `${lead.call_attempts} বার চেষ্টা`, en: `${lead.call_attempts} attempts` })}
                  </p>
                </td>
                <td className="px-3 py-2.5">
                  <div className="flex items-center justify-end gap-2">
                    <WebCallButton
                      leadId={lead.id}
                      phone={lead.phone_number}
                      label={t({ bn: "কল", en: "Call" })}
                      className="h-9 flex-none text-sm"
                    />
                    <CallbackLogButton leadId={lead.id} label="" />
                    <WhatsAppAction phone={lead.phone_number} leadId={lead.id} label="" />
                  </div>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={9} className="px-3 py-10 text-center text-sm text-muted-foreground">
                  {t({ bn: "এই তালিকায় এখন কোনো লিড নেই", en: "No leads in this list right now" })}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

    </>
  );
}
