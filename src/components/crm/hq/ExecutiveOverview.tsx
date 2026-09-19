import {
  Activity,
  CalendarCheck,
  Flame,
  Handshake,
  Inbox,
  PhoneCall,
  Users,
} from "lucide-react";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
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

import { LEAD_EVENT_LABELS, type Lead, type LeadEvent } from "@/lib/crm-data";
import { contactRate, connectRate, winRate } from "@/lib/crm-metrics";
import { getFloorMetrics } from "@/lib/crm-metrics.functions";
import { useAdminToken } from "@/lib/local-session";

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

/**
 * Executive overview built only on server-verified numbers.
 *
 * Every figure here comes from `getFloorMetrics`, the CRM's single metric
 * contract (src/lib/crm-metrics.ts): leads are counted once per lead, calls are
 * counted from submitted reports (never from recordings), and "today" is always
 * the Asia/Dhaka business day decided by the server.
 */
export function ExecutiveOverview({
  leads,
  events,
}: {
  leads: Lead[];
  events: LeadEvent[];
}) {
  const adminToken = useAdminToken();
  const metricsQuery = useQuery({
    queryKey: ["floor-metrics", adminToken ? "pin" : "session"],
    queryFn: () => getFloorMetrics({ data: { token: adminToken } }),
    refetchOnWindowFocus: false,
  });
  const m = metricsQuery.data ?? null;

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

  if (metricsQuery.isPending) {
    return (
      <section className="card-elevated card-pad text-sm text-muted-foreground">
        সার্ভার থেকে হিসাব আসছে…
      </section>
    );
  }
  if (metricsQuery.isError) {
    return (
      <section className="card-elevated card-pad text-sm text-destructive">
        হিসাব আনা যায়নি। পাতা রিফ্রেশ করুন।
      </section>
    );
  }
  if (!m) {
    return (
      <section className="card-elevated card-pad text-sm text-muted-foreground">
        ফ্লোরের পুরো হিসাব দেখার অনুমতি নেই।
      </section>
    );
  }

  const trend = m.trend.map((row) => ({
    label: new Date(`${row.dateKey}T00:00:00+06:00`).toLocaleDateString("bn-BD", {
      day: "numeric",
      month: "short",
    }),
    attempts: row.attempts,
  }));
  const funnel = [
    { label: "মোট লিড", value: m.totalLeads },
    { label: "যোগাযোগ হয়েছে", value: m.contactedLeads },
    { label: "কোয়ালিফাইড", value: m.qualifiedLeads },
    { label: "হট লিড", value: m.hotLeads },
    { label: "বুকিং", value: m.closedWon },
  ];
  const teamMax = Math.max(1, ...m.agents.map((a) => a.connected));
  const freshness = new Date(m.generatedAt).toLocaleTimeString("bn-BD", {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <section className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
        <KpiCard
          icon={<Users className="size-4" />}
          label="মোট লিড"
          value={String(m.totalLeads)}
          hint={`${m.pendingLeads}টি কাজ বাকি`}
        />
        <KpiCard
          icon={<PhoneCall className="size-4" />}
          label="যোগাযোগ হয়েছে"
          value={String(m.contactedLeads)}
          hint={`${contactRate(m)}% লিডে কল হয়েছে`}
        />
        <KpiCard
          icon={<Flame className="size-4" />}
          label="কোয়ালিফাইড (হট+ওয়ার্ম)"
          value={String(m.qualifiedLeads)}
          hint={`হট ${m.hotLeads} · ওয়ার্ম ${m.warmLeads}`}
        />
        <KpiCard
          icon={<CalendarCheck className="size-4" />}
          label="ফলো-আপ বাকি (আজ)"
          value={String(m.followUpDue)}
          hint={`সময় পেরিয়েছে ${m.followUpOverdue}টি`}
        />
        <KpiCard
          icon={<Handshake className="size-4" />}
          label="বুকিং"
          value={String(m.closedWon)}
          hint={`${winRate(m)}% রূপান্তর`}
        />
        <KpiCard
          icon={<Activity className="size-4" />}
          label="আজকের কল রিপোর্ট"
          value={String(m.attemptsToday)}
          hint={`কথা হয়েছে ${m.connectedToday}টিতে · মোট ${m.talkMinutesToday} মিনিট`}
        />
      </div>

      <div className="grid gap-3 xl:grid-cols-3">
        <div className="card-elevated card-pad">
          <div className="flex items-end justify-between gap-2">
            <h3 className="text-sm font-semibold">সেলস পাইপলাইন</h3>
            <span className="text-[11px] text-muted-foreground">মোট লিড: {m.totalLeads}</span>
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
                  <p className="tabular text-lg font-bold leading-none">{leads.length}</p>
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
          <p className="text-[10px] text-muted-foreground">জমা দেওয়া কল রিপোর্ট অনুযায়ী</p>
          <ol className="mt-3 space-y-2.5">
            {m.agents.slice(0, 5).map((row, i) => {
              const pct = Math.round((row.connected / teamMax) * 100);
              return (
                <li key={row.agentId}>
                  <span className="flex w-full items-center gap-2 text-left">
                    <span className="tabular w-4 text-[11px] text-muted-foreground">{i + 1}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-semibold">{row.name}</span>
                      <span className="block text-[10px] text-muted-foreground">
                        {row.attempts} কল · {row.connected} কথা · {row.talkMinutes} মিনিট ·{" "}
                        {row.bookings} বুকিং
                      </span>
                      <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-muted">
                        <span
                          className="block h-full rounded-full bg-primary"
                          style={{ width: `${pct}%` }}
                        />
                      </span>
                    </span>
                    <span className="tabular text-[11px] font-semibold">{pct}%</span>
                  </span>
                </li>
              );
            })}
            {m.agents.length === 0 && (
              <li className="text-[11px] text-muted-foreground">
                এখনো কোনো কল রিপোর্ট জমা পড়েনি।
              </li>
            )}
          </ol>
        </div>
      </div>

      <div className="grid gap-3 xl:grid-cols-3">
        <div className="card-elevated card-pad xl:col-span-1">
          <div className="flex items-end justify-between gap-2">
            <h3 className="text-sm font-semibold">১৪ দিনের কল রিপোর্ট</h3>
            <span className="text-[10px] text-muted-foreground">হিসাব {freshness}-এ</span>
          </div>
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
                  dataKey="attempts"
                  name="কল রিপোর্ট"
                  stroke="var(--chart-1)"
                  strokeWidth={2}
                  dot={{ r: 2.5, fill: "var(--chart-1)" }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card-elevated card-pad">
          <h3 className="text-sm font-semibold">হার</h3>
          <div className="mt-3 grid grid-cols-3 gap-2">
            <Gauge label="কল হওয়ার হার" value={contactRate(m)} color="var(--chart-1)" />
            <Gauge label="কথা হওয়ার হার" value={connectRate(m)} color="var(--chart-2)" />
            <Gauge label="বুকিং হার" value={winRate(m)} color="var(--chart-3)" />
          </div>
          <p className="mt-3 text-[10px] text-muted-foreground">
            মোট {m.callAttempts}টি জমা রিপোর্ট · {m.connectedCalls}টিতে কথা হয়েছে · রেকর্ডিং সিঙ্ক{" "}
            {m.recordingSync}
          </p>
        </div>

        <div className="card-elevated card-pad">
          <h3 className="text-sm font-semibold">সাম্প্রতিক কাজ</h3>
          <p className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <Inbox className="size-3" /> কারো নামে দেওয়া হয়নি {m.unassignedLeads}টি লিড
          </p>
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
