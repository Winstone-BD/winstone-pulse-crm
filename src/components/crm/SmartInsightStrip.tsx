import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  Flame,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { useMemo } from "react";

import { CONNECTED_THRESHOLD_SECONDS, useSnapshot } from "@/lib/crm-data";
import { leadOwner } from "@/lib/lead-owner";

type Insight = {
  tone: "good" | "watch" | "urgent";
  icon: React.ReactNode;
  title: string;
  detail: string;
};

const TONE: Record<Insight["tone"], string> = {
  good: "border-primary/30 bg-primary/[0.07] text-primary",
  watch: "border-border bg-muted/40 text-foreground",
  urgent: "border-destructive/40 bg-destructive/[0.08] text-destructive",
};

function sameDay(iso: string, ref: Date) {
  return new Date(iso).toDateString() === ref.toDateString();
}

/**
 * Reads the same live snapshot the boards already use and turns it into a few
 * plain-Bengali lines: what changed since yesterday, what is overdue, and what
 * to do next. Every number comes from real rows — nothing is invented.
 */
export function SmartInsightStrip({ scope }: { scope: "desk" | "floor" }) {
  const { leads, calls, isPending } = useSnapshot();

  const insights = useMemo<Insight[]>(() => {
    const now = new Date();
    const yesterday = new Date(now.getTime() - 86_400_000);

    const todayCalls = calls.filter((c) => sameDay(c.created_at, now));
    const yesterdayCalls = calls.filter((c) => sameDay(c.created_at, yesterday));
    const conn = (rows: typeof calls) =>
      rows.filter((c) => c.duration_seconds > CONNECTED_THRESHOLD_SECONDS).length;
    const todayConnected = conn(todayCalls);
    const yesterdayConnected = conn(yesterdayCalls);
    const delta = todayConnected - yesterdayConnected;

    const followUpsDue = leads.filter(
      (l) => l.status === "follow_up" && (!l.last_call_at || new Date(l.last_call_at) < yesterday),
    ).length;
    const unfinished = leads.filter((l) => l.work_state !== "completed" && leadOwner(l)).length;
    const hot = leads.filter((l) => l.temperature === "hot" && l.status !== "closed").length;
    const untouched = leads.filter((l) => (l.call_count ?? 0) === 0 && leadOwner(l)).length;

    const rows: Insight[] = [];

    rows.push(
      delta >= 0
        ? {
            tone: "good",
            icon: <TrendingUp className="size-4" />,
            title: `আজ ${todayConnected}টি কলে কথা হয়েছে`,
            detail:
              delta === 0
                ? "গতকালের সমান গতি — ছন্দ ধরে রাখুন।"
                : `গতকালের চেয়ে ${delta}টি বেশি। ভালো এগোচ্ছে।`,
          }
        : {
            tone: "watch",
            icon: <TrendingDown className="size-4" />,
            title: `আজ ${todayConnected}টি কলে কথা হয়েছে`,
            detail: `গতকালের চেয়ে ${Math.abs(delta)}টি কম — এখনই কয়েকটি কল সেরে নিন।`,
          },
    );

    if (hot > 0) {
      rows.push({
        tone: "urgent",
        icon: <Flame className="size-4" />,
        title: `${hot}টি হট লিড খোলা আছে`,
        detail: "সবচেয়ে আগে এগুলোতেই কল করুন — এখানেই ডিল হওয়ার সম্ভাবনা বেশি।",
      });
    }

    if (followUpsDue > 0) {
      rows.push({
        tone: followUpsDue > 5 ? "urgent" : "watch",
        icon: <CalendarClock className="size-4" />,
        title: `${followUpsDue}টি ফলো-আপ সময় পেরিয়ে গেছে`,
        detail: "একদিনের বেশি পুরোনো ফলো-আপ ঠান্ডা হয়ে যায়।",
      });
    }

    if (untouched > 0) {
      rows.push({
        tone: "watch",
        icon: <AlertTriangle className="size-4" />,
        title: `${untouched}টি লিডে এখনো একটিও কল হয়নি`,
        detail:
          scope === "floor"
            ? "কোঅর্ডিনেটর ডেস্ক থেকে ভাগ দেখে নিন।"
            : "আজকের তালিকার শুরু থেকেই ধরুন।",
      });
    }

    if (rows.length < 3 && unfinished === 0) {
      rows.push({
        tone: "good",
        icon: <CheckCircle2 className="size-4" />,
        title: "সব লিডের কাজ শেষ",
        detail: "নতুন তালিকা আসা পর্যন্ত পরিষ্কার — চমৎকার।",
      });
    }

    return rows.slice(0, 4);
  }, [calls, leads, scope]);

  if (isPending) {
    return (
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-20 animate-pulse rounded-xl border border-border bg-muted/40" />
        ))}
      </div>
    );
  }

  return (
    <section aria-label="স্মার্ট পরামর্শ" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {insights.map((row) => (
        <article
          key={row.title}
          className={`rounded-xl border p-3 shadow-sm transition-colors ${TONE[row.tone]}`}
        >
          <p className="flex items-center gap-2 text-sm font-semibold">
            <span className="shrink-0">{row.icon}</span>
            <span className="min-w-0">{row.title}</span>
          </p>
          <p className="mt-1 text-xs text-muted-foreground">{row.detail}</p>
        </article>
      ))}
    </section>
  );
}
