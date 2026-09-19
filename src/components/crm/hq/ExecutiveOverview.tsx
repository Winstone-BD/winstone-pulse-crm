import {
  Activity,
  CalendarCheck,
  Flame,
  Handshake,
  PhoneCall,
  Users,
} from "lucide-react";
import { useMemo } from "react";
import {
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import {
  CONNECTED_THRESHOLD_SECONDS,
  LEAD_EVENT_LABELS,
  buildAgentStats,
  type CallRecording,
  type Lead,
  type LeadEvent,
  type Profile,
  type WhatsappMessage,
} from "@/lib/crm-data";

const DONUT_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
  "var(--muted-foreground)",
];

function KpiCard({
  icon,
  label,
  value,
  hint,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="card-elevated flex items-start gap-3 p-3">
      <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary/12 text-primary">
        {icon}
      </span>
      <div className="min-w-0">
        <p className="truncate text-[11px] font-medium text-muted-foreground">{label}</p>
        <p className="tabular text-xl font-bold leading-tight">{value}</p>
        <p className="truncate text-[10px] text-muted-foreground">{hint}</p>
      </div>
    </div>
  );
}

/** Reference-style executive overview: KPI row, funnel, source mix, team board, trends. */
export function ExecutiveOverview({
  profiles,
  leads,
  calls,
  messages,
  events,
  onSelectAgent,
}: {
  profiles: Profile[];
  leads: Lead[];
  calls: CallRecording[];
  messages: WhatsappMessage[];
  events: LeadEvent[];
  onSelectAgent?: (agentId: string) => void;
}) {
  const kpi = useMemo(() => {
    const today = new Date().toDateString();
    // "যোগাযোগ হয়েছে" = লিডে সত্যিই কল হয়েছে (রিপোর্ট/কল গণনা থেকে),
    // রেকর্ডিং সিঙ্ক আলাদা হিসাব — সেটা নিচের hint-এ দেখানো হয়।
    const connected = calls.filter((c) => c.duration_seconds > CONNECTED_THRESHOLD_SECONDS);
    const recordedLeads = new Set(connected.map((c) => c.lead_id).filter(Boolean)).size;
    const contacted = leads.filter((l) => l.call_attempts > 0 || !!l.last_call_at).length;
    const hot = leads.filter((l) => l.temperature === "hot").length;
    const warm = leads.filter((l) => l.temperature === "warm").length;
    const followUp = leads.filter((l) => l.status === "follow_up").length;
    const won = leads.filter(
      (l) => l.status === "closed" && l.outcome_category === "deal_won",
    ).length;
    return {
      total: leads.length,
      contacted,
      recordedLeads,
      qualified: hot + warm,
      followUp,
      won,
      todayCalls: calls.filter((c) => new Date(c.created_at).toDateString() === today).length,
      contactRate: leads.length ? Math.round((contacted / leads.length) * 100) : 0,
      qualifiedRate: leads.length ? Math.round(((hot + warm) / leads.length) * 100) : 0,
      wonRate: leads.length ? Math.round((won / leads.length) * 100) : 0,
    };
  }, [calls, leads]);

  const funnel = useMemo(() => {
    const steps = [
      { label: "নতুন লিড", value: leads.length },
      {
        label: "যোগাযোগ হয়েছে",
        value: leads.filter((l) => l.call_attempts > 0 || !!l.last_call_at).length,
      },
      {
        label: "কোয়ালিফাইড",
        value: leads.filter((l) => l.temperature === "hot" || l.temperature === "warm").length,
      },
      { label: "ফলো-আপ", value: leads.filter((l) => l.status === "follow_up").length },
      { label: "আলোচনা চলছে", value: leads.filter((l) => l.temperature === "hot").length },
      {
        label: "বুকিং",
        value: leads.filter((l) => l.status === "closed" && l.outcome_category === "deal_won")
          .length,
      },
    ];
    return steps;
  }, [leads]);

  const sources = useMemo(() => {
    const counts = new Map<string, number>();
    for (const lead of leads) {
      const key = (lead.source ?? "unknown").replace(/_/g, " ");
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
    const top = sorted.slice(0, 5);
    const restTotal = sorted.slice(5).reduce((sum, [, v]) => sum + v, 0);
    const rows = restTotal ? [...top, ["অন্যান্য", restTotal] as const] : top;
    return rows.map(([name, value]) => ({
      name,
      value,
      pct: leads.length ? Math.round((value / leads.length) * 100) : 0,
    }));
  }, [leads]);

  const team = useMemo(
    () => buildAgentStats(profiles, leads, calls, messages).slice(0, 5),
    [profiles, leads, calls, messages],
  );
  const teamMax = Math.max(1, ...team.map((t) => t.connected));

  const trend = useMemo(() => {
    const days: { label: string; calls: number }[] = [];
    for (let i = 13; i >= 0; i -= 1) {
      const day = new Date(Date.now() - i * 86_400_000);
      const key = day.toDateString();
      days.push({
        label: day.toLocaleDateString("bn-BD", { day: "numeric", month: "short" }),
        calls: calls.filter((c) => new Date(c.created_at).toDateString() === key).length,
      });
    }
    return days;
  }, [calls]);

  const recent = useMemo(
    () =>
      [...events]
        .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))
        .slice(0, 6)
        .map((e) => ({
          id: e.id,
          label: LEAD_EVENT_LABELS[e.kind] ?? e.kind.replace(/_/g, " "),
          when: new Date(e.created_at).toLocaleString("bn-BD", {
            hour: "2-digit",
            minute: "2-digit",
            day: "numeric",
            month: "short",
          }),
        })),
    [events],
  );

  return (
    <section className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
        <KpiCard
          icon={<Users className="size-4" />}
          label="মোট লিড"
          value={String(kpi.total)}
          hint="সব সময়ের"
        />
        <KpiCard
          icon={<PhoneCall className="size-4" />}
          label="যোগাযোগ হয়েছে"
          value={String(kpi.contacted)}
          hint={`${kpi.contactRate}% লিডে কথা`}
        />
        <KpiCard
          icon={<Flame className="size-4" />}
          label="কোয়ালিফাইড (হট+ওয়ার্ম)"
          value={String(kpi.qualified)}
          hint={`${kpi.qualifiedRate}% কোয়ালিফাইড`}
        />
        <KpiCard
          icon={<CalendarCheck className="size-4" />}
          label="ফলো-আপ বাকি"
          value={String(kpi.followUp)}
          hint="সময় নির্ধারিত"
        />
        <KpiCard
          icon={<Handshake className="size-4" />}
          label="ডিল জেতা"
          value={String(kpi.won)}
          hint={`${kpi.wonRate}% রূপান্তর`}
        />
        <KpiCard
          icon={<Activity className="size-4" />}
          label="আজকের কল"
          value={String(kpi.todayCalls)}
          hint="সব এজেন্ট মিলিয়ে"
        />
      </div>

      <div className="grid gap-3 xl:grid-cols-3">
        <div className="card-elevated card-pad">
          <div className="flex items-end justify-between gap-2">
            <h3 className="text-sm font-semibold">সেলস পাইপলাইন</h3>
            <span className="text-[11px] text-muted-foreground">মোট লিড: {kpi.total}</span>
          </div>
          <ul className="mt-3 space-y-1.5">
            {funnel.map((step, i) => {
              const width = 100 - i * 13;
              return (
                <li key={step.label} className="flex items-center gap-3">
                  <span
                    className="grid h-8 shrink-0 place-items-center rounded-sm bg-primary/80 text-[11px] font-semibold text-primary-foreground"
                    style={{ width: `${width}%`, opacity: 1 - i * 0.12 }}
                  >
                    {step.value}
                  </span>
                  <span className="shrink-0 text-[11px] text-muted-foreground">{step.label}</span>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="card-elevated card-pad">
          <h3 className="text-sm font-semibold">লিড সোর্স</h3>
          <div className="mt-2 flex flex-col items-center gap-3 sm:flex-row">
            <div className="relative h-40 w-40 shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={sources}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={48}
                    outerRadius={70}
                    paddingAngle={2}
                    stroke="none"
                  >
                    {sources.map((row, i) => (
                      <Cell key={row.name} fill={DONUT_COLORS[i % DONUT_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      background: "var(--card)",
                      border: "1px solid var(--border)",
                      borderRadius: 12,
                      fontSize: 12,
                      color: "var(--foreground)",
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 grid place-items-center">
                <div className="text-center">
                  <p className="tabular text-lg font-bold leading-none">{kpi.total}</p>
                  <p className="text-[10px] text-muted-foreground">লিড</p>
                </div>
              </div>
            </div>
            <ul className="w-full space-y-1.5">
              {sources.map((row, i) => (
                <li key={row.name} className="flex items-center gap-2 text-[11px]">
                  <span
                    aria-hidden
                    className="size-2 rounded-full"
                    style={{ background: DONUT_COLORS[i % DONUT_COLORS.length] }}
                  />
                  <span className="min-w-0 flex-1 truncate capitalize">{row.name}</span>
                  <span className="tabular text-muted-foreground">{row.pct}%</span>
                </li>
              ))}
              {sources.length === 0 && (
                <li className="text-[11px] text-muted-foreground">কোনো লিড নেই।</li>
              )}
            </ul>
          </div>
        </div>

        <div className="card-elevated card-pad">
          <h3 className="text-sm font-semibold">টিম পারফরম্যান্স</h3>
          <ol className="mt-3 space-y-2.5">
            {team.map((row, i) => {
              const pct = Math.round((row.connected / teamMax) * 100);
              return (
                <li key={row.profile.id}>
                  <button
                    type="button"
                    onClick={() => onSelectAgent?.(row.profile.id)}
                    className="flex w-full items-center gap-2 text-left"
                  >
                    <span className="tabular w-4 text-[11px] text-muted-foreground">{i + 1}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-semibold">
                        {row.profile.name}
                      </span>
                      <span className="block text-[10px] text-muted-foreground">
                        {row.dials} কল · {row.connected} কথা · {row.closedWon} বুকিং
                      </span>
                      <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-muted">
                        <span
                          className="block h-full rounded-full bg-primary"
                          style={{ width: `${pct}%` }}
                        />
                      </span>
                    </span>
                    <span className="tabular text-[11px] font-semibold">{pct}%</span>
                  </button>
                </li>
              );
            })}
            {team.length === 0 && (
              <li className="text-[11px] text-muted-foreground">এখনো কোনো এজেন্ট নেই।</li>
            )}
          </ol>
        </div>
      </div>

      <div className="grid gap-3 xl:grid-cols-3">
        <div className="card-elevated card-pad xl:col-span-1">
          <h3 className="text-sm font-semibold">কল অ্যাক্টিভিটি ট্রেন্ড</h3>
          <div className="mt-2 h-40">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trend}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="var(--border)"
                  strokeOpacity={0.6}
                  vertical={false}
                />
                <XAxis
                  dataKey="label"
                  interval={3}
                  stroke="var(--border)"
                  tick={{ fill: "var(--muted-foreground)", fontSize: 10 }}
                  tickLine={false}
                />
                <YAxis
                  width={28}
                  stroke="var(--border)"
                  tick={{ fill: "var(--muted-foreground)", fontSize: 10 }}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={{
                    background: "var(--card)",
                    border: "1px solid var(--border)",
                    borderRadius: 12,
                    fontSize: 12,
                    color: "var(--foreground)",
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="calls"
                  name="কল"
                  stroke="var(--chart-1)"
                  strokeWidth={2}
                  dot={{ r: 2.5, fill: "var(--chart-1)" }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card-elevated card-pad">
          <h3 className="text-sm font-semibold">রূপান্তরের হার</h3>
          <div className="mt-3 grid grid-cols-3 gap-2">
            <Gauge label="কথা হওয়ার হার" value={kpi.contactRate} color="var(--chart-1)" />
            <Gauge label="কোয়ালিফাইড হার" value={kpi.qualifiedRate} color="var(--chart-2)" />
            <Gauge label="বুকিং হার" value={kpi.wonRate} color="var(--chart-3)" />
          </div>
        </div>

        <div className="card-elevated card-pad">
          <h3 className="text-sm font-semibold">সাম্প্রতিক কাজ</h3>
          <ul className="mt-3 space-y-2">
            {recent.map((row) => (
              <li key={row.id} className="flex items-center gap-2 text-[11px]">
                <span className="size-1.5 shrink-0 rounded-full bg-primary" />
                <span className="min-w-0 flex-1 truncate">{row.label}</span>
                <span className="shrink-0 text-muted-foreground">{row.when}</span>
              </li>
            ))}
            {recent.length === 0 && (
              <li className="text-[11px] text-muted-foreground">কোনো কাজের রেকর্ড নেই।</li>
            )}
          </ul>
        </div>
      </div>
    </section>
  );
}

function Gauge({ label, value, color }: { label: string; value: number; color: string }) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div className="flex flex-col items-center gap-1">
      <div
        className="grid size-20 place-items-center rounded-full"
        style={{
          background: `conic-gradient(${color} ${pct * 3.6}deg, var(--muted) 0deg)`,
        }}
      >
        <span className="tabular grid size-14 place-items-center rounded-full bg-card text-sm font-bold">
          {pct}%
        </span>
      </div>
      <p className="text-center text-[10px] text-muted-foreground">{label}</p>
    </div>
  );
}
