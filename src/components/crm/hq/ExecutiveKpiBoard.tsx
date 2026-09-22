import {
  AlertTriangle,
  CalendarClock,
  Flame,
  Handshake,
  PhoneCall,
  PhoneOutgoing,
  Radio,
  Target,
  TrendingUp,
  Users,
} from "lucide-react";
import { useMemo } from "react";

import {
  CONNECTED_THRESHOLD_SECONDS,
  type CallRecording,
  type Lead,
  type Profile,
  type WhatsappMessage,
} from "@/lib/crm-data";

type Tone = "gold" | "emerald" | "blue" | "amber" | "red";

const TONE_VAR: Record<Tone, string> = {
  gold: "var(--exec-gold)",
  emerald: "var(--exec-emerald)",
  blue: "var(--exec-blue)",
  amber: "var(--exec-amber)",
  red: "var(--exec-red)",
};

function KpiCard({
  tone,
  icon,
  label,
  value,
  hint,
  big,
}: {
  tone: Tone;
  icon: React.ReactNode;
  label: string;
  value: string;
  hint: string;
  big?: boolean;
}) {
  const accent = TONE_VAR[tone];
  return (
    <div
      className="card-elevated relative overflow-hidden p-4"
      style={{
        borderColor: `color-mix(in oklab, ${accent} 38%, transparent)`,
        background: `linear-gradient(160deg, color-mix(in oklab, ${accent} 12%, var(--card)) 0%, var(--card) 62%)`,
      }}
    >
      <span
        aria-hidden
        className="absolute inset-x-0 top-0 h-[3px]"
        style={{ background: accent }}
      />
      <div className="flex items-center justify-between gap-2">
        <p className="truncate text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        <span
          className="grid size-8 shrink-0 place-items-center rounded-xl"
          style={{
            background: `color-mix(in oklab, ${accent} 20%, transparent)`,
            color: accent,
          }}
        >
          {icon}
        </span>
      </div>
      <p
        className={`tabular mt-2 font-bold leading-none ${big ? "text-4xl" : "text-3xl"}`}
        style={{ color: accent }}
      >
        {value}
      </p>
      <p className="mt-1.5 truncate text-[11px] text-muted-foreground">{hint}</p>
    </div>
  );
}

function AlertPill({
  tone,
  label,
  value,
}: {
  tone: Tone;
  label: string;
  value: number;
}) {
  const accent = TONE_VAR[tone];
  return (
    <span
      className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[11px] font-semibold"
      style={{
        background: `color-mix(in oklab, ${accent} 16%, transparent)`,
        border: `1px solid color-mix(in oklab, ${accent} 42%, transparent)`,
        color: accent,
      }}
    >
      <span aria-hidden className="size-2 rounded-full" style={{ background: accent }} />
      <span className="tabular">{value.toLocaleString("bn-BD")}</span>
      <span className="font-medium text-foreground/85">{label}</span>
    </span>
  );
}

/**
 * Executive / investor presentation board: coloured KPI row, live floor strip,
 * alert badges and today's highlight summary. Read-only view over the snapshot.
 */
export function ExecutiveKpiBoard({
  profiles,
  leads,
  calls,
  messages,
}: {
  profiles: Profile[];
  leads: Lead[];
  calls: CallRecording[];
  messages: WhatsappMessage[];
}) {
  const m = useMemo(() => {
    const now = Date.now();
    const today = new Date().toDateString();
    const connected = calls.filter((c) => c.duration_seconds > CONNECTED_THRESHOLD_SECONDS);
    const contactedLeads = new Set(connected.map((c) => c.lead_id).filter(Boolean)).size;
    const hot = leads.filter((l) => l.temperature === "hot").length;
    const warm = leads.filter((l) => l.temperature === "warm").length;
    const qualified = hot + warm;
    const won = leads.filter(
      (l) => l.status === "closed" && l.outcome_category === "deal_won",
    ).length;
    const followUp = leads.filter((l) => l.status === "follow_up").length;
    const overdue = leads.filter((l) => {
      if (l.status !== "follow_up") return false;
      if (l.retry_after) return Date.parse(l.retry_after) < now;
      return now - Date.parse(l.last_call_at ?? l.updated_at) > 24 * 3_600_000;
    }).length;
    const uncalled = leads.filter(
      (l) => l.call_attempts === 0 && !(l.call_count ?? 0) && !l.last_call_at,
    ).length;
    const hotReady = leads.filter(
      (l) => l.temperature === "hot" && l.status !== "closed",
    ).length;
    const todayCalls = calls.filter((c) => new Date(c.created_at).toDateString() === today);
    const contactedToday = new Set(
      todayCalls
        .filter((c) => c.duration_seconds > CONNECTED_THRESHOLD_SECONDS)
        .map((c) => c.lead_id)
        .filter(Boolean),
    ).size;
    const floorAgents = profiles.filter(
      (p) =>
        (p.role === "agent" || p.role === "team_leader") &&
        p.is_active &&
        p.approval_status === "approved",
    );
    const waQueue = messages.filter(
      (msg) => now - Date.parse(msg.created_at) < 86_400_000,
    ).length;
    return {
      total: leads.length,
      contactedLeads,
      qualified,
      followUp,
      won,
      overdue,
      uncalled,
      hotReady,
      todayCallCount: todayCalls.length,
      contactedToday,
      liveCalls: floorAgents.filter((p) => p.presence === "on_call").length,
      activeAgents: floorAgents.filter((p) => p.presence !== "offline").length,
      totalAgents: floorAgents.length,
      waQueue,
      contactRate: leads.length ? Math.round((contactedLeads / leads.length) * 100) : 0,
      conversion: leads.length ? Math.round((won / leads.length) * 1000) / 10 : 0,
    };
  }, [calls, leads, messages, profiles]);

  const bn = (n: number) => n.toLocaleString("bn-BD");

  return (
    <section
      className="space-y-4 rounded-3xl border p-4 sm:p-5"
      style={{
        borderColor: "color-mix(in oklab, var(--exec-blue) 22%, var(--border))",
        background:
          "linear-gradient(170deg, color-mix(in oklab, var(--exec-navy) 55%, var(--background)) 0%, var(--background) 78%)",
      }}
    >
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-primary">
            Executive Control Board
          </p>
          <h2 className="text-lg font-bold sm:text-xl">এক্সিকিউটিভ পারফরম্যান্স বোর্ড</h2>
          <p className="text-[11px] text-muted-foreground">
            ম্যানেজমেন্ট, এইচকিউ ও ইনভেস্টর উপস্থাপনের জন্য লাইভ সারসংক্ষেপ।
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <AlertPill tone="red" value={m.overdue} label="ওভারডিউ ফলো-আপ" />
          <AlertPill tone="amber" value={m.uncalled} label="এখনো কল হয়নি" />
          <AlertPill tone="emerald" value={m.hotReady} label="হট লিড প্রস্তুত" />
        </div>
      </header>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
        <KpiCard
          tone="gold"
          big
          icon={<Users className="size-4" />}
          label="মোট লিড"
          value={bn(m.total)}
          hint="ডেটাবেজের সব লিড"
        />
        <KpiCard
          tone="emerald"
          icon={<PhoneCall className="size-4" />}
          label="যোগাযোগ হয়েছে"
          value={bn(m.contactedLeads)}
          hint={`${bn(m.contactRate)}% লিডে কথা হয়েছে`}
        />
        <KpiCard
          tone="blue"
          icon={<Target className="size-4" />}
          label="কোয়ালিফাইড"
          value={bn(m.qualified)}
          hint="হট + ওয়ার্ম লিড"
        />
        <KpiCard
          tone="amber"
          icon={<CalendarClock className="size-4" />}
          label="ফলো-আপ বাকি"
          value={bn(m.followUp)}
          hint={`${bn(m.overdue)}টি সময় পার হয়েছে`}
        />
        <KpiCard
          tone="gold"
          icon={<Handshake className="size-4" />}
          label="ডিল জেতা"
          value={bn(m.won)}
          hint="বুকিং সম্পন্ন"
        />
        <KpiCard
          tone="blue"
          icon={<TrendingUp className="size-4" />}
          label="রূপান্তরের হার"
          value={`${m.conversion.toLocaleString("bn-BD")}%`}
          hint="মোট লিডের তুলনায়"
        />
      </div>

      <div className="grid gap-3 lg:grid-cols-5">
        <div className="card-elevated p-4 lg:col-span-3">
          <div className="flex items-center gap-2">
            <Radio className="size-4 text-primary" />
            <h3 className="text-sm font-semibold">লাইভ ফ্লোর মনিটরিং</h3>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <FloorStat
              tone="red"
              icon={<PhoneOutgoing className="size-3.5" />}
              label="লাইভ কল"
              value={bn(m.liveCalls)}
            />
            <FloorStat
              tone="emerald"
              icon={<Users className="size-3.5" />}
              label="সক্রিয় এজেন্ট"
              value={`${bn(m.activeAgents)}/${bn(m.totalAgents)}`}
            />
            <FloorStat
              tone="blue"
              icon={<Flame className="size-3.5" />}
              label="আজকের কল"
              value={bn(m.todayCallCount)}
            />
            <FloorStat
              tone="amber"
              icon={<AlertTriangle className="size-3.5" />}
              label="হোয়াটসঅ্যাপ (২৪ ঘণ্টা)"
              value={bn(m.waQueue)}
            />
          </div>
        </div>

        <div className="card-elevated p-4 lg:col-span-2">
          <h3 className="text-sm font-semibold">আজকের হাইলাইটস</h3>
          <ul className="mt-2.5 space-y-1.5 text-[12px]">
            <Highlight label="মোট লিড" value={bn(m.total)} tone="gold" />
            <Highlight label="আজ কথা হয়েছে" value={bn(m.contactedToday)} tone="emerald" />
            <Highlight label="কোয়ালিফাইড" value={bn(m.qualified)} tone="blue" />
            <Highlight label="ফলো-আপ বাকি" value={bn(m.followUp)} tone="amber" />
            <Highlight label="ওভারডিউ ফলো-আপ" value={bn(m.overdue)} tone="red" />
            <Highlight label="এখনো কল হয়নি" value={bn(m.uncalled)} tone="amber" />
          </ul>
        </div>
      </div>
    </section>
  );
}

function FloorStat({
  tone,
  icon,
  label,
  value,
}: {
  tone: Tone;
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  const accent = TONE_VAR[tone];
  return (
    <div
      className="rounded-2xl p-3"
      style={{
        background: `color-mix(in oklab, ${accent} 10%, var(--surface))`,
        border: `1px solid color-mix(in oklab, ${accent} 30%, transparent)`,
      }}
    >
      <p className="flex items-center gap-1.5 text-[10px] font-medium text-muted-foreground">
        <span style={{ color: accent }}>{icon}</span>
        <span className="truncate">{label}</span>
      </p>
      <p className="tabular mt-1 text-xl font-bold" style={{ color: accent }}>
        {value}
      </p>
    </div>
  );
}

function Highlight({ label, value, tone }: { label: string; value: string; tone: Tone }) {
  return (
    <li className="flex items-center gap-2">
      <span
        aria-hidden
        className="size-1.5 shrink-0 rounded-full"
        style={{ background: TONE_VAR[tone] }}
      />
      <span className="min-w-0 flex-1 truncate text-muted-foreground">{label}</span>
      <span className="tabular font-semibold">{value}</span>
    </li>
  );
}
