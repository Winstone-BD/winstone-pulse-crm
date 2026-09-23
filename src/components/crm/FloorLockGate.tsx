import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Clock,
  FileWarning,
  Lock,
  Mic,
  PhoneCall,
  ShieldAlert,
  ShieldCheck,
  Timer,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { getFloorLock } from "@/lib/floor-lock.functions";
import { useAdminToken } from "@/lib/local-session";
import {
  REVIEW_ALERTS,
  REVIEW_INSIGHT,
  REVIEW_PERIOD,
  REVIEW_ROWS,
  REVIEW_RULES,
  REVIEW_RULES_EN,
  REVIEW_TOTALS,
  SMART_CARD_IDS,
  SMART_STATUS_LABEL,
  type ReviewRow,
  type SmartStatus,
} from "@/lib/performance-review";

/** Dhaka clock label for the opening time. */
function dhakaLabel(iso: string) {
  return new Date(iso).toLocaleString("bn-BD", {
    timeZone: "Asia/Dhaka",
    day: "numeric",
    month: "long",
    hour: "numeric",
    minute: "2-digit",
  });
}

function useCountdown(iso: string) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);
  const ms = Math.max(0, new Date(iso).getTime() - now);
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  const s = Math.floor((ms % 60_000) / 1000);
  return `${h} ঘণ্টা ${m} মিনিট ${s} সেকেন্ড`;
}

/** One colour family per smart status, so the eye reads the signal before the text. */
const STATUS_STYLE: Record<SmartStatus, { chip: string; row: string; bar: string; text: string }> = {
  healthy: {
    chip: "border-live/40 bg-live/15 text-live",
    row: "bg-live/[0.04]",
    bar: "bg-live",
    text: "text-live",
  },
  review: {
    chip: "border-chart-4/40 bg-chart-4/15 text-chart-4",
    row: "bg-chart-4/[0.05]",
    bar: "bg-chart-4",
    text: "text-chart-4",
  },
  evidence_gap: {
    chip: "border-primary/40 bg-primary/15 text-primary",
    row: "bg-primary/[0.05]",
    bar: "bg-primary",
    text: "text-primary",
  },
  critical: {
    chip: "border-destructive/50 bg-destructive/15 text-destructive",
    row: "bg-destructive/[0.07]",
    bar: "bg-destructive",
    text: "text-destructive",
  },
};

/**
 * Blocking floor notice — Smart Performance UI.
 *
  * Until the floor opens (9:45 AM Dhaka) every signed-in desk is covered by this
 * board and nothing underneath can be used. It shows three separate signals per
 * desk (activity, evidence, integrity) rather than a single "worst agent" verdict.
 * After the floor opens the board disappears for everyone except accounts HQ has
 * flagged — they get a red notice telling them to get HQ approval first.
 */
export function FloorLockGate() {
  const adminToken = useAdminToken();
  const [dismissed, setDismissed] = useState(false);
  const lock = useQuery({
    queryKey: ["floor-lock", adminToken],
    queryFn: () => getFloorLock({ data: { adminToken } }),
    refetchInterval: 30_000,
    staleTime: 10_000,
  });

  const state = lock.data;
  const countdown = useCountdown(state?.openAt ?? new Date().toISOString());
  if (!state) return null;
  if (state.hqApprovalRequired) return <HqApprovalWall name={state.me?.name ?? ""} />;
  if (!state.reviewOpen || dismissed) return null;

  const cards = SMART_CARD_IDS.map((id) => REVIEW_ROWS.find((row) => row.employeeId === id)).filter(
    (row): row is ReviewRow => Boolean(row),
  );

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="ফ্লোর পারফরম্যান্স ইন্টেলিজেন্স বোর্ড"
      className="fixed inset-0 z-[120] overflow-y-auto bg-background/98 backdrop-blur-sm"
    >
      <div className="mx-auto w-full max-w-7xl space-y-5 px-4 py-8">
        <header className="overflow-hidden rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/15 via-destructive/10 to-chart-4/10 p-5">
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-destructive">
            <Lock className="size-4" /> ফ্লোর বন্ধ / Floor locked
          </p>
          <h1 className="mt-2 text-2xl font-bold sm:text-3xl">
            Smart Performance Intelligence — {REVIEW_PERIOD}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            আসল কল, আসল কথা, রেকর্ডিং আর লিড হ্যান্ডলিং থেকে তৈরি — কোনো অনুমান নয়। এটা লিডারবোর্ড নয়,
            কোন ডেটা প্যাটার্ন রিভিউ করা দরকার সেটাই দেখাচ্ছে।
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 font-semibold">
              <Clock className="size-3.5" /> খুলবে: {dhakaLabel(state.openAt)} (ঢাকা)
            </span>
            <span className="rounded-full border border-primary/40 bg-primary/15 px-3 py-1 font-semibold text-primary">
              বাকি {countdown}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-live/40 bg-live/10 px-3 py-1 text-xs font-semibold text-live">
              <Activity className="size-3.5" /> Evidence-based, live rules from 9:45
            </span>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            এই সময় পর্যন্ত CRM-এর কোনো অংশ ব্যবহার করা যাবে না। ৯টা ৪৫ মিনিটে সবার ড্যাশবোর্ড নিজেই খুলে
            যাবে — তবে যার প্যাটার্ন গুরুতর, তাকে হেড কোয়ার্টার থেকে অনুমোদন নিতে হবে।
          </p>
          {state.canDismiss && (
            <Button
              size="sm"
              variant="outline"
              className="mt-3 gap-1.5"
              onClick={() => setDismissed(true)}
            >
              <X className="size-3.5" /> HQ — নোটিশ বন্ধ করুন
            </Button>
          )}
        </header>

        {/* KPI pulse */}
        <section>
          <SectionTitle bn="টপ কেপিআই পালস" en="Top KPI Pulse" icon={BarChart3} />
          <div className="mt-2 grid gap-3 sm:grid-cols-3 lg:grid-cols-7">
            <Stat
              icon={PhoneCall}
              label="Assigned Leads"
              sub="মোট লিড"
              value={String(REVIEW_TOTALS.leads)}
              tone="primary"
            />
            <Stat
              icon={Activity}
              label="Real Conversations"
              sub="≥৬০ সেকেন্ড"
              value={String(REVIEW_TOTALS.realConversations)}
              tone="live"
            />
            <Stat
              icon={Timer}
              label="Talk Time"
              sub="মোট কথার সময়"
              value={REVIEW_TOTALS.talkTime}
              tone="live"
            />
            <Stat
              icon={Mic}
              label="Recordings"
              sub="মোট রেকর্ডিং"
              value={String(REVIEW_TOTALS.recordings)}
              tone="primary"
            />
            <Stat
              icon={AlertTriangle}
              label="<15s Connections"
              sub="প্রমাণহীন connected"
              value={String(REVIEW_TOTALS.fakeConnected)}
              tone="bad"
            />
            <Stat
              icon={FileWarning}
              label="Closed Without Report"
              sub="রিপোর্ট ছাড়া বন্ধ"
              value={String(REVIEW_TOTALS.closedWithoutReport)}
              tone="bad"
            />
            <Stat
              icon={ShieldCheck}
              label="Converted / Agent"
              sub="প্রতি এজেন্ট"
              value="≤ ৫"
              tone="warn"
            />
          </div>
        </section>

        {/* Matrix */}
        <section>
          <SectionTitle bn="এজেন্ট পারফরম্যান্স ম্যাট্রিক্স" en="Agent Performance Matrix" icon={Activity} />
          <div className="mt-2 overflow-x-auto rounded-2xl border border-border bg-card">
            <table className="w-full min-w-[880px] text-sm">
              <thead className="bg-surface-2/70 text-[11px] uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left">#</th>
                  <th className="px-3 py-2 text-left">Agent</th>
                  <th className="px-3 py-2 text-right">Leads</th>
                  <th className="px-3 py-2 text-right">Real Talk</th>
                  <th className="px-3 py-2 text-right">Talk Time</th>
                  <th className="px-3 py-2 text-right">Avg Rec.</th>
                  <th className="px-3 py-2 text-right">&lt;15s</th>
                  <th className="px-3 py-2 text-right">No-Report</th>
                  <th className="px-3 py-2 text-left">Smart Status</th>
                </tr>
              </thead>
              <tbody>
                {REVIEW_ROWS.map((row) => {
                  const style = STATUS_STYLE[row.smartStatus];
                  const ratio = row.leads ? Math.round((row.realConversations / row.leads) * 100) : 0;
                  return (
                    <tr key={row.employeeId} className={`border-t border-border ${style.row}`}>
                      <td className="px-3 py-2 text-muted-foreground">{row.rank ?? "–"}</td>
                      <td className="px-3 py-2">
                        <p className="font-semibold">{row.name}</p>
                        <p className="text-[11px] text-muted-foreground">{row.employeeId}</p>
                      </td>
                      <td className="px-3 py-2 text-right">{row.leads}</td>
                      <td className="px-3 py-2 text-right">
                        <span className="font-semibold">{row.realConversations}</span>
                        <span className="ml-1 text-[11px] text-muted-foreground">{ratio}%</span>
                        <span className="mt-1 block h-1 w-full overflow-hidden rounded-full bg-surface-2">
                          <span
                            className={`block h-full ${style.bar}`}
                            style={{ width: `${Math.min(100, ratio)}%` }}
                          />
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right">{row.talkTime}</td>
                      <td
                        className={`px-3 py-2 text-right ${row.avgRecordingSeconds < 5 ? "font-semibold text-destructive" : ""}`}
                      >
                        {row.avgRecordingSeconds}s
                      </td>
                      <td className="px-3 py-2 text-right font-semibold text-destructive">
                        {row.fakeConnected}
                      </td>
                      <td className="px-3 py-2 text-right font-semibold text-destructive">
                        {row.closedWithoutReport}
                      </td>
                      <td className="px-3 py-2">
                        <span
                          className={`inline-block rounded-full border px-2 py-0.5 text-[11px] font-semibold ${style.chip}`}
                        >
                          {SMART_STATUS_LABEL[row.smartStatus].en}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground">
            * Srijonee-র মাত্র ২টি রেকর্ডিং থাকায় তার evidence coverage আলাদা করে “Evidence Gap”
            হিসেবে দেখানো হয়েছে — কম কাজ নয়, প্রমাণ কম।
          </p>
        </section>

        {/* Smart agent cards */}
        <section>
          <SectionTitle bn="স্মার্ট এজেন্ট কার্ড" en="Smart Agent Cards" icon={ShieldAlert} />
          <div className="mt-2 grid gap-3 lg:grid-cols-3">
            {cards.map((row) => (
              <SmartAgentCard key={row.employeeId} row={row} />
            ))}
          </div>
        </section>

        {/* Alert center */}
        <section>
          <SectionTitle bn="রিয়েল-টাইম অ্যালার্ট সেন্টার" en="Real-Time Alert Center" icon={AlertTriangle} />
          <div className="mt-2 grid gap-3 lg:grid-cols-3">
            {REVIEW_ALERTS.map((alert) => (
              <div
                key={`${alert.employeeId}-${alert.signal}`}
                className={`rounded-2xl border p-4 ${
                  alert.severity === "HIGH"
                    ? "border-destructive/50 bg-destructive/10"
                    : "border-chart-4/40 bg-chart-4/10"
                }`}
              >
                <p
                  className={`flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide ${
                    alert.severity === "HIGH" ? "text-destructive" : "text-chart-4"
                  }`}
                >
                  <AlertTriangle className="size-3.5" />
                  {alert.kind === "performance" ? "Performance Alert" : "Data Integrity Alert"}
                </p>
                <p className="mt-2 text-sm font-semibold">
                  {alert.name}{" "}
                  <span className="text-xs text-muted-foreground">({alert.employeeId})</span>
                </p>
                <p className="mt-1 text-xs">
                  <span className="text-muted-foreground">Signal: </span>
                  {alert.signal}
                </p>
                <p className="mt-1 text-[11px] font-bold uppercase tracking-wide">
                  Severity: {alert.severity}
                </p>
                <ul className="mt-2 space-y-0.5 text-[11px] text-muted-foreground">
                  {alert.lines.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
                <p className="mt-3 rounded-lg border border-border bg-card px-2.5 py-1.5 text-[11px] font-semibold">
                  Required action: {alert.action}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Floor intelligence */}
        <section className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-primary/30 bg-primary/5 p-4">
            <SectionTitle bn="আজকের অপারেশনাল নিয়ম" en="Today's Operational Rules" icon={ShieldCheck} />
            <ul className="mt-2 space-y-2 text-xs">
              {REVIEW_RULES.map((rule, index) => (
                <li key={rule} className="rounded-lg border border-border bg-card px-3 py-2">
                  <p className="font-semibold">{rule}</p>
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                    {REVIEW_RULES_EN[index]}
                  </p>
                </li>
              ))}
            </ul>
          </div>
          <div className="space-y-3">
            <div className="rounded-2xl border border-border bg-card p-4">
              <p className="text-sm font-semibold">কার কী সংকেত / Signal per desk</p>
              <ul className="mt-2 space-y-2 text-xs leading-relaxed">
                {REVIEW_ROWS.map((row) => (
                  <li key={row.employeeId}>
                    <span className="font-semibold">
                      {row.name} ({row.employeeId}):
                    </span>{" "}
                    <span className={STATUS_STYLE[row.smartStatus].text}>{row.verdict}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-2xl border border-chart-4/40 bg-chart-4/10 p-4 text-xs leading-relaxed">
              <p className="mb-1 text-[11px] font-bold uppercase tracking-wide text-chart-4">
                Team Insight
              </p>
              {REVIEW_INSIGHT}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function SectionTitle({
  bn,
  en,
  icon: Icon,
}: {
  bn: string;
  en: string;
  icon: typeof Activity;
}) {
  return (
    <div className="flex items-center gap-2">
      <Icon className="size-4 text-primary" />
      <h2 className="text-sm font-bold">{bn}</h2>
      <span className="text-[11px] uppercase tracking-wide text-muted-foreground">{en}</span>
    </div>
  );
}

const STAT_TONE = {
  primary: "border-primary/30 bg-primary/5 text-primary",
  live: "border-live/30 bg-live/5 text-live",
  warn: "border-chart-4/40 bg-chart-4/10 text-chart-4",
  bad: "border-destructive/40 bg-destructive/10 text-destructive",
} as const;

function Stat({
  icon: Icon,
  label,
  sub,
  value,
  tone,
}: {
  icon: typeof Activity;
  label: string;
  sub: string;
  value: string;
  tone: keyof typeof STAT_TONE;
}) {
  return (
    <div className={`rounded-xl border p-3 ${STAT_TONE[tone]}`}>
      <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide">
        <Icon className="size-3.5" /> {label}
      </p>
      <p className="mt-1 text-lg font-bold">{value}</p>
      <p className="text-[10px] text-muted-foreground">{sub}</p>
    </div>
  );
}

/** Per-desk card: activity → evidence → integrity, then the machine note. */
function SmartAgentCard({ row }: { row: ReviewRow }) {
  const style = STATUS_STYLE[row.smartStatus];
  return (
    <div className={`rounded-2xl border p-4 ${style.chip.split(" ")[0]} ${style.row}`}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
            {row.employeeId}
          </p>
          <p className="text-sm font-bold">{row.name}</p>
        </div>
        <span
          className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ${style.chip}`}
        >
          {SMART_STATUS_LABEL[row.smartStatus].en}
        </span>
      </div>

      <ul className="mt-3 space-y-1 text-xs">
        <li className="flex justify-between gap-2">
          <span className="text-muted-foreground">Leads</span>
          <span className="font-semibold">{row.leads}</span>
        </li>
        <li className="flex justify-between gap-2">
          <span className="text-muted-foreground">Real conversations</span>
          <span className="font-semibold">{row.realConversations}</span>
        </li>
        <li className="flex justify-between gap-2">
          <span className="text-muted-foreground">&lt;15s connections</span>
          <span className="font-semibold text-destructive">{row.fakeConnected}</span>
        </li>
        <li className="flex justify-between gap-2">
          <span className="text-muted-foreground">Closed without report</span>
          <span className="font-semibold text-destructive">{row.closedWithoutReport}</span>
        </li>
      </ul>

      <div className="mt-3 rounded-lg border border-border bg-card p-2.5">
        <p className="text-[10px] font-bold uppercase tracking-wide text-primary">AI Insight</p>
        <p className="mt-0.5 text-[11px] leading-relaxed">{row.insight}</p>
      </div>

      <p className="mt-2 text-[10px] text-muted-foreground">
         ৯টা ৪৫ মিনিটের পর: Lead 360, Call Timeline ও Audit Evidence — সব হেড কোয়ার্টার প্যানেল থেকে খোলা
        যাবে।
      </p>
    </div>
  );
}

/** Red, non-dismissible wall for a flagged account after the floor opens. */
function HqApprovalWall({ name }: { name: string }) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="হেড কোয়ার্টার অনুমোদন প্রয়োজন"
      className="fixed inset-0 z-[120] flex items-center justify-center overflow-y-auto bg-background/98 p-4 backdrop-blur-sm"
    >
      <div className="w-full max-w-lg rounded-2xl border-2 border-destructive bg-destructive/10 p-6 text-center">
        <ShieldAlert className="mx-auto size-10 text-destructive" />
        <h2 className="mt-3 text-xl font-bold text-destructive">অ্যাকাউন্ট সাময়িকভাবে বন্ধ</h2>
        {name && <p className="mt-1 text-sm font-semibold">{name}</p>}
        <p className="mt-3 text-sm leading-relaxed">
          পারফরম্যান্স রিভিউতে আপনার ডেটা প্যাটার্ন “Critical” চিহ্নিত হয়েছে। সিদ্ধান্ত না হওয়া
          পর্যন্ত আপনি CRM বা কোনো ডেটা ব্যবহার করতে পারবেন না।
        </p>
        <p className="mt-4 rounded-xl border border-destructive/50 bg-destructive/15 p-3 text-sm font-bold text-destructive">
          হেড কোয়ার্টারে যোগাযোগ করে কারণ ব্যাখ্যা করুন এবং হেড কোয়ার্টার থেকে অনুমোদন নিয়ে আসুন।
        </p>
        <p className="mt-3 text-xs text-muted-foreground">
          অনুমোদন দেওয়া হলে এই নোটিশ নিজেই সরে যাবে — পেজ রিফ্রেশ করার দরকার নেই।
        </p>
      </div>
    </div>
  );
}
