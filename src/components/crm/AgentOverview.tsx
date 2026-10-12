import { dhakaDay } from "@/lib/lead-groups";
import { Link } from "@tanstack/react-router";
import {
  CalendarClock,
  Flame,
  MessageCircle,
  PhoneCall,
  PhoneOutgoing,
  Target,
  Timer,
  Trophy,
  UserPlus,
} from "lucide-react";
import { useMemo } from "react";

import { Button } from "@/components/ui/button";
import { CONNECTED_THRESHOLD_SECONDS, useSnapshot } from "@/lib/crm-data";
import { formatTalkTime } from "@/lib/crm-format";
import { useMyAccount } from "@/lib/session";
import { useT, useLang } from "@/lib/i18n";

function StatCard({
  icon,
  label,
  value,
  sub,
  progress,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  progress?: number;
}) {
  return (
    <div className="card-elevated p-3">
      <div className="flex items-center gap-2">
        <span className="grid size-8 shrink-0 place-items-center rounded-xl bg-primary/12 text-primary">
          {icon}
        </span>
        <p className="min-w-0 truncate text-[11px] font-medium text-muted-foreground">{label}</p>
      </div>
      <p className="tabular mt-2 text-xl font-bold leading-none">{value}</p>
      {sub && <p className="mt-1 text-[10px] text-muted-foreground">{sub}</p>}
      {progress !== undefined && (
        <div className="mt-2 flex items-center gap-2">
          <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
            <span
              className="block h-full rounded-full bg-primary transition-all"
              style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
            />
          </span>
          <span className="tabular text-[10px] text-muted-foreground">
            {Math.min(100, Math.max(0, Math.round(progress)))}%
          </span>
        </div>
      )}
    </div>
  );
}

/** Reference-style agent dashboard hero: greeting, KPI tiles, activity feed, quick actions. */
export function AgentOverview() {
  const t = useT();
  const lang = useLang();
  const { account } = useMyAccount();
  const { leads, calls, messages } = useSnapshot();

  const stats = useMemo(() => {
    const today = dhakaDay(new Date());
    const yesterday = dhakaDay(new Date(Date.now() - 86_400_000));
    const onDay = <T extends { created_at: string }>(rows: T[], day: string) =>
      rows.filter((r) => dhakaDay(new Date(r.created_at)) === day);

    const todayCalls = onDay(calls, today);
    const connected = todayCalls.filter(
      (c) => c.duration_seconds > CONNECTED_THRESHOLD_SECONDS,
    ).length;
    const newLeads = onDay(leads, today).length;
    const target = Math.max(leads.filter((l) => l.work_state !== "completed").length, 1);
    const done = leads.filter((l) => l.work_state === "completed").length;

    return {
      target,
      done,
      todayCalls: todayCalls.length,
      connected,
      connectRate: todayCalls.length ? Math.round((connected / todayCalls.length) * 100) : 0,
      talk: todayCalls.reduce((sum, c) => sum + c.duration_seconds, 0),
      newLeads,
      newLeadsDelta: newLeads - onDay(leads, yesterday).length,
      hot: leads.filter((l) => l.temperature === "hot").length,
      followUp: leads.filter((l) => l.status === "follow_up").length,
      whatsapp: onDay(messages, today).length,
    };
  }, [calls, leads, messages]);

  const score = stats.target ? Math.round((stats.done / stats.target) * 100) : 0;

  const activity = useMemo(() => {
    const rows = [
      ...calls.map((c) => ({
        id: `c-${c.id}`,
        at: c.created_at,
        title:
          c.duration_seconds > CONNECTED_THRESHOLD_SECONDS
            ? t({ bn: `কল হয়েছে · ${formatTalkTime(c.duration_seconds)}`, en: `Call connected · ${formatTalkTime(c.duration_seconds)}` })
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
        title: t({ bn: `নতুন লিড · ${l.name ?? "নামহীন"}`, en: `New lead · ${l.name ?? "Unnamed"}` }),
        icon: <UserPlus className="size-3.5" />,
      })),
    ];
    return rows
      .sort((a, b) => Date.parse(b.at) - Date.parse(a.at))
      .slice(0, 6)
      .map((row) => ({
        ...row,
        when: new Date(row.at).toLocaleTimeString(lang === "en" ? "en-GB" : "bn-BD", {
          hour: "2-digit",
          minute: "2-digit",
        }),
      }));
  }, [calls, leads, messages, t, lang]);

  const name = account?.profile?.name ?? t({ bn: "এজেন্ট", en: "Agent" });
  const employeeId = account?.profile?.employee_id ?? "";

  return (
    <section className="space-y-3">
      <div className="card-elevated flex flex-wrap items-end justify-between gap-3 p-4">
        <div>
          <h2 className="text-lg font-bold tracking-tight sm:text-xl">{t({ bn: "এজেন্ট ড্যাশবোর্ড", en: "Agent dashboard" })}</h2>
          <p className="text-xs text-muted-foreground">
            {t({ bn: "স্বাগতম,", en: "Welcome," })} <span className="font-semibold text-foreground">{name}</span>
            {employeeId ? ` (${employeeId})` : ""} — {t({ bn: "আজকের লক্ষ্য পূরণ করে ফেলুন!", en: "Hit today's target!" })}
          </p>
        </div>
        <p className="text-[11px] text-muted-foreground">
          {new Date().toLocaleDateString(lang === "en" ? "en-GB" : "bn-BD", {
            weekday: "long",
            day: "numeric",
            month: "long",
          })}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
        <StatCard
          icon={<Target className="size-4" />}
          label={t({ bn: "আজকের লক্ষ্য", en: "Today's target" })}
          value={`${stats.done} / ${stats.target}`}
          sub={t({ bn: "লিড শেষ", en: "Leads done" })}
          progress={score}
        />
        <StatCard
          icon={<PhoneOutgoing className="size-4" />}
          label={t({ bn: "আজকের কল", en: "Today's calls" })}
          value={String(stats.todayCalls)}
          sub={t({ bn: `${stats.connected}টিতে কথা · ${stats.connectRate}%`, en: `${stats.connected} connected · ${stats.connectRate}%` })}
          progress={stats.connectRate}
        />
        <StatCard
          icon={<UserPlus className="size-4" />}
          label={t({ bn: "নতুন লিড", en: "New leads" })}
          value={String(stats.newLeads)}
          sub={
            stats.newLeadsDelta === 0
              ? t({ bn: "গতকালের সমান", en: "Same as yesterday" })
              : t({
                  bn: `${stats.newLeadsDelta > 0 ? "+" : ""}${stats.newLeadsDelta} গতকালের চেয়ে`,
                  en: `${stats.newLeadsDelta > 0 ? "+" : ""}${stats.newLeadsDelta} vs yesterday`,
                })
          }
        />
        <StatCard
          icon={<Flame className="size-4" />}
          label={t({ bn: "হট লিড", en: "Hot leads" })}
          value={String(stats.hot)}
          sub={t({ bn: "অগ্রাধিকার দিন", en: "Prioritise these" })}
        />
        <StatCard
          icon={<CalendarClock className="size-4" />}
          label={t({ bn: "ফলো-আপ বাকি", en: "Follow-ups due" })}
          value={String(stats.followUp)}
          sub={t({ bn: "আজকের তালিকা", en: "Today's list" })}
        />
        <StatCard
          icon={<Trophy className="size-4" />}
          label={t({ bn: "আজকের স্কোর", en: "Today's score" })}
          value={`${score}%`}
          sub={score >= 80 ? t({ bn: "দুর্দান্ত!", en: "Excellent!" }) : score >= 50 ? t({ bn: "চালিয়ে যান", en: "Keep going" }) : t({ bn: "গতি বাড়ান", en: "Pick up the pace" })}
          progress={score}
        />
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        <div className="card-elevated p-4 lg:col-span-2">
          <h3 className="text-sm font-semibold">{t({ bn: "আজকের কাজের ধারা", en: "Today's activity stream" })}</h3>
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
              <li className="text-[11px] text-muted-foreground">{t({ bn: "আজ এখনো কোনো কাজ নেই।", en: "No activity yet today." })}</li>
            )}
          </ul>
        </div>

        <div className="card-elevated space-y-3 p-4">
          <h3 className="text-sm font-semibold">{t({ bn: "দ্রুত কাজ", en: "Quick actions" })}</h3>
          <div className="grid gap-2">
            <Button asChild size="sm" className="justify-start">
              <Link to="/desk" hash="leads">
                <PhoneCall className="size-4" /> {t({ bn: "কল শুরু করুন", en: "Start calling" })}
              </Link>
            </Button>
            <Button asChild size="sm" variant="secondary" className="justify-start">
              <Link to="/desk" hash="calendar">
                <CalendarClock className="size-4" /> {t({ bn: "ফলো-আপ দেখুন", en: "View follow-ups" })}
              </Link>
            </Button>
            <Button asChild size="sm" variant="secondary" className="justify-start">
              <Link to="/desk" hash="whatsapp">
                <MessageCircle className="size-4" /> {t({ bn: "হোয়াটসঅ্যাপ ইনবক্স", en: "WhatsApp inbox" })}
              </Link>
            </Button>
          </div>
          <div className="rounded-xl bg-muted/50 p-3">
            <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <Timer className="size-3.5" /> {t({ bn: "আজকের কথার সময়", en: "Today's talk time" })}
            </p>
            <p className="tabular mt-1 text-lg font-bold">{formatTalkTime(stats.talk)}</p>
            <p className="text-[10px] text-muted-foreground">
              {t({ bn: `${stats.whatsapp}টি হোয়াটসঅ্যাপ মেসেজ আজ`, en: `${stats.whatsapp} WhatsApp messages today` })}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
