import { AlertTriangle, CalendarClock, CheckCircle2, Flame, ListTodo } from "lucide-react";
import { useMemo } from "react";

import { useSnapshot } from "@/lib/crm-data";
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

/**
 * Next-action guidance built only from lead fields that are actually written by
 * the app: temperature, work state, attempt counters and last call time.
 *
 * Call volume and talk time are deliberately NOT used here — recordings are not
 * reliably synced, so those numbers live only in the canonical daily
 * performance board (src/lib/daily-performance.ts), which reads submitted call
 * reports on the server.
 */
export function SmartInsightStrip({ scope }: { scope: "desk" | "floor" }) {
  const { leads, isPending } = useSnapshot();

  const insights = useMemo<Insight[]>(() => {
    const yesterday = new Date(Date.now() - 86_400_000);
    const owned = leads.filter((l) => leadOwner(l));

    const openWork = owned.filter((l) => l.work_state !== "completed").length;
    const hot = leads.filter((l) => l.temperature === "hot" && l.status !== "closed").length;
    const staleFollowUp = leads.filter(
      (l) => l.status === "follow_up" && (!l.last_call_at || new Date(l.last_call_at) < yesterday),
    ).length;
    const untouched = owned.filter(
      (l) => (l.call_attempts ?? 0) === 0 && !l.last_call_at && l.work_state !== "completed",
    ).length;

    const rows: Insight[] = [];

    rows.push({
      tone: openWork > 0 ? "watch" : "good",
      icon: <ListTodo className="size-4" />,
      title: openWork > 0 ? `${openWork}টি লিডের কাজ বাকি` : "হাতে বাকি কাজ নেই",
      detail:
        openWork > 0
          ? scope === "floor"
            ? "নিচের ভাগের হিসাব দেখে ভারসাম্য করে নিন।"
            : "আজকের তালিকা ধরে একে একে শেষ করুন।"
          : "নতুন তালিকা আসা পর্যন্ত পরিষ্কার।",
    });

    if (hot > 0) {
      rows.push({
        tone: "urgent",
        icon: <Flame className="size-4" />,
        title: `${hot}টি হট লিড খোলা আছে`,
        detail: "সবচেয়ে আগে এগুলোতেই কল করুন — এখানেই ডিল হওয়ার সম্ভাবনা বেশি।",
      });
    }

    if (staleFollowUp > 0) {
      rows.push({
        tone: staleFollowUp > 5 ? "urgent" : "watch",
        icon: <CalendarClock className="size-4" />,
        title: `${staleFollowUp}টি ফলো-আপ একদিনের বেশি পুরোনো`,
        detail: "পুরোনো ফলো-আপ ঠান্ডা হয়ে যায় — আজই ধরুন।",
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

    if (rows.length === 1 && openWork === 0) {
      rows.push({
        tone: "good",
        icon: <CheckCircle2 className="size-4" />,
        title: "সব লিডের কাজ শেষ",
        detail: "কোনো হট লিড বা পুরোনো ফলো-আপ বাকি নেই।",
      });
    }

    return rows.slice(0, 4);
  }, [leads, scope]);

  if (isPending) {
    return (
      <div className="stat-grid">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-20 animate-pulse rounded-xl border border-border bg-muted/40" />
        ))}
      </div>
    );
  }

  return (
    <section aria-label="স্মার্ট পরামর্শ" className="stat-grid">
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
