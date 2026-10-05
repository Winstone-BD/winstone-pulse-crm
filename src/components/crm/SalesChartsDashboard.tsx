import { useMemo } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { MessageCircle, Phone, PhoneCall, Users, Flame, CheckCircle2 } from "lucide-react";
import { CONNECTED_THRESHOLD_SECONDS, useSnapshot } from "@/lib/crm-data";
import { relativeTime } from "@/lib/crm-format";

const DAYS = 14;
const dhakaKey = (iso: string) =>
  new Date(iso).toLocaleDateString("en-CA", { timeZone: "Asia/Dhaka" });
const STATUS_LABEL: Record<string, string> = {
  pending: "নতুন / বাকি",
  contacted: "কথা হয়েছে",
  follow_up: "ফলো-আপ",
  closed: "বন্ধ",
};
const PIE_COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)"];
const axis = { stroke: "var(--border)", tick: { fill: "var(--muted-foreground)", fontSize: 11 }, tickLine: false };
const tip = {
  contentStyle: { background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--popover-foreground)", fontSize: 12 },
};

/**
 * Charts dashboard built only from the role-scoped CRM snapshot:
 * HQ sees the whole floor, an agent sees only their own leads and calls.
 */
export function SalesChartsDashboard({ scope }: { scope: "hq" | "agent" }) {
  const { leads, calls, messages, isPending } = useSnapshot();

  const data = useMemo(() => {
    const days: string[] = [];
    for (let i = DAYS - 1; i >= 0; i--) days.push(dhakaKey(new Date(Date.now() - i * 86400000).toISOString()));
    const row = new Map(days.map((d) => [d, { day: d.slice(5), leads: 0, calls: 0, connected: 0, whatsapp: 0 }]));
    for (const l of leads) row.get(dhakaKey(l.created_at)) && row.get(dhakaKey(l.created_at))!.leads++;
    for (const c of calls) {
      const r = row.get(dhakaKey(c.started_at ?? c.created_at));
      if (!r) continue;
      r.calls++;
      if (c.duration_seconds >= CONNECTED_THRESHOLD_SECONDS) r.connected++;
    }
    for (const m of messages) row.get(dhakaKey(m.created_at)) && row.get(dhakaKey(m.created_at))!.whatsapp++;

    const status = Object.keys(STATUS_LABEL).map((k) => ({ name: STATUS_LABEL[k], value: leads.filter((l) => l.status === k).length }));
    const connected = calls.filter((c) => c.duration_seconds >= CONNECTED_THRESHOLD_SECONDS).length;
    const activity = [
      ...calls.map((c) => ({ id: "c" + c.id, kind: "call" as const, at: c.started_at ?? c.created_at, text: c.phone_number, ok: c.duration_seconds >= CONNECTED_THRESHOLD_SECONDS })),
      ...messages.map((m) => ({ id: "m" + m.id, kind: "wa" as const, at: m.created_at, text: m.sender_type === "customer" ? "গ্রাহকের মেসেজ" : "এজেন্টের মেসেজ", ok: true })),
    ].sort((a, b) => b.at.localeCompare(a.at)).slice(0, 8);
    return {
      trend: [...row.values()],
      status,
      kpi: {
        leads: leads.length,
        hot: leads.filter((l) => l.temperature === "hot").length,
        calls: calls.length,
        connected,
        rate: calls.length ? Math.round((connected / calls.length) * 100) : 0,
        whatsapp: messages.length,
        closed: leads.filter((l) => l.status === "closed").length,
      },
      recent: [...leads].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 6),
      activity,
    };
  }, [leads, calls, messages]);

  const k = data.kpi;
  const tiles = [
    { label: scope === "hq" ? "মোট লিড" : "আমার লিড", value: k.leads, icon: Users },
    { label: "হট লিড", value: k.hot, icon: Flame },
    { label: "মোট কল", value: k.calls, icon: Phone },
    { label: "কথা হওয়া কল", value: `${k.connected} (${k.rate}%)`, icon: PhoneCall },
    { label: "হোয়াটসঅ্যাপ", value: k.whatsapp, icon: MessageCircle },
    { label: "বন্ধ লিড", value: k.closed, icon: CheckCircle2 },
  ];

  return (
    <section className="space-y-4" aria-label="চার্ট ড্যাশবোর্ড">
      <div>
        <h2 className="text-lg font-semibold">চার্ট ড্যাশবোর্ড</h2>
        <p className="text-sm text-muted-foreground">
          {scope === "hq" ? "পুরো টিমের আসল লিড ও কল" : "শুধু আপনার আসল লিড ও কল"} · শেষ {DAYS} দিন
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {tiles.map((t) => (
          <div key={t.label} className="card-elevated min-w-0 p-3">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <t.icon className="size-3.5 shrink-0" /> <span className="truncate">{t.label}</span>
            </div>
            <div className="mt-1 text-xl font-semibold tabular-nums">{isPending ? "—" : t.value}</div>
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="card-elevated min-w-0 p-3 lg:col-span-2">
          <h3 className="mb-2 text-sm font-medium">দৈনিক লিড ও কল</h3>
          <div className="h-60">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.trend} margin={{ left: -20, right: 8, top: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" strokeOpacity={0.6} vertical={false} />
                <XAxis dataKey="day" {...axis} />
                <YAxis allowDecimals={false} {...axis} />
                <Tooltip {...tip} />
                <Area type="monotone" dataKey="calls" name="কল" stroke="var(--chart-1)" fill="var(--chart-1)" fillOpacity={0.15} />
                <Area type="monotone" dataKey="connected" name="কথা হয়েছে" stroke="var(--chart-2)" fill="var(--chart-2)" fillOpacity={0.15} />
                <Area type="monotone" dataKey="leads" name="নতুন লিড" stroke="var(--chart-3)" fill="var(--chart-3)" fillOpacity={0.1} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="card-elevated min-w-0 p-3">
          <h3 className="mb-2 text-sm font-medium">লিডের অবস্থা</h3>
          <div className="h-44">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={data.status} dataKey="value" nameKey="name" innerRadius={42} outerRadius={70} paddingAngle={2}>
                  {data.status.map((_, i) => <Cell key={i} fill={PIE_COLORS[i]} />)}
                </Pie>
                <Tooltip {...tip} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <ul className="mt-2 grid grid-cols-2 gap-1 text-xs">
            {data.status.map((s, i) => (
              <li key={s.name} className="flex items-center gap-1.5">
                <span className="size-2.5 rounded-sm" style={{ background: PIE_COLORS[i] }} />
                <span className="truncate text-muted-foreground">{s.name}</span>
                <span className="ml-auto tabular-nums">{s.value}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="card-elevated min-w-0 p-3">
        <h3 className="mb-2 text-sm font-medium">দৈনিক হোয়াটসঅ্যাপ</h3>
        <div className="h-40">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.trend} margin={{ left: -20, right: 8, top: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" strokeOpacity={0.6} vertical={false} />
              <XAxis dataKey="day" {...axis} />
              <YAxis allowDecimals={false} {...axis} />
              <Tooltip {...tip} />
              <Bar dataKey="whatsapp" name="মেসেজ" fill="var(--chart-4)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card-elevated min-w-0 p-3">
          <h3 className="mb-2 text-sm font-medium">সাম্প্রতিক লিড</h3>
          {data.recent.length === 0 ? (
            <p className="py-4 text-sm text-muted-foreground">এখনো কোনো লিড নেই</p>
          ) : (
            <ul className="divide-y divide-border">
              {data.recent.map((l) => (
                <li key={l.id} className="flex items-center gap-2 py-2 text-sm">
                  <span className="min-w-0 flex-1 truncate font-medium">{l.name}</span>
                  <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-xs">{STATUS_LABEL[l.status] ?? l.status}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">{relativeTime(l.created_at)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="card-elevated min-w-0 p-3">
          <h3 className="mb-2 text-sm font-medium">কল ও হোয়াটসঅ্যাপ কার্যকলাপ</h3>
          {data.activity.length === 0 ? (
            <p className="py-4 text-sm text-muted-foreground">এখনো কোনো কার্যকলাপ নেই</p>
          ) : (
            <ul className="divide-y divide-border">
              {data.activity.map((a) => (
                <li key={a.id} className="flex items-center gap-2 py-2 text-sm">
                  {a.kind === "call" ? <Phone className="size-4 shrink-0 text-muted-foreground" /> : <MessageCircle className="size-4 shrink-0 text-muted-foreground" />}
                  <span className="min-w-0 flex-1 truncate">{a.text}</span>
                  {a.kind === "call" && (
                    <span className="shrink-0 text-xs text-muted-foreground">{a.ok ? "কথা হয়েছে" : "কথা হয়নি"}</span>
                  )}
                  <span className="shrink-0 text-xs text-muted-foreground">{relativeTime(a.at)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}
