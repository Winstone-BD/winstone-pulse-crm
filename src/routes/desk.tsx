import { MyNeglectNotice } from "@/components/crm/LeadNeglectPanel";
import { PhotoUpload } from "@/components/crm/PhotoUpload";
import { StaffAvatar } from "@/components/crm/StaffAvatar";
import { PAGE_SECTIONS, sectionSearch, useSection } from "@/lib/page-sections";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowDownRight,
  ArrowUpRight,
  ChevronDown,
  Clock,
  LogIn,
  MessageCircle,
  PhoneCall,
  Timer,
  Users,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useLang, useT } from "@/lib/i18n";


import { SalesChartsDashboard } from "@/components/crm/SalesChartsDashboard";
import { DeskCommandCenter } from "@/components/crm/desk/DeskCommandCenter";
import { SiteVisitReminder } from "@/components/crm/hq/SiteVisitsPanel";
import { AppShell } from "@/components/crm/AppShell";
import { CommandAgentPanel } from "@/components/crm/CommandAgentPanel";
import { MyCallLog } from "@/components/crm/MyCallLog";
import { MyPhoneSetup } from "@/components/crm/MyPhoneSetup";
import { MyProfileCard } from "@/components/crm/MyProfileCard";
import { CarryOverLeads } from "@/components/crm/CarryOverLeads";
import { LeadDayBoard } from "@/components/crm/LeadDayBoard";
import { ActivitiesView, OutlookView, PipelineBoard, TasksView } from "@/components/crm/desk/WorkViews";
import { FollowUpAlarm } from "@/components/crm/FollowUpAlarm";
import { FollowUpCalendar } from "@/components/crm/FollowUpCalendar";
import { FollowUpWeek } from "@/components/crm/FollowUpWeek";
import { DocSummaryPanel } from "@/components/crm/DocSummaryPanel";
import { MyReports } from "@/components/crm/MyReports";
import { NewLeadDialog } from "@/components/crm/NewLeadDialog";
import { LeadImportDialog } from "@/components/crm/LeadImportDialog";
import { LeadDeadlineBanner } from "@/components/crm/LeadDeadlineBanner";
import { OfficialNewsStrip, VisitRequestsPanel } from "@/components/crm/KnowledgeHubCards";
import { AccountabilityBanner, useMyAccountability } from "@/components/crm/AccountabilityBanner";
import { LeadTable } from "@/components/crm/LeadTable";
import { MobileLeadQueue } from "@/components/crm/MobileLeadQueue";
import { QueueBoard } from "@/components/crm/QueueBoard";
import { SmartInsightStrip } from "@/components/crm/SmartInsightStrip";
import { TeamSupportInbox } from "@/components/crm/TeamSupportInbox";
import { TeamSupportPanel } from "@/components/crm/TeamSupportPanel";
import { SnapshotSkeleton } from "@/components/crm/SnapshotSkeleton";
import { WhatsappInbox } from "@/components/crm/WhatsappInbox";
import { Button } from "@/components/ui/button";
import { DeskTabBar } from "@/components/crm/desk/DeskTabBar";
import { SocialDesk } from "@/components/crm/social/SocialDesk";
import { TodayHero } from "@/components/crm/desk/TodayHero";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CONNECTED_THRESHOLD_SECONDS, useSnapshot } from "@/lib/crm-data";
import { formatTalkTime } from "@/lib/crm-format";
import { dhakaDay, plausibleSeconds } from "@/lib/lead-groups";
import { useMyAccount, useSignOut } from "@/lib/session";
import { DeskRangeChip, useDeskRange } from "@/lib/desk-range";

export const Route = createFileRoute("/desk")({
  validateSearch: sectionSearch,
  head: () => ({
    meta: [
      { title: "আমার ডেস্ক — Winstone Pulse" },
      {
        name: "description",
        content:
          "নিজের লিড তালিকা, কল রেকর্ড, হোয়াটসঅ্যাপ ইনবক্স আর নতুন লিড জমা দেওয়ার জায়গা — সব এক ডেস্কে।",
      },
      { property: "og:title", content: "আমার ডেস্ক — Winstone Pulse" },
      {
        property: "og:description",
        content: "এক চাপে কল, হোয়াটসঅ্যাপ কথা আর নিজের লিড — Winstone Pulse এজেন্ট ডেস্ক।",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: DeskPage,
});

/** Live counters for the agent's own day, each compared with yesterday. */
function DeskStats() {
  const t = useT();
  const { leads, calls, messages } = useSnapshot();

  const stats = useMemo(() => {
    const now = new Date();
    // Dhaka business day, whatever timezone the device is set to.
    const today = dhakaDay(now);
    const yesterday = dhakaDay(now.getTime() - 86_400_000);
    const onDay = <T extends { created_at: string }>(rows: T[], day: string) =>
      rows.filter((r) => dhakaDay(r.created_at) === day);

    const todayCalls = onDay(calls, today);
    const yCalls = onDay(calls, yesterday);
    const talk = todayCalls.reduce((sum, c) => sum + plausibleSeconds(c.duration_seconds), 0);
    const yTalk = yCalls.reduce((sum, c) => sum + plausibleSeconds(c.duration_seconds), 0);
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
    <div className="grid gap-3 lg:grid-cols-[260px_minmax(0,1fr)]">
    <QuotaGauge done={stats.done} total={stats.leads} />
    <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <Tile
        icon={<Users className="size-4" />}
        label={t({ bn: "আমার লিড", en: "My leads" })}
        value={String(stats.leads)}
        hint={t({ bn: `${stats.pending}টি এখনো বাকি`, en: `${stats.pending} still pending` })}
        progress={donePct}
        progressLabel={t({ bn: `${donePct}% কাজ শেষ`, en: `${donePct}% done` })}
      />
      <Tile
        icon={<PhoneCall className="size-4" />}
        label={t({ bn: "আজকের কল", en: "Today's calls" })}
        value={String(stats.calls)}
        hint={t({ bn: `${stats.connected}টিতে কথা হয়েছে · ${stats.connectRate}%`, en: `${stats.connected} connected · ${stats.connectRate}%` })}
        delta={stats.callsDelta}
        deltaUnit={t({ bn: "টি", en: "" })}
      />
      <Tile
        icon={<Timer className="size-4" />}
        label={t({ bn: "আজকের কথার সময়", en: "Today's talk time" })}
        value={formatTalkTime(stats.talk)}
        hint={t({ bn: "সব কল মিলিয়ে", en: "Across all calls" })}
        delta={stats.talkDelta}
        deltaUnit={t({ bn: " মিনিট", en: " min" })}
      />
      <Tile
        icon={<MessageCircle className="size-4" />}
        label={t({ bn: "আজকের হোয়াটসঅ্যাপ", en: "Today's WhatsApp" })}
        value={String(stats.whatsapp)}
        hint={t({ bn: "মেসেজ আদান-প্রদান", en: "Messages exchanged" })}
        delta={stats.whatsappDelta}
        deltaUnit={t({ bn: "টি", en: "" })}
      />
    </dl>
    </div>
  );
}

/** Interactive daily-quota gauge: completed vs today's leads (tap toggles % / count). */
function QuotaGauge({ done, total }: { done: number; total: number }) {
  const t = useT();
  const [showCount, setShowCount] = useState(false);
  const pct = total ? Math.min(100, Math.round((done / total) * 100)) : 0;
  const r = 52;
  const c = Math.PI * r;
  const tone = pct >= 80 ? "var(--live)" : pct >= 40 ? "var(--primary)" : "var(--warning)";
  return (
    <button
      type="button"
      onClick={() => setShowCount((v) => !v)}
      className="card-elevated glass-panel flex flex-col items-center p-4 text-center transition-transform active:scale-[0.98]"
      aria-label={t({ bn: `দৈনিক কোটা ${pct}%`, en: `Daily quota ${pct}%` })}
    >
      <p className="text-xs font-semibold text-muted-foreground">{t({ bn: "আজকের কোটা অগ্রগতি", en: "Today's quota progress" })}</p>
      <svg viewBox="0 0 128 72" className="mt-2 w-44">
        <path d="M12 66 A52 52 0 0 1 116 66" fill="none" stroke="var(--muted)" strokeWidth="10" strokeLinecap="round" />
        <path
          d="M12 66 A52 52 0 0 1 116 66"
          fill="none"
          stroke={tone}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c - (c * pct) / 100}
          style={{ transition: "stroke-dashoffset 1s ease-out", filter: `drop-shadow(0 0 6px ${tone})` }}
        />
      </svg>
      <p className="tabular -mt-8 text-2xl font-bold">{showCount ? `${done}/${total}` : `${pct}%`}</p>
      <p className="mt-1 text-[11px] text-muted-foreground">
        {t({ bn: `${done}টি সম্পন্ন · ${Math.max(0, total - done)}টি বাকি · ছুঁয়ে দেখুন`, en: `${done} done · ${Math.max(0, total - done)} remaining · tap to toggle` })}
      </p>
    </button>
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

function QueueLockedNote() {
  const t = useT();
  return (
    <div role="status" className="mx-auto flex w-fit max-w-full items-center gap-3 rounded-full border border-warning/40 bg-gradient-to-r from-warning/20 to-destructive/20 px-4 py-2 text-xs font-medium text-foreground shadow-lg backdrop-blur-md sm:text-sm">
      <span className="size-2 shrink-0 animate-pulse rounded-full bg-warning" aria-hidden />
      {t({ bn: "আজকের লিড কিউ HQ পর্যালোচনার অপেক্ষায় — ফলো-আপ ও রিপোর্ট খোলা আছে", en: "Today's lead queue is awaiting HQ review — follow-ups and reports remain open" })}
    </div>
  );
}

function DeskPage() {
  const t = useT();
  const { account, scope, isPending } = useMyAccount();
  const signOut = useSignOut();
  const accountability = useMyAccountability();
  const queueLocked = scope === "agent" && Boolean(accountability.data?.locked);
  const [tabKey, setTabKey] = useSection("/desk");
  const tab: string = tabKey;
  const setTab = (next: string) => setTabKey(next as typeof tabKey);

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
                  {account.approval === "rejected"
                    ? t({ bn: "প্রবেশ বাতিল", en: "Access denied" })
                    : t({ bn: "অনুমোদনের অপেক্ষায়", en: "Awaiting approval" })}
                </h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  {account.approval === "rejected"
                    ? t({ bn: "একজন সুপারভাইজার এই অ্যাকাউন্ট বাতিল করেছেন। ভুল মনে হলে টিম লিডের সঙ্গে কথা বলুন।", en: "A supervisor has rejected this account. If this seems wrong, talk to your team lead." })
                    : t({ bn: "আপনার অ্যাকাউন্ট তৈরি হয়েছে। আইটি কনসোল বা এক্সিকিউটিভ এইচকিউ থেকে শীঘ্রই ডেস্ক খুলে দেওয়া হবে।", en: "Your account has been created. The desk will be unlocked soon from the IT Console or Executive HQ." })}
                </p>
              </div>
              <Button variant="secondary" onClick={() => void signOut()}>
                {t({ bn: "সাইন আউট", en: "Sign out" })}
              </Button>
            </>
          ) : (
            <>
              <div>
                <h1 className="text-2xl font-bold tracking-tight">{t({ bn: "নিজের ডেস্কে সাইন ইন করুন", en: "Sign in to your desk" })}</h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  {t({ bn: "এজেন্ট ও কোঅর্ডিনেটর নিজের ইমেইল ও পাসওয়ার্ড ব্যবহার করবেন।", en: "Agents and coordinators should use their own email and password." })}
                </p>
              </div>
              <Button asChild size="lg">
                <Link to="/auth" search={{ role: "agent", mode: "signin" }}>
                  <LogIn className="size-4" /> {t({ bn: "সাইন ইন", en: "Sign in" })}
                </Link>
              </Button>
            </>
          )}
        </div>
      </AppShell>
    );
  }

  if (scope === "agent" && account?.profile && !account.profile.has_photo) {
    return (
      <AppShell>
        <div className="mx-auto flex max-w-md flex-col items-center gap-4 rounded-2xl border border-border bg-card px-6 py-12 text-center">
          <StaffAvatar profile={account.profile} className="size-20" />
          <div>
            <h1 className="text-xl font-bold">{t({ bn: "আপনার ছবি যুক্ত করুন", en: "Add your photo" })}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {t({ bn: "প্রত্যেক এজেন্টের অ্যাকাউন্টে নিজের বর্তমান, পরিষ্কার মুখের ছবি থাকা বাধ্যতামূলক। ছবি দেওয়ার পরই ডেস্ক খুলবে ও কল করা যাবে।", en: "Every agent account must have a current, clear photo of their face. The desk unlocks and calls become possible only after the photo is added." })}
            </p>
          </div>
          <PhotoUpload />
          <p className="text-xs text-muted-foreground">{t({ bn: "সামনে থেকে, ভালো আলোয়, মুখ স্পষ্ট — সানগ্লাস বা গ্রুপ ছবি নয়।", en: "Front-facing, well lit, face clearly visible — no sunglasses or group photos." })}</p>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="hq-luxe grid gap-4 rounded-3xl p-3 pb-24 sm:p-5 md:pb-5">
        <div className="sticky top-28 z-30 sm:top-16"><DeskTabBar tab={tab} onChange={setTab} /></div>

        <div className="min-w-0 space-y-4 sm:space-y-6">
          <TodayHero name={account?.profile?.name ?? null} />

          <section aria-label={t({ bn: "সতর্কবার্তা", en: "Alerts" })} className="space-y-2">
            <AccountabilityBanner />
            <LeadDeadlineBanner />
            <MyNeglectNotice />
            <VisitRequestsPanel />
            <SiteVisitReminder />
          </section>

          {tab === "today" && (
            <>
          <OfficialNewsStrip />

          <details className="group card-elevated overflow-hidden">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-4 text-sm font-semibold [&::-webkit-details-marker]:hidden">
              {t({ bn: "প্রোফাইল ও ফোন সেটআপ", en: "Profile & phone setup" })}
              <ChevronDown className="size-4 text-muted-foreground transition-transform group-open:rotate-180" />
            </summary>
            <div className="space-y-4 border-t border-border p-3 sm:p-4">
              <MyProfileCard />
              <MyPhoneSetup />
            </div>
          </details>

          <SalesChartsDashboard scope="agent" />

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
            </>
          )}

        {tab === "today" && (
          <div className="space-y-4 sm:space-y-6">
        <DeskStats />

        <SmartInsightStrip scope="desk" />

        <FollowUpAlarm />

        {!queueLocked && (
          <details className="group card-elevated overflow-hidden">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-4 text-sm font-semibold tracking-wide [&::-webkit-details-marker]:hidden">
              <span className="flex items-center gap-2">
                <span className="size-2 rounded-full bg-primary" aria-hidden />
                {t({ bn: "আমার লিড কিউ", en: "My lead queue" })}
              </span>
              <ChevronDown className="size-4 text-primary transition-transform duration-300 group-open:rotate-180" />
            </summary>
            <div className="space-y-4 border-t border-border p-3 animate-in fade-in slide-in-from-top-2 duration-300 sm:p-4">
              <MobileLeadQueue />
              <CarryOverLeads />
              <LeadDayBoard />
            </div>
          </details>
        )}

        <CommandAgentPanel surface="desk" />

        <TeamSupportInbox />

          </div>
        )}

        <Tabs id="desk-tabs" value={tab} onValueChange={setTab} className="min-w-0 space-y-4">
          <TabsContent value="social">
            <SocialDesk />
          </TabsContent>
          <TabsContent value="support">
            <TeamSupportPanel />
          </TabsContent>
          <TabsContent value="leads" className="space-y-4">
            {queueLocked ? <QueueLockedNote /> : <LeadTable />}
          </TabsContent>
          <TabsContent value="queue" className="space-y-4">
            {queueLocked ? (
              <QueueLockedNote />
            ) : (
              <>
                {/* Self-claim retired: LeadHub Nexus is the only assignment path. */}
                <QueueBoard
                  title={t(scope === "agent" ? { bn: "আমার লিড", en: "My leads" } : { bn: "ফ্লোর কিউ", en: "Floor queue" })}
                  canSeeAllAgents={scope !== "agent"}
                  showManualLog={scope !== "agent"}
                />
              </>
            )}
          </TabsContent>
          <TabsContent value="pipeline">
            {queueLocked ? <QueueLockedNote /> : <PipelineBoard />}
          </TabsContent>
          <TabsContent value="tasks">
            <TasksView />
          </TabsContent>
          <TabsContent value="activities">
            <ActivitiesView />
          </TabsContent>
          <TabsContent value="outlook">
            <OutlookView />
          </TabsContent>
          <TabsContent value="calls">
            <MyCallLog />
          </TabsContent>
          <TabsContent value="whatsapp">
            <WhatsappInbox />
          </TabsContent>
          <TabsContent value="calendar" className="space-y-4">
            <FollowUpsInRange />
            <FollowUpWeek />
            <FollowUpCalendar />
          </TabsContent>
          <TabsContent value="reports" className="space-y-4">
            <MyReports />
            <DocSummaryPanel />
          </TabsContent>
          </Tabs>
        </div>
      </div>
    </AppShell>
  );
}

/** Follow-up leads whose last change falls inside the Command Center date range. */
function FollowUpsInRange() {
  const t = useT();
  const lang = useLang();
  const range = useDeskRange();
  const { leads } = useSnapshot();
  if (!range.active) return null;
  const rows = leads
    .filter((l) => l.status === "follow_up" && range.inRange(l.updated_at))
    .sort((a, b) => Date.parse(b.updated_at) - Date.parse(a.updated_at));
  return (
    <section className="card-elevated space-y-3 p-4" aria-label={t({ bn: "তারিখের সীমার ফলো-আপ", en: "Follow-ups in date range" })}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-bold">
          {t({ bn: "এই সময়ের ফলো-আপ", en: "Follow-ups in this range" })} ·{" "}
          {lang === "bn" ? rows.length.toLocaleString("bn-BD") : rows.length}
          {t({ bn: "টি", en: "" })}
        </h2>
        <DeskRangeChip />
      </div>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t({ bn: "এই তারিখের মধ্যে কোনো ফলো-আপ লিড নেই।", en: "No follow-up leads in this date range." })}</p>
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2">
          {rows.map((l) => (
            <li key={l.id} className="rounded-xl border border-border bg-card p-3">
              <p className="truncate font-semibold">{l.name}</p>
              <p className="truncate text-xs tabular-nums text-muted-foreground">
                {l.phone_number} · {t({ bn: "শেষ পরিবর্তন", en: "last updated" })}{" "}
                {new Date(l.updated_at).toLocaleDateString(lang === "bn" ? "bn-BD" : "en-GB", { timeZone: "Asia/Dhaka", day: "numeric", month: "short" })}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
