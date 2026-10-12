import { useMemo, useState } from "react";
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
import { ErrorState } from "@/components/crm/DataState";
import { StatCard } from "@/components/crm/ui-kit";
import { useT } from "@/lib/i18n";

const dhakaKey = (iso: string) =>
  new Date(iso).toLocaleDateString("en-CA", { timeZone: "Asia/Dhaka" });
const todayKey = () => dhakaKey(new Date().toISOString());
const addDays = (key: string, n: number) => {
  const d = new Date(key + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const STATUS_LABEL: Record<string, { bn: string; en: string }> = {
  pending: { bn: "নতুন / বাকি", en: "New / pending" },
  contacted: { bn: "কথা হয়েছে", en: "Contacted" },
  follow_up: { bn: "ফলো-আপ", en: "Follow-up" },
  closed: { bn: "বন্ধ", en: "Closed" },
};
const STAGE_LABEL: Record<string, { bn: string; en: string }> = {
  pending: { bn: "অপেক্ষমাণ", en: "Pending" },
  contacted: { bn: "যোগাযোগ হয়েছে", en: "Contacted" },
  follow_up: { bn: "ফলো-আপ", en: "Follow-up" },
  closed: { bn: "বন্ধ হয়েছে", en: "Closed" },
};
const PIE_COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)"];
const STAGE_COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-4)", "var(--primary)"];
const axis = { stroke: "var(--border)", tick: { fill: "var(--muted-foreground)", fontSize: 11 }, tickLine: false };
const tip = {
  contentStyle: { background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--popover-foreground)", fontSize: 12 },
};

type Preset = "today" | "7" | "14" | "30" | "all" | "custom";
const PRESETS: { id: Preset; label: { bn: string; en: string } }[] = [
  { id: "today", label: { bn: "আজ", en: "Today" } },
  { id: "7", label: { bn: "৭ দিন", en: "7 days" } },
  { id: "14", label: { bn: "১৪ দিন", en: "14 days" } },
  { id: "30", label: { bn: "৩০ দিন", en: "30 days" } },
  { id: "all", label: { bn: "সব সময়", en: "All time" } },
  { id: "custom", label: { bn: "কাস্টম", en: "Custom" } },
];

/**
 * Charts dashboard built only from the role-scoped CRM snapshot:
 * HQ sees the whole floor, an agent sees only their own leads and calls.
 * A date-range filter (Dhaka dates) scopes every KPI, chart and list.
 */
export function SalesChartsDashboard({ scope }: { scope: "hq" | "agent" }) {
  const t = useT();
  const { leads, calls, messages, isPending, isError, refetch } = useSnapshot();
  const [preset, setPreset] = useState<Preset>("14");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const range = useMemo((): { from: string | null; to: string | null } => {
    const today = todayKey();
    if (preset === "today") return { from: today, to: today };
    if (preset === "7") return { from: addDays(today, -6), to: today };
    if (preset === "14") return { from: addDays(today, -13), to: today };
    if (preset === "30") return { from: addDays(today, -29), to: today };
    if (preset === "custom") {
      const f = from || null;
      const tt = to || null;
      return f && tt && f > tt ? { from: tt, to: f } : { from: f, to: tt };
    }
    return { from: null, to: null };
  }, [preset, from, to]);

  const data = useMemo(() => {
    const inRange = (iso: string) => {
      const k = dhakaKey(iso);
      return (!range.from || k >= range.from) && (!range.to || k <= range.to);
    };
    const fLeads = leads.filter((l) => inRange(l.created_at));
    const fCalls = calls.filter((c) => inRange(c.started_at ?? c.created_at));
    const fMsgs = messages.filter((m) => inRange(m.created_at));

    const row = new Map<string, { day: string; leads: number; calls: number; connected: number; whatsapp: number }>();
    if (range.from && range.to) {
      for (let d = range.from; d <= range.to; d = addDays(d, 1))
        row.set(d, { day: d.slice(5), leads: 0, calls: 0, connected: 0, whatsapp: 0 });
    }
    const bump = (iso: string, fn: (r: { leads: number; calls: number; connected: number; whatsapp: number }) => void) => {
      const k = dhakaKey(iso);
      let r = row.get(k);
      if (!r) {
        r = { day: k.slice(5), leads: 0, calls: 0, connected: 0, whatsapp: 0 };
        row.set(k, r);
      }
      fn(r);
    };
    for (const l of fLeads) bump(l.created_at, (r) => r.leads++);
    for (const c of fCalls)
      bump(c.started_at ?? c.created_at, (r) => {
        r.calls++;
        if (c.duration_seconds >= CONNECTED_THRESHOLD_SECONDS) r.connected++;
      });
    for (const m of fMsgs) bump(m.created_at, (r) => r.whatsapp++);
    const trend = [...row.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, v]) => v);

    const status = Object.keys(STATUS_LABEL).map((k) => ({ name: t(STATUS_LABEL[k]!), value: fLeads.filter((l) => l.status === k).length }));
    const stage = Object.keys(STAGE_LABEL).map((k) => ({ name: t(STAGE_LABEL[k]!), value: fLeads.filter((l) => l.status === k).length }));
    const connected = fCalls.filter((c) => c.duration_seconds >= CONNECTED_THRESHOLD_SECONDS).length;
    const activity = [
      ...fCalls.map((c) => ({ id: "c" + c.id, kind: "call" as const, at: c.started_at ?? c.created_at, text: c.phone_number, ok: c.duration_seconds >= CONNECTED_THRESHOLD_SECONDS })),
      ...fMsgs.map((m) => ({ id: "m" + m.id, kind: "wa" as const, at: m.created_at, text: m.sender_type === "customer" ? t({ bn: "গ্রাহকের মেসেজ", en: "Customer message" }) : t({ bn: "এজেন্টের মেসেজ", en: "Agent message" }), ok: true })),
    ].sort((a, b) => b.at.localeCompare(a.at)).slice(0, 8);
    return {
      trend,
      status,
      stage,
      kpi: {
        leads: fLeads.length,
        hot: fLeads.filter((l) => l.temperature === "hot").length,
        calls: fCalls.length,
        connected,
        rate: fCalls.length ? Math.round((connected / fCalls.length) * 100) : 0,
        whatsapp: fMsgs.length,
        closed: fLeads.filter((l) => l.status === "closed").length,
      },
      recent: [...fLeads].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 6),
      activity,
    };
  }, [leads, calls, messages, range, t]);

  const k = data.kpi;
  const tiles = [
    { label: scope === "hq" ? t({ bn: "মোট লিড", en: "Total leads" }) : t({ bn: "আমার লিড", en: "My leads" }), value: k.leads, icon: Users, tone: "primary" as const },
    { label: t({ bn: "হট লিড", en: "Hot leads" }), value: k.hot, icon: Flame, tone: "destructive" as const },
    { label: t({ bn: "মোট কল", en: "Total calls" }), value: k.calls, icon: Phone, tone: "accent" as const },
    { label: t({ bn: "কথা হওয়া কল", en: "Connected calls" }), value: `${k.connected} (${k.rate}%)`, icon: PhoneCall, tone: "live" as const },
    { label: t({ bn: "হোয়াটসঅ্যাপ", en: "WhatsApp" }), value: k.whatsapp, icon: MessageCircle, tone: "chart4" as const },
    { label: t({ bn: "বন্ধ লিড", en: "Closed leads" }), value: k.closed, icon: CheckCircle2, tone: "muted" as const },
  ];
  const rangeLabel =
    preset === "all" ? t({ bn: "সব সময়", en: "All time" })
    : preset === "custom" ? (range.from || range.to ? `${range.from ?? t({ bn: "শুরু", en: "Start" })} → ${range.to ?? t({ bn: "আজ", en: "Today" })}` : t({ bn: "তারিখ বেছে নিন", en: "Pick dates" }))
    : range.from === range.to ? range.from!
    : `${range.from} → ${range.to}`;

  return (
    <section className="space-y-4" aria-label={t({ bn: "চার্ট ড্যাশবোর্ড", en: "Charts dashboard" })}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">{t({ bn: "চার্ট ড্যাশবোর্ড", en: "Charts dashboard" })}</h2>
          <p className="text-sm text-muted-foreground">
            {scope === "hq" ? t({ bn: "পুরো টিমের আসল লিড ও কল", en: "Live leads and calls for the whole team" }) : t({ bn: "শুধু আপনার আসল লিড ও কল", en: "Only your live leads and calls" })} · {rangeLabel}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setPreset(p.id)}
              className={`min-h-9 rounded-full border px-3 text-xs font-medium transition-colors ${
                preset === p.id
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card text-muted-foreground hover:text-foreground"
              }`}
            >
              {t(p.label)}
            </button>
          ))}
        </div>
      </div>

      {preset === "custom" && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <label className="flex items-center gap-1.5 text-muted-foreground">
            {t({ bn: "থেকে", en: "From" })}
            <input
              type="date"
              value={from}
              max={to || todayKey()}
              onChange={(e) => setFrom(e.target.value)}
              className="min-h-9 rounded-md border border-border bg-card px-2 text-foreground"
            />
          </label>
          <label className="flex items-center gap-1.5 text-muted-foreground">
            {t({ bn: "পর্যন্ত", en: "To" })}
            <input
              type="date"
              value={to}
              min={from || undefined}
              max={todayKey()}
              onChange={(e) => setTo(e.target.value)}
              className="min-h-9 rounded-md border border-border bg-card px-2 text-foreground"
            />
          </label>
        </div>
      )}

      {isError && <ErrorState onRetry={refetch} />}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6" aria-busy={isPending}>
        {tiles.map((tile) => (
          <StatCard
            key={tile.label}
            label={tile.label}
            value={isError ? "—" : tile.value}
            icon={<tile.icon />}
            tone={tile.tone}
            loading={isPending}
          />
        ))}
      </div>

      <div className="rounded-2xl border bg-card p-4">
        <h3 className="text-base font-semibold">{t({ bn: "ধাপ অনুযায়ী লিড", en: "Leads by stage" })}</h3>
        <div className="mt-2 h-52 min-w-0">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.stage} layout="vertical" margin={{ left: 8, right: 16, top: 4, bottom: 4 }}>
              <CartesianGrid stroke="var(--border)" strokeOpacity={0.5} horizontal={false} />
              <XAxis type="number" allowDecimals={false} {...axis} />
              <YAxis type="category" dataKey="name" width={96} {...axis} />
              <Tooltip {...tip} />
              <Bar dataKey="value" name={t({ bn: "লিড", en: "Leads" })} radius={[0, 4, 4, 0]}>
                {data.stage.map((_, i) => <Cell key={i} fill={STAGE_COLORS[i % STAGE_COLORS.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="card-elevated min-w-0 p-3 lg:col-span-2">
          <h3 className="mb-2 text-sm font-medium">{t({ bn: "দৈনিক লিড ও কল", en: "Daily leads and calls" })}</h3>
          <div className="h-60">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.trend} margin={{ left: -20, right: 8, top: 4 }}>
                <CartesianGrid stroke="var(--border)" strokeOpacity={0.5} vertical={false} />
                <XAxis dataKey="day" {...axis} />
                <YAxis allowDecimals={false} {...axis} />
                <Tooltip {...tip} />
                <Area type="monotone" dataKey="calls" name={t({ bn: "কল", en: "Calls" })} stroke="var(--chart-1)" fill="var(--chart-1)" fillOpacity={0.15} />
                <Area type="monotone" dataKey="connected" name={t({ bn: "কথা হয়েছে", en: "Connected" })} stroke="var(--chart-2)" fill="var(--chart-2)" fillOpacity={0.15} />
                <Area type="monotone" dataKey="leads" name={t({ bn: "নতুন লিড", en: "New leads" })} stroke="var(--chart-3)" fill="var(--chart-3)" fillOpacity={0.1} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="card-elevated min-w-0 p-3">
          <h3 className="mb-2 text-sm font-medium">{t({ bn: "লিডের অবস্থা", en: "Lead status" })}</h3>
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
        <h3 className="mb-2 text-sm font-medium">{t({ bn: "দৈনিক হোয়াটসঅ্যাপ", en: "Daily WhatsApp" })}</h3>
        <div className="h-40">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.trend} margin={{ left: -20, right: 8, top: 4 }}>
              <CartesianGrid stroke="var(--border)" strokeOpacity={0.5} vertical={false} />
              <XAxis dataKey="day" {...axis} />
              <YAxis allowDecimals={false} {...axis} />
              <Tooltip {...tip} />
              <Bar dataKey="whatsapp" name={t({ bn: "মেসেজ", en: "Messages" })} fill="var(--chart-4)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card-elevated min-w-0 p-3">
          <h3 className="mb-2 text-sm font-medium">{t({ bn: "সাম্প্রতিক লিড", en: "Recent leads" })}</h3>
          {data.recent.length === 0 ? (
            <p className="py-4 text-sm text-muted-foreground">{t({ bn: "এই সময়ে কোনো লিড নেই", en: "No leads in this period" })}</p>
          ) : (
            <ul className="divide-y divide-border">
              {data.recent.map((l) => (
                <li key={l.id} className="flex items-center gap-2 py-2 text-sm">
                  <span className="min-w-0 flex-1 truncate font-medium">{l.name}</span>
                  <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-xs">{STATUS_LABEL[l.status] ? t(STATUS_LABEL[l.status]!) : l.status}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">{relativeTime(l.created_at)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="card-elevated min-w-0 p-3">
          <h3 className="mb-2 text-sm font-medium">{t({ bn: "কল ও হোয়াটসঅ্যাপ কার্যকলাপ", en: "Call and WhatsApp activity" })}</h3>
          {data.activity.length === 0 ? (
            <p className="py-4 text-sm text-muted-foreground">{t({ bn: "এই সময়ে কোনো কার্যকলাপ নেই", en: "No activity in this period" })}</p>
          ) : (
            <ul className="divide-y divide-border">
              {data.activity.map((a) => (
                <li key={a.id} className="flex items-center gap-2 py-2 text-sm">
                  {a.kind === "call" ? <Phone className="size-4 shrink-0 text-muted-foreground" /> : <MessageCircle className="size-4 shrink-0 text-muted-foreground" />}
                  <span className="min-w-0 flex-1 truncate">{a.text}</span>
                  {a.kind === "call" && (
                    <span className="shrink-0 text-xs text-muted-foreground">{a.ok ? t({ bn: "কথা হয়েছে", en: "Connected" }) : t({ bn: "কথা হয়নি", en: "Not connected" })}</span>
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
