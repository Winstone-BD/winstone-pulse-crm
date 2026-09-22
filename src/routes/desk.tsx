import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowDownRight,
  ArrowUpRight,
  Clock,
  LogIn,
  MessageCircle,
  PhoneCall,
  Timer,
  Users,
} from "lucide-react";
import { useMemo, useState } from "react";

import { DeskCommandCenter } from "@/components/crm/desk/DeskCommandCenter";
import { AppShell } from "@/components/crm/AppShell";
import { CommandAgentPanel } from "@/components/crm/CommandAgentPanel";
import { MyCallLog } from "@/components/crm/MyCallLog";
import { MyPhoneSetup } from "@/components/crm/MyPhoneSetup";
import { MyProfileCard } from "@/components/crm/MyProfileCard";
import { CarryOverLeads } from "@/components/crm/CarryOverLeads";
import { LeadDayBoard } from "@/components/crm/LeadDayBoard";
import { FollowUpAlarm } from "@/components/crm/FollowUpAlarm";
import { FollowUpCalendar } from "@/components/crm/FollowUpCalendar";
import { FollowUpWeek } from "@/components/crm/FollowUpWeek";
import { MyReports } from "@/components/crm/MyReports";
import { NewLeadDialog } from "@/components/crm/NewLeadDialog";
import { LeadImportDialog } from "@/components/crm/LeadImportDialog";
import { LeadDeadlineBanner } from "@/components/crm/LeadDeadlineBanner";
import { LeadTable } from "@/components/crm/LeadTable";
import { MobileLeadQueue } from "@/components/crm/MobileLeadQueue";
import { OpenLeadsCard } from "@/components/crm/OpenLeadsCard";
import { QueueBoard } from "@/components/crm/QueueBoard";
import { SmartInsightStrip } from "@/components/crm/SmartInsightStrip";
import { TeamSupportInbox } from "@/components/crm/TeamSupportInbox";
import { TeamSupportPanel } from "@/components/crm/TeamSupportPanel";
import { SnapshotSkeleton } from "@/components/crm/SnapshotSkeleton";
import { WhatsappInbox } from "@/components/crm/WhatsappInbox";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CONNECTED_THRESHOLD_SECONDS, useSnapshot } from "@/lib/crm-data";
import { formatTalkTime } from "@/lib/crm-format";
import { useMyAccount, useSignOut } from "@/lib/session";

export const Route = createFileRoute("/desk")({
  head: () => ({
    meta: [
      { title: "আমার ডেস্ক — Winstone Connect" },
      {
        name: "description",
        content:
          "নিজের লিড তালিকা, কল রেকর্ড, হোয়াটসঅ্যাপ ইনবক্স আর নতুন লিড জমা দেওয়ার জায়গা — সব এক ডেস্কে।",
      },
      { property: "og:title", content: "আমার ডেস্ক — Winstone Connect" },
      {
        property: "og:description",
        content: "এক চাপে কল, হোয়াটসঅ্যাপ কথা আর নিজের লিড — Winstone Connect এজেন্ট ডেস্ক।",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: DeskPage,
});

/** Desk sections, mapped to the existing tab values — no new routes. */
const SECTION_RAIL = [
  { tab: "leads", label: "লিড ড্যাশবোর্ড" },
  { tab: "queue", label: "কার্ড ভিউ" },
  { tab: "calls", label: "কল রেকর্ড" },
  { tab: "whatsapp", label: "হোয়াটসঅ্যাপ" },
  { tab: "calendar", label: "ফলো-আপ" },
  { tab: "reports", label: "আমার রিপোর্ট" },
  { tab: "support", label: "টিম সাপোর্ট" },
] as const;

/** Live counters for the agent's own day, each compared with yesterday. */
function DeskStats() {
  const { leads, calls, messages } = useSnapshot();

  const stats = useMemo(() => {
    const now = new Date();
    const today = now.toDateString();
    const yesterday = new Date(now.getTime() - 86_400_000).toDateString();
    const onDay = <T extends { created_at: string }>(rows: T[], day: string) =>
      rows.filter((r) => new Date(r.created_at).toDateString() === day);

    const todayCalls = onDay(calls, today);
    const yCalls = onDay(calls, yesterday);
    const talk = todayCalls.reduce((sum, c) => sum + c.duration_seconds, 0);
    const yTalk = yCalls.reduce((sum, c) => sum + c.duration_seconds, 0);
    const connectedOf = (rows: typeof calls) =>
      rows.filter((c) => c.duration_seconds > CONNECTED_THRESHOLD_SECONDS).length;
    return {
      leads: leads.length,
      pending: leads.filter((l) => l.status === "pending").length,
      calls: todayCalls.length,
      callsDelta: todayCalls.length - yCalls.length,
      connected: connectedOf(todayCalls),
      connectRate: todayCalls.length
        ? Math.round((connectedOf(todayCalls) / todayCalls.length) * 100)
        : 0,
      talk,
      talkDelta: Math.round((talk - yTalk) / 60),
      whatsapp: onDay(messages, today).length,
      whatsappDelta: onDay(messages, today).length - onDay(messages, yesterday).length,
      done: leads.filter((l) => l.work_state === "completed").length,
    };
  }, [leads, calls, messages]);

  const donePct = stats.leads ? Math.round((stats.done / stats.leads) * 100) : 0;

  return (
    <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <Tile
        icon={<Users className="size-4" />}
        label="আমার লিড"
        value={String(stats.leads)}
        hint={`${stats.pending}টি এখনো বাকি`}
        progress={donePct}
        progressLabel={`${donePct}% কাজ শেষ`}
      />
      <Tile
        icon={<PhoneCall className="size-4" />}
        label="আজকের কল"
        value={String(stats.calls)}
        hint={`${stats.connected}টিতে কথা হয়েছে · ${stats.connectRate}%`}
        delta={stats.callsDelta}
        deltaUnit="টি"
      />
      <Tile
        icon={<Timer className="size-4" />}
        label="আজকের কথার সময়"
        value={formatTalkTime(stats.talk)}
        hint="সব কল মিলিয়ে"
        delta={stats.talkDelta}
        deltaUnit=" মিনিট"
      />
      <Tile
        icon={<MessageCircle className="size-4" />}
        label="আজকের হোয়াটসঅ্যাপ"
        value={String(stats.whatsapp)}
        hint="মেসেজ আদান-প্রদান"
        delta={stats.whatsappDelta}
        deltaUnit="টি"
      />
    </dl>
  );
}

function Tile({
  icon,
  label,
  value,
  hint,
  delta,
  deltaUnit = "",
  progress,
  progressLabel,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint: string;
  delta?: number;
  deltaUnit?: string;
  progress?: number;
  progressLabel?: string;
}) {
  return (
    <div className="card-elevated relative overflow-hidden p-3">
      <span
        aria-hidden
        className="pointer-events-none absolute -right-6 -top-6 size-16 rounded-full bg-primary/10 blur-xl"
      />
      <dt className="flex items-center gap-2 text-xs text-muted-foreground">
        {icon}
        {label}
      </dt>
      <dd className="tabular mt-1 flex flex-wrap items-baseline gap-2 text-xl font-bold">
        {value}
        {delta !== undefined && delta !== 0 && (
          <span
            className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
              delta > 0 ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"
            }`}
          >
            {delta > 0 ? <ArrowUpRight className="size-3" /> : <ArrowDownRight className="size-3" />}
            {Math.abs(delta)}
            {deltaUnit}
          </span>
        )}
      </dd>
      <p className="text-[11px] text-muted-foreground">{hint}</p>
      {progress !== undefined && (
        <>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
            />
          </div>
          {progressLabel && (
            <p className="mt-1 text-[10px] text-muted-foreground">{progressLabel}</p>
          )}
        </>
      )}
    </div>
  );
}

function DeskPage() {
  const { account, scope, isPending } = useMyAccount();
  const signOut = useSignOut();
  const [tab, setTab] = useState<string>("leads");

  if (isPending) {
    return (
      <AppShell>
        <SnapshotSkeleton />
      </AppShell>
    );
  }

  if (scope === "none") {
    return (
      <AppShell>
        <div className="mx-auto flex max-w-md flex-col items-center gap-4 rounded-2xl border border-border bg-card px-6 py-14 text-center">
          <span className="grid size-14 place-items-center rounded-full bg-primary/15 text-primary">
            {account?.signedIn ? <Clock className="size-7" /> : <LogIn className="size-7" />}
          </span>
          {account?.signedIn ? (
            <>
              <div>
                <h1 className="text-2xl font-bold tracking-tight">
                  {account.approval === "rejected" ? "প্রবেশ বাতিল" : "অনুমোদনের অপেক্ষায়"}
                </h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  {account.approval === "rejected"
                    ? "একজন সুপারভাইজার এই অ্যাকাউন্ট বাতিল করেছেন। ভুল মনে হলে টিম লিডের সঙ্গে কথা বলুন।"
                    : "আপনার অ্যাকাউন্ট তৈরি হয়েছে। আইটি কনসোল বা এক্সিকিউটিভ এইচকিউ থেকে শীঘ্রই ডেস্ক খুলে দেওয়া হবে।"}
                </p>
              </div>
              <Button variant="secondary" onClick={() => void signOut()}>
                সাইন আউট
              </Button>
            </>
          ) : (
            <>
              <div>
                <h1 className="text-2xl font-bold tracking-tight">নিজের ডেস্কে সাইন ইন করুন</h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  এজেন্ট ও কোঅর্ডিনেটর নিজের ইমেইল ও পাসওয়ার্ড ব্যবহার করবেন।
                </p>
              </div>
              <Button asChild size="lg">
                <Link to="/auth" search={{ role: "agent", mode: "signin" }}>
                  <LogIn className="size-4" /> সাইন ইন
                </Link>
              </Button>
            </>
          )}
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="grid gap-4 xl:grid-cols-[186px_minmax(0,1fr)]">
        {/* Section rail — desktop-first shortcut to the desk's existing panels */}
        <nav className="hidden xl:block">
          <div className="card-elevated sticky top-20 space-y-1 p-2">
            <p className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              আমার ডেস্ক
            </p>
            {SECTION_RAIL.map((item) => (
              <button
                key={item.tab}
                type="button"
                onClick={() => {
                  setTab(item.tab);
                  document.getElementById("desk-tabs")?.scrollIntoView({ behavior: "smooth" });
                }}
                className={`w-full truncate rounded-lg px-2.5 py-2 text-left text-[12px] font-medium transition-colors ${
                  tab === item.tab
                    ? "bg-primary/12 text-primary"
                    : "text-muted-foreground hover:bg-surface-2 hover:text-foreground"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </nav>

        <div className="min-w-0 space-y-6">
          <LeadDeadlineBanner />
          <MyProfileCard />
          <MyPhoneSetup />

          <DeskCommandCenter
            onJumpTab={(next) => {
              setTab(next);
              document.getElementById("desk-tabs")?.scrollIntoView({ behavior: "smooth" });
            }}
            actions={
              <>
                <LeadImportDialog />
                <NewLeadDialog />
              </>
            }
          />

        <DeskStats />

        <SmartInsightStrip scope="desk" />

        <MobileLeadQueue />

        <FollowUpAlarm />

        <CarryOverLeads />

        <LeadDayBoard />

        <CommandAgentPanel surface="desk" />

        <TeamSupportInbox />

        <Tabs id="desk-tabs" value={tab} onValueChange={setTab} className="space-y-4">
          <TabsList className="flex w-full flex-wrap">
            <TabsTrigger value="leads">লিড ড্যাশবোর্ড</TabsTrigger>
            <TabsTrigger value="queue">কার্ড ভিউ</TabsTrigger>
            <TabsTrigger value="calls">কল রেকর্ড</TabsTrigger>
            <TabsTrigger value="whatsapp">হোয়াটসঅ্যাপ</TabsTrigger>
            <TabsTrigger value="calendar">ফলো-আপ</TabsTrigger>
            <TabsTrigger value="reports">আমার রিপোর্ট</TabsTrigger>
            <TabsTrigger value="support">টিম সাপোর্ট</TabsTrigger>
          </TabsList>
          <TabsContent value="support">
            <TeamSupportPanel />
          </TabsContent>
          <TabsContent value="leads" className="space-y-4">
            <LeadTable />
          </TabsContent>
          <TabsContent value="queue" className="space-y-4">
            <OpenLeadsCard />
            <QueueBoard
              title={scope === "agent" ? "আমার লিড" : "ফ্লোর কিউ"}
              canSeeAllAgents={scope !== "agent"}
              showManualLog={scope !== "agent"}
            />
          </TabsContent>
          <TabsContent value="calls">
            <MyCallLog />
          </TabsContent>
          <TabsContent value="whatsapp">
            <WhatsappInbox />
          </TabsContent>
          <TabsContent value="calendar" className="space-y-4">
            <FollowUpWeek />
            <FollowUpCalendar />
          </TabsContent>
          <TabsContent value="reports">
            <MyReports />
          </TabsContent>
          </Tabs>
        </div>
      </div>
    </AppShell>
  );
}
