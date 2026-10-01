import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AlertTriangle, CalendarCheck, Handshake, Lightbulb, MapPin, PhoneCall, Users, Wallet } from "lucide-react";
import { useMemo, useState } from "react";

import type { DrillSpec } from "@/components/crm/HqDrillSheet";
import { Skeleton } from "@/components/ui/skeleton";
import { SiteVisitsPanel } from "@/components/crm/hq/SiteVisitsPanel";
import { ObjectionDemandPanel } from "@/components/crm/hq/ObjectionDemandPanel";
import { BookingsPanel } from "@/components/crm/hq/BookingsPanel";
import { MarketPulseFunnel } from "@/components/crm/hq/MarketPulseFunnel";
import { getCommandCenterFeed } from "@/lib/command-center.functions";
import { computeCommandCenter, presetRange, type CcFilters } from "@/lib/command-center";
import type { CallRecording, Lead, Profile } from "@/lib/crm-data";
import { DEFAULT_DAILY_QUOTA } from "@/lib/lead-quota";
import { useAdminToken } from "@/lib/local-session";

type Preset = "7d" | "30d" | "month" | "custom";
const tip = { background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12, fontSize: 12, color: "var(--foreground)" };
const axis = { stroke: "var(--border)", tick: { fill: "var(--muted-foreground)", fontSize: 10 }, tickLine: false } as const;
const fmt = (n: number | null) => (n === null ? "—" : `${n}%`);
const dayLabel = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString("bn-BD", { day: "numeric", month: "short", timeZone: "UTC" });

function Panel({ title, question, children, className = "" }: { title: string; question: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={`card-elevated min-w-0 p-4 sm:p-5 ${className}`}>
      <header className="mb-3">
        <h3 className="text-sm font-semibold tracking-tight">{title}</h3>
        <p className="text-[11px] text-muted-foreground">{question}</p>
      </header>
      {children}
    </section>
  );
}

export function SalesCommandCenter({
  profiles,
  leads,
  calls,
  loading,
  onDrill,
  onSelectAgent,
}: {
  profiles: Profile[];
  leads: Lead[];
  calls: CallRecording[];
  loading: boolean;
  onDrill: (spec: DrillSpec) => void;
  onSelectAgent: (id: string) => void;
}) {
  const adminToken = useAdminToken();
  const fetchFeed = useServerFn(getCommandCenterFeed);
  const feed = useQuery({
    queryKey: ["command-center-feed", adminToken],
    queryFn: () => fetchFeed({ data: { adminToken } }),
    refetchInterval: 30_000,
  });

  const [preset, setPreset] = useState<Preset>("7d");
  const [custom, setCustom] = useState(() => presetRange("30d", new Date()));
  const [agentId, setAgentId] = useState<string | null>(null);
  const [source, setSource] = useState<string | null>(null);
  const [project, setProject] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<"leads" | "qualified" | "siteVisits" | "bookings">("leads");

  const agents = useMemo(
    () =>
      profiles
        .filter((p) => (p.role === "agent" || p.role === "team_leader") && p.is_active && p.approval_status === "approved")
        .map((p) => ({ id: p.id, name: p.name })),
    [profiles],
  );
  const sourceOptions = useMemo(() => [...new Set(leads.map((l) => (l.source ?? "unknown").replace(/_/g, " ")))].sort(), [leads]);
  const projectOptions = useMemo(
    () => [...new Set((feed.data?.reports ?? []).map((r) => r.requirement).filter(Boolean) as string[])].sort(),
    [feed.data],
  );

  const range = preset === "custom" ? custom : presetRange(preset, new Date());
  const filters: CcFilters = { ...range, agentId, source, project };

  const cc = useMemo(
    () =>
      computeCommandCenter({
        leads,
        calls,
        reports: feed.data?.reports ?? [],
        followUps: feed.data?.followUps ?? [],
        agents,
        filters,
        now: new Date(),
        dailyLeadQuota: DEFAULT_DAILY_QUOTA,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [leads, calls, feed.data, agents, range.fromDay, range.toDay, agentId, source, project],
  );

  const leadById = useMemo(() => new Map(leads.map((l) => [l.id, l])), [leads]);
  const drill = (title: string, ids: string[]) =>
    onDrill({ title, subtitle: `${ids.length}টি লিড · ${range.fromDay} – ${range.toDay}`, kind: "leads", leads: ids.map((id) => leadById.get(id)).filter(Boolean) as Lead[] });

  if (loading || feed.isPending) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}
        </div>
        <div className="grid gap-4 lg:grid-cols-2"><Skeleton className="h-64 rounded-2xl" /><Skeleton className="h-64 rounded-2xl" /></div>
      </div>
    );
  }

  const funnelLabels: Record<string, string> = { leads: "লিড", contacted: "যোগাযোগ", interested: "আগ্রহী", siteVisit: "সাইট ভিজিট", booking: "বুকিং" };
  const funnelMax = Math.max(1, cc.funnel[0]!.count);
  const sortedSources = [...cc.sources].sort((a, b) => b[sortBy] - a[sortBy]).slice(0, 8);
  const agentName = (id: string | null) => agents.find((a) => a.id === id)?.name;

  const kpis = [
    { icon: Users, label: "মোট লিড", value: cc.kpi.totalLeads, hint: `এই সময়ে নতুন ${cc.kpi.newLeadsInRange}`, onClick: () => drill("মোট লিড", cc.funnel[0]!.leadIds) },
    { icon: PhoneCall, label: "যোগাযোগ", value: cc.funnel[1]!.count, hint: `${fmt(cc.funnel[1]!.fromPrev)} · আজ ${cc.kpi.callsToday} কল, ${cc.kpi.connectedToday} সংযুক্ত`, onClick: () => drill("যোগাযোগ হওয়া লিড", cc.funnel[1]!.leadIds) },
    { icon: CalendarCheck, label: "খোলা ফলো-আপ", value: cc.kpi.openFollowUps, hint: `${cc.followUpHealth.overdue.count} মেয়াদোত্তীর্ণ`, onClick: () => drill("মেয়াদোত্তীর্ণ ফলো-আপ", cc.followUpHealth.overdue.leadIds) },
    { icon: MapPin, label: "সাইট ভিজিট", value: cc.kpi.siteVisits, hint: "রিপোর্টে সংরক্ষিত সিগন্যাল", onClick: () => drill("সাইট ভিজিট লিড", cc.funnel[3]!.leadIds) },
    { icon: Handshake, label: "বুকিং", value: cc.kpi.bookings, hint: "closed-converted রিপোর্ট", onClick: () => drill("বুকিং লিড", cc.funnel[4]!.leadIds) },
    { icon: Wallet, label: "রেভিনিউ", value: null, hint: "CRM-এ ডিল মূল্য রেকর্ড হয় না", onClick: undefined },
  ];

  const select = "h-9 min-w-0 rounded-lg border border-border bg-background px-2.5 text-xs";

  return (
    <div className="space-y-5">
      {/* Global filters */}
      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-border bg-muted/30 p-2.5">
        <div className="flex rounded-lg border border-border bg-background p-0.5" role="group" aria-label="সময়সীমা">
          {(["7d", "30d", "month", "custom"] as Preset[]).map((p) => (
            <button key={p} type="button" onClick={() => setPreset(p)} aria-pressed={preset === p}
              className={`rounded-md px-2.5 py-1.5 text-xs font-semibold transition-colors ${preset === p ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>
              {p === "7d" ? "7D" : p === "30d" ? "30D" : p === "month" ? "এই মাস" : "কাস্টম"}
            </button>
          ))}
        </div>
        {preset === "custom" && (
          <>
            <input type="date" aria-label="শুরু" className={select} value={custom.fromDay} max={custom.toDay} onChange={(e) => e.target.value && setCustom((c) => ({ ...c, fromDay: e.target.value }))} />
            <input type="date" aria-label="শেষ" className={select} value={custom.toDay} min={custom.fromDay} onChange={(e) => e.target.value && setCustom((c) => ({ ...c, toDay: e.target.value }))} />
          </>
        )}
        <select aria-label="এজেন্ট" className={select} value={agentId ?? ""} onChange={(e) => setAgentId(e.target.value || null)}>
          <option value="">সব এজেন্ট</option>
          {agents.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
        <select aria-label="সোর্স" className={select} value={source ?? ""} onChange={(e) => setSource(e.target.value || null)}>
          <option value="">সব সোর্স</option>
          {sourceOptions.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select aria-label="প্রজেক্ট" className={select} value={project ?? ""} onChange={(e) => setProject(e.target.value || null)}>
          <option value="">সব প্রজেক্ট</option>
          {projectOptions.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <span className="ml-auto text-[11px] text-muted-foreground">{range.fromDay} – {range.toDay} · Asia/Dhaka</span>
      </div>
      {feed.error && <p className="text-xs text-destructive">রিপোর্ট ডেটা লোড হয়নি — সাইট ভিজিট/বুকিং/ফলো-আপ সংখ্যা অসম্পূর্ণ।</p>}

      {/* KPI pulse */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {kpis.map((k) => {
          const Icon = k.icon;
          const body = (
            <>
              <span className="flex items-start justify-between gap-2">
                <span className="text-xs font-semibold text-muted-foreground">{k.label}</span>
                <span className="grid size-9 shrink-0 place-items-center rounded-full bg-primary/15 text-primary"><Icon className="size-4" /></span>
              </span>
              <span className="tabular mt-1 block text-3xl font-bold tracking-tight">{k.value === null ? "—" : k.value.toLocaleString("bn-BD")}</span>
              <span className={`mt-1 block truncate text-[11px] ${k.label === "খোলা ফলো-আপ" ? "text-destructive" : "text-muted-foreground"}`}>{k.hint}</span>
            </>
          );
          return k.onClick ? (
            <button key={k.label} type="button" onClick={k.onClick} className="card-elevated p-4 text-left transition-colors hover:border-primary/50">{body}</button>
          ) : (
            <div key={k.label} className="card-elevated p-4">{body}</div>
          );
        })}
      </div>

      <div className="grid gap-4 lg:grid-cols-12">
        {/* Arrow-style funnel */}
        <Panel title="সেলস ফানেল" question="লিড কোন ধাপে আটকে যাচ্ছে? (বর্তমান ফিল্টার, সব সময়ের)" className="lg:col-span-5">
          <ol className="flex items-stretch gap-1 overflow-x-auto pb-1">
            {cc.funnel.map((s, i) => {
              const tone = ["bg-primary text-primary-foreground", "bg-primary/45", "bg-chart-2/70", "bg-chart-3/60", "bg-chart-3/85"][i] ?? "bg-muted";
              return (
                <li key={s.key} className="flex min-w-0 flex-1 items-center gap-1">
                  {i > 0 && <span aria-hidden className="shrink-0 text-muted-foreground">→</span>}
                  <button type="button" onClick={() => drill(funnelLabels[s.key] ?? s.key, s.leadIds)}
                    className={`flex min-h-24 min-w-[64px] flex-1 flex-col items-center justify-center rounded-xl px-1.5 py-2 text-center transition-transform hover:-translate-y-0.5 ${tone}`}
                    style={{ opacity: 0.55 + 0.45 * Math.max(0.15, s.count / funnelMax) }}>
                    <span className="tabular text-lg font-bold leading-tight">{s.count.toLocaleString("bn-BD")}</span>
                    <span className="text-[11px] font-medium">{funnelLabels[s.key] ?? s.key}</span>
                    {s.fromPrev !== null && <span className="tabular mt-1 rounded-full bg-background/40 px-1.5 text-[10px] font-semibold">{fmt(s.fromPrev)}</span>}
                  </button>
                </li>
              );
            })}
          </ol>
          <p className="mt-3 text-[10px] text-muted-foreground">% = আগের ধাপ থেকে রূপান্তর। সাইট ভিজিট ও বুকিং শুধু সংরক্ষিত রিপোর্ট সিগন্যাল থেকে।</p>
        </Panel>

        {/* Command Zone */}
        <Panel title="আজকের কাজ — কমান্ড জোন" question="আজ দল কতটা এগোল?" className="lg:col-span-4">
          <div className="grid grid-cols-3 gap-2">
            <Ring label="কাজ করা লিড (কোটা)" actual={cc.execution.leadsWorked} target={cc.execution.target} />
            <Ring label="ফলো-আপ সম্পন্ন" actual={cc.execution.followUpsDoneToday} target={cc.execution.followUpsDueToday || null} />
            <Ring label="সাইট ভিজিট সিগন্যাল" actual={cc.execution.siteVisitsToday} target={null} />
          </div>
          <p className="mt-3 text-[10px] text-muted-foreground">কোটা = প্রতি এজেন্ট {DEFAULT_DAILY_QUOTA} লিড/দিন (LeadHub ডিফল্ট)। কলের আলাদা টার্গেট CRM-এ নেই।</p>
        </Panel>

        {/* Follow-up health */}
        <Panel title="ফলো-আপ হেলথ" question="কোন ফলো-আপ এখনই ধরতে হবে?" className="lg:col-span-3">
          <ul className="space-y-1.5">
            {([
              ["overdue", "মেয়াদোত্তীর্ণ", "bg-destructive", "text-destructive"],
              ["dueToday", "আজ নির্ধারিত", "bg-warning", "text-warning"],
              ["upcoming", "আসন্ন", "bg-chart-2", "text-chart-2"],
              ["completed", "সম্পন্ন (সময়সীমায়)", "bg-success", "text-success"],
            ] as const).map(([k, l, dot, tone]) => (
              <li key={k}>
                <button type="button" onClick={() => drill(`ফলো-আপ: ${l}`, cc.followUpHealth[k].leadIds)} className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs hover:bg-accent">
                  <span className={`size-2.5 rounded-full ${dot}`} /><span className="flex-1">{l}</span>
                  <span className={`tabular text-lg font-bold ${tone}`}>{cc.followUpHealth[k].count}</span>
                </button>
              </li>
            ))}
          </ul>
          {cc.followUpHealth.overdue.count > 0 && (
            <button type="button" onClick={() => drill("মেয়াদোত্তীর্ণ ফলো-আপ", cc.followUpHealth.overdue.leadIds)}
              className="mt-3 w-full rounded-lg bg-destructive px-3 py-2 text-xs font-semibold text-destructive-foreground hover:opacity-90">
              {cc.followUpHealth.overdue.count}টি ফলো-আপ রিভিউ করুন →
            </button>
          )}
        </Panel>
      </div>

      <HourlyActivity reports={feed.data?.reports ?? []} fromDay={range.fromDay} toDay={range.toDay} agentId={agentId} />

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Agent performance */}
        <Panel title="এজেন্ট পারফরম্যান্স (আজ)" question="কে দৈনিক লিড কোটার কতটা শেষ করেছে? নাম চাপলে Agent 360।">
          {cc.agentRows.length === 0 ? <Empty text="কোনো সক্রিয় এজেন্ট নেই।" /> : (
            <ol className="max-h-80 space-y-2.5 overflow-y-auto pr-1">
              {cc.agentRows.map((a) => (
                <li key={a.id}>
                  <button type="button" onClick={() => onSelectAgent(a.id)} className="w-full text-left">
                    <span className="flex items-center justify-between gap-2 text-xs">
                      <span className="min-w-0 truncate font-semibold">{a.name}</span>
                      <span className="tabular shrink-0 text-muted-foreground">{a.leadsWorked}/{a.target} লিড · {a.calls} কল · {a.connected} সংযুক্ত</span>
                    </span>
                    <span className="mt-1 block h-2 overflow-hidden rounded-full bg-muted">
                      <span className="block h-full rounded-full bg-primary" style={{ width: `${Math.min(100, a.progress ?? 0)}%` }} />
                    </span>
                  </button>
                </li>
              ))}
            </ol>
          )}
        </Panel>

        {/* Trend */}
        <Panel title="কল ট্রেন্ড" question="নির্বাচিত সময়ে কল ও সংযুক্ত কল কীভাবে বদলেছে?">
          {cc.trend.every((d) => d.calls === 0) ? <Empty text="এই সময়ে কোনো কল নেই।" /> : (
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={cc.trend.map((d) => ({ ...d, label: dayLabel(d.day) }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="label" {...axis} minTickGap={18} />
                  <YAxis width={32} allowDecimals={false} {...axis} />
                  <Tooltip contentStyle={tip} />
                  <Line type="monotone" dataKey="calls" name="কল" stroke="var(--chart-1)" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="connected" name="সংযুক্ত" stroke="var(--chart-2)" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </Panel>
      </div>

      <div className="grid gap-4">
        {/* Source performance */}
        <Panel title="লিড সোর্স পারফরম্যান্স" question="কোন সোর্স থেকে আসল ফল আসছে?">
          <div className="mb-2 flex flex-wrap gap-1.5" role="group" aria-label="সাজান">
            {([["leads", "লিড"], ["qualified", "আগ্রহী"], ["siteVisits", "সাইট ভিজিট"], ["bookings", "বুকিং"]] as const).map(([k, l]) => (
              <button key={k} type="button" onClick={() => setSortBy(k)} aria-pressed={sortBy === k}
                className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${sortBy === k ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"}`}>{l}</button>
            ))}
          </div>
          {sortedSources.length === 0 ? <Empty text="কোনো লিড নেই।" /> : (
            <div className="table-scroll">
              <table className="w-full min-w-[420px] text-xs">
                <thead className="text-left text-[10px] uppercase tracking-wide text-muted-foreground">
                  <tr><th className="py-1.5 font-medium">সোর্স</th><th className="text-right font-medium">লিড</th><th className="text-right font-medium">আগ্রহী</th><th className="text-right font-medium">সাইট ভিজিট</th><th className="text-right font-medium">বুকিং</th></tr>
                </thead>
                <tbody>
                  {sortedSources.map((s) => (
                    <tr key={s.name} className="border-t border-border">
                      <td className="max-w-40 truncate py-2 capitalize"><button type="button" className="hover:text-primary hover:underline" onClick={() => drill(`সোর্স: ${s.name}`, s.leadIds)}>{s.name}</button></td>
                      <td className="tabular text-right font-semibold">{s.leads}</td>
                      <td className="tabular text-right">{s.qualified}</td>
                      <td className="tabular text-right">{s.siteVisits}</td>
                      <td className="tabular text-right">{s.bookings}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Site visits + bookings (separate, count-only) */}
        <Panel title="সাইট ভিজিট ও বুকিং" question="প্রতিদিন কতগুলো লিড সাইট ভিজিট / বুকিং সিগন্যাল দিয়েছে?">
          {cc.trend.every((d) => d.bookings === 0 && d.siteVisits === 0) ? <Empty text="এই সময়ে কোনো সাইট ভিজিট বা বুকিং রিপোর্ট নেই।" /> : (
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={cc.trend.map((d) => ({ ...d, label: dayLabel(d.day) }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="label" {...axis} minTickGap={18} />
                  <YAxis width={28} allowDecimals={false} {...axis} />
                  <Tooltip contentStyle={tip} />
                  <Bar dataKey="siteVisits" name="সাইট ভিজিট" fill="var(--chart-3)" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="bookings" name="বুকিং" fill="var(--chart-1)" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
          <p className="mt-2 text-[10px] text-muted-foreground">Scheduled / completed / cancelled / no-show অবস্থা এবং রেভিনিউ এখনো CRM-এ রেকর্ড হয় না, তাই দেখানো হয়নি।</p>
        </Panel>

        {/* Insights */}
        <Panel title="স্মার্ট ইনসাইট" question="লোড হওয়া ডেটা থেকে সরাসরি পাওয়া পর্যবেক্ষণ">
          {cc.insights.length === 0 ? <Empty text="ইনসাইটের জন্য যথেষ্ট ডেটা নেই।" /> : (
            <ul className="space-y-2">
              {cc.insights.map((t) => (
                <li key={t} className="flex gap-2 rounded-xl bg-muted/50 p-3 text-xs">
                  {t.includes("পেরিয়ে") ? <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-destructive" /> : <Lightbulb className="mt-0.5 size-3.5 shrink-0 text-primary" />}
                  <span>{t}</span>
                </li>
              ))}
            </ul>
          )}
          {agentId && <p className="mt-2 text-[10px] text-muted-foreground">ফিল্টার: {agentName(agentId)}</p>}
        </Panel>
      </div>

      <ObjectionDemandPanel reports={feed.data?.reports ?? []} filters={{ ...range, agentId, project }} onDrill={drill} />

      <MarketPulseFunnel leads={leads} reports={feed.data?.reports ?? []} filters={{ fromDay: range.fromDay, toDay: range.toDay, agentId }} onDrill={drill} />

      <SiteVisitsPanel leads={leads} fromDay={range.fromDay} toDay={range.toDay} agentId={agentId} />

      <BookingsPanel leads={leads} fromDay={range.fromDay} toDay={range.toDay} agentId={agentId} />
    </div>
  );
}

function Meter({ label, actual, target }: { label: string; actual: number; target: number | null }) {
  const p = target ? Math.min(100, Math.round((actual / target) * 100)) : null;
  return (
    <div>
      <div className="flex items-center justify-between text-xs">
        <dt className="text-muted-foreground">{label}</dt>
        <dd className="tabular font-semibold">{actual}{target ? <span className="font-normal text-muted-foreground"> / {target}</span> : <span className="font-normal text-muted-foreground"> · আজ কিছু নির্ধারিত নেই</span>}</dd>
      </div>
      {p !== null && <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${p}%` }} /></div>}
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="rounded-xl border border-dashed border-border p-6 text-center text-xs text-muted-foreground">{text}</p>;
}

function Ring({ label, actual, target }: { label: string; actual: number; target: number | null }) {
  const p = target ? Math.min(100, Math.round((actual / target) * 100)) : 0;
  const r = 30, c = 2 * Math.PI * r;
  return (
    <div className="flex flex-col items-center text-center">
      <span className="mb-1 min-h-8 text-[11px] font-medium text-muted-foreground">{label}</span>
      <svg viewBox="0 0 80 80" className="size-20 sm:size-24" role="img" aria-label={`${label}: ${actual}${target ? ` / ${target}` : ""}`}>
        <circle cx="40" cy="40" r={r} fill="none" stroke="var(--muted)" strokeWidth="7" />
        {target ? <circle cx="40" cy="40" r={r} fill="none" stroke="var(--primary)" strokeWidth="7" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - p / 100)} transform="rotate(-90 40 40)" /> : null}
        <text x="40" y="40" textAnchor="middle" fontSize="13" fontWeight="700" fill="var(--foreground)">{target ? `${actual}/${target}` : actual}</text>
        <text x="40" y="54" textAnchor="middle" fontSize="8" fill="var(--muted-foreground)">{target ? `${p}%` : "টার্গেট নেই"}</text>
      </svg>
    </div>
  );
}

const HOURS = Array.from({ length: 12 }, (_, i) => i + 9); // 9 AM – 8 PM Dhaka
function HourlyActivity({ reports, fromDay, toDay, agentId }: { reports: { agent_id: string | null; submitted_at: string | null; created_at: string }[]; fromDay: string; toDay: string; agentId: string | null }) {
  const { grid, days, max } = useMemo(() => {
    const g = new Map<string, number>();
    const ds = new Set<string>();
    let m = 0;
    for (const r of reports) {
      if (agentId && r.agent_id !== agentId) continue;
      const t = new Date(r.submitted_at ?? r.created_at).getTime() + 6 * 3600_000; // Dhaka
      const d = new Date(t);
      const day = d.toISOString().slice(0, 10);
      if (day < fromDay || day > toDay) continue;
      const h = d.getUTCHours();
      ds.add(day);
      const k = `${day}|${h}`;
      const v = (g.get(k) ?? 0) + 1;
      g.set(k, v);
      if (HOURS.includes(h)) m = Math.max(m, v);
    }
    return { grid: g, days: [...ds].sort().slice(-14), max: m };
  }, [reports, fromDay, toDay, agentId]);
  return (
    <Panel title="ঘণ্টাভিত্তিক কাজের চিত্র" question="দিনের কোন সময়ে দল সবচেয়ে বেশি কল রিপোর্ট জমা দিচ্ছে? (Asia/Dhaka)">
      {max === 0 ? <Empty text="এই সময়ে কোনো কল রিপোর্ট নেই।" /> : (
        <div className="table-scroll">
          <table className="w-full min-w-[560px] border-separate border-spacing-1 text-[10px]">
            <thead><tr><th />{HOURS.map((h) => <th key={h} className="font-medium text-muted-foreground">{h > 12 ? `${h - 12}PM` : h === 12 ? "12PM" : `${h}AM`}</th>)}</tr></thead>
            <tbody>
              {days.map((d) => (
                <tr key={d}>
                  <th className="whitespace-nowrap pr-1 text-left font-medium text-muted-foreground">{dayLabel(d)}</th>
                  {HOURS.map((h) => {
                    const v = grid.get(`${d}|${h}`) ?? 0;
                    return (
                      <td key={h} title={`${dayLabel(d)} ${h}:00 — ${v}টি রিপোর্ট`} className="h-6 rounded text-center tabular"
                        style={{ background: v ? `color-mix(in oklab, var(--primary) ${Math.round(15 + (v / max) * 85)}%, transparent)` : "var(--muted)", color: v / max > 0.55 ? "var(--primary-foreground)" : "var(--muted-foreground)" }}>
                        {v || ""}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}
