import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Clock, Lock, ShieldAlert, X } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { getFloorLock } from "@/lib/floor-lock.functions";
import { useAdminToken } from "@/lib/local-session";
import {
  REVIEW_INSIGHT,
  REVIEW_PERIOD,
  REVIEW_ROWS,
  REVIEW_RULES,
  REVIEW_TOTALS,
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

const TONE_ROW: Record<string, string> = {
  good: "bg-live/5",
  warn: "bg-chart-4/5",
  bad: "bg-destructive/10",
};

/**
 * Blocking floor notice.
 *
 * Until the floor opens (9:30 AM Dhaka) every signed-in desk is covered by the
 * performance review board and nothing underneath can be used. After that the
 * board disappears for everyone except the accounts HQ has flagged — they get a
 * red notice telling them to get HQ approval first.
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

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="ফ্লোর পারফরম্যান্স রিভিউ নোটিশ"
      className="fixed inset-0 z-[120] overflow-y-auto bg-background/98 backdrop-blur-sm"
    >
      <div className="mx-auto w-full max-w-6xl space-y-5 px-4 py-8">
        <header className="rounded-2xl border border-destructive/40 bg-destructive/5 p-5">
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-destructive">
            <Lock className="size-4" /> ফ্লোর বন্ধ / Floor locked
          </p>
          <h1 className="mt-2 text-2xl font-bold sm:text-3xl">
            টেলি-সেলস পারফরম্যান্স রিভিউ — {REVIEW_PERIOD}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            আসল কল, আসল কথা, রেকর্ডিং আর লিড হ্যান্ডলিং — কোনো অনুমান নয়। ফলো-আপ এই রিপোর্টে ধরা
            হয়নি।
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 font-semibold">
              <Clock className="size-3.5" /> খুলবে: {dhakaLabel(state.openAt)} (ঢাকা)
            </span>
            <span className="rounded-full border border-primary/30 bg-accent px-3 py-1 font-semibold text-primary">
              বাকি {countdown}
            </span>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            এই সময় পর্যন্ত CRM-এর কোনো অংশ ব্যবহার করা যাবে না। সাড়ে ৯টায় সবার ড্যাশবোর্ড নিজেই খুলে
            যাবে — তবে যার নামে অভিযোগ বেশি, তাকে হেড কোয়ার্টার থেকে অনুমোদন নিতে হবে।
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

        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <Stat label="মোট লিড" value={String(REVIEW_TOTALS.leads)} />
          <Stat label="আসল কথা (≥৬০s)" value={String(REVIEW_TOTALS.realConversations)} />
          <Stat label="মোট কথার সময়" value={REVIEW_TOTALS.talkTime} />
          <Stat label="মোট রেকর্ডিং" value={String(REVIEW_TOTALS.recordings)} />
          <Stat label="ভুয়া connected (<১৫s)" value={String(REVIEW_TOTALS.fakeConnected)} bad />
          <Stat label="রিপোর্ট ছাড়া closed" value={String(REVIEW_TOTALS.closedWithoutReport)} bad />
        </div>

        <div className="overflow-x-auto rounded-2xl border border-border bg-card">
          <table className="w-full min-w-[820px] text-sm">
            <thead className="bg-surface-2/70 text-[11px] uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left">#</th>
                <th className="px-3 py-2 text-left">এজেন্ট</th>
                <th className="px-3 py-2 text-left">আইডি</th>
                <th className="px-3 py-2 text-right">লিড</th>
                <th className="px-3 py-2 text-right">আসল কথা</th>
                <th className="px-3 py-2 text-right">কথার সময়</th>
                <th className="px-3 py-2 text-right">রেকর্ডিং গড়</th>
                <th className="px-3 py-2 text-right">ভুয়া connected</th>
                <th className="px-3 py-2 text-right">রিপোর্ট ছাড়া closed</th>
              </tr>
            </thead>
            <tbody>
              {REVIEW_ROWS.map((row) => (
                <tr key={row.employeeId} className={`border-t border-border ${TONE_ROW[row.tone]}`}>
                  <td className="px-3 py-2 text-muted-foreground">{row.rank ?? "–"}</td>
                  <td className="px-3 py-2 font-semibold">{row.name}</td>
                  <td className="px-3 py-2 text-muted-foreground">{row.employeeId}</td>
                  <td className="px-3 py-2 text-right">{row.leads}</td>
                  <td className="px-3 py-2 text-right">{row.realConversations}</td>
                  <td className="px-3 py-2 text-right">{row.talkTime}</td>
                  <td className="px-3 py-2 text-right">{row.avgRecordingSeconds}s</td>
                  <td className="px-3 py-2 text-right font-semibold text-destructive">
                    {row.fakeConnected}
                  </td>
                  <td className="px-3 py-2 text-right font-semibold text-destructive">
                    {row.closedWithoutReport}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-border bg-card p-4">
            <p className="flex items-center gap-2 text-sm font-semibold">
              <AlertTriangle className="size-4 text-destructive" /> কার কী দোষ
            </p>
            <ul className="mt-2 space-y-2 text-xs leading-relaxed">
              {REVIEW_ROWS.map((row) => (
                <li key={row.employeeId}>
                  <span className="font-semibold">
                    {row.name} ({row.employeeId}):
                  </span>{" "}
                  <span
                    className={
                      row.tone === "bad"
                        ? "text-destructive"
                        : row.tone === "warn"
                          ? "text-chart-4"
                          : "text-muted-foreground"
                    }
                  >
                    {row.verdict}
                  </span>
                </li>
              ))}
            </ul>
          </div>
          <div className="space-y-4">
            <div className="rounded-2xl border border-border bg-card p-4">
              <p className="text-sm font-semibold">আজ থেকে যে নিয়ম</p>
              <ul className="mt-2 list-disc space-y-1.5 pl-5 text-xs text-muted-foreground">
                {REVIEW_RULES.map((rule) => (
                  <li key={rule}>{rule}</li>
                ))}
              </ul>
            </div>
            <div className="rounded-2xl border border-chart-4/40 bg-chart-4/5 p-4 text-xs leading-relaxed">
              {REVIEW_INSIGHT}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, bad = false }: { label: string; value: string; bad?: boolean }) {
  return (
    <div
      className={`rounded-xl border p-3 ${bad ? "border-destructive/40 bg-destructive/5" : "border-border bg-card"}`}
    >
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`mt-1 text-lg font-bold ${bad ? "text-destructive" : ""}`}>{value}</p>
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
          পারফরম্যান্স রিভিউতে আপনার নামে সবচেয়ে বেশি অভিযোগ এসেছে। সিদ্ধান্ত না হওয়া পর্যন্ত আপনি
          CRM বা কোনো ডেটা ব্যবহার করতে পারবেন না।
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
