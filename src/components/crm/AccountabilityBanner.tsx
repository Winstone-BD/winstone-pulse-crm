import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ClipboardCheck, ShieldAlert } from "lucide-react";

import { myAccountability } from "@/lib/accountability.functions";
import { STATUS_LABEL, type AccountabilityStatus } from "@/lib/accountability";
import { useT } from "@/lib/i18n";

export function useMyAccountability() {
  const fetchState = useServerFn(myAccountability);
  return useQuery({
    queryKey: ["my-accountability"],
    queryFn: () => fetchState({ data: {} }),
    refetchInterval: 120_000,
  });
}

/** Neutral, factual agent notice. Shown only when a review exists. */
export function AccountabilityBanner() {
  const t = useT();
  const { data } = useMyAccountability();
  const latest = data?.reviews?.[0];
  if (!latest) return null;
  const status = latest.status as AccountabilityStatus;
  const approved = status === "approved";
  if (approved && latest.unlock_for_date < (data?.today ?? "")) return null;

  const tone = approved
    ? "border-success/40 bg-success/10 text-success"
    : status === "hold"
      ? "border-destructive/40 bg-destructive/10 text-destructive"
      : "border-warning/40 bg-warning/10 text-warning";
  const backlog = Number((latest as { backlog?: unknown }).backlog ?? 0);
  const pendingLeads = Math.max(0, latest.pending_count - latest.overdue_followups);

  return (
    <section className={`notice-highlight rounded-xl px-4 py-3 pl-5 ${tone}`} role="status">
      <div className="flex items-start gap-3">
        {approved ? (
          <ClipboardCheck className="mt-0.5 size-4 shrink-0 text-success" />
        ) : (
          <ShieldAlert className="mt-0.5 size-4 shrink-0 text-warning" />
        )}
        <div className="min-w-0 space-y-1">
          <p className="text-sm font-semibold text-foreground">
            {approved
              ? t({ bn: "আপনার কাজের পর্যালোচনা অনুমোদিত হয়েছে", en: "Your work review has been approved" })
              : status === "hold"
                ? t({ bn: "নতুন লিড এখন স্থগিত — HQ-র সাথে কথা বলুন", en: "New leads are on hold — talk to HQ" })
                : t({ bn: "আগের কাজ শেষ করুন, তারপর নতুন লিড আসবে", en: "Finish earlier work, then new leads will arrive" })}
          </p>
          <p className="text-xs text-muted-foreground">
            {t({
              bn: `আজকের কাজ (${latest.business_date}): মোট ${latest.eligible_count}টি কাজের মধ্যে ${latest.completed_count}টি শেষ হয়েছে। বাকি — ফলো-আপ ${latest.overdue_followups}টি, লিড ${pendingLeads}টি${latest.missed_reports > 0 ? `, রিপোর্ট ${latest.missed_reports}টি` : ""}।`,
              en: `Today's work (${latest.business_date}): ${latest.completed_count} of ${latest.eligible_count} tasks completed. Remaining — follow-ups ${latest.overdue_followups}, leads ${pendingLeads}${latest.missed_reports > 0 ? `, reports ${latest.missed_reports}` : ""}.`,
            })}
          </p>
          {backlog > 0 && (
            <p className="text-xs text-muted-foreground">
              {t({
                bn: `পুরনো ব্যাকলগ (আগের দিনের ফলো-আপ): ${backlog}টি — আজকের হিসাবে ধরা হয়নি।`,
                en: `Older backlog (previous days' follow-ups): ${backlog} — not counted in today's total.`,
              })}
            </p>
          )}
          {approved ? (
            <p className="text-xs font-medium text-success">
              {t({
                bn: `${latest.unlock_for_date} থেকে নতুন লিড চালু।${latest.approval_note ? ` HQ নোট: ${latest.approval_note}` : ""}`,
                en: `New leads resume from ${latest.unlock_for_date}.${latest.approval_note ? ` HQ note: ${latest.approval_note}` : ""}`,
              })}
            </p>
          ) : (
            <p className="text-xs text-foreground">
              {t({
                bn: `কল, ফলো-আপ ও রিপোর্ট সব কাজ স্বাভাবিকভাবে করা যাবে। শুধু ${latest.unlock_for_date}-এর নতুন লিড HQ দেখার পর আসবে। ভালো পারফরম্যান্স (Top 3) আর বাকি কাজ — দুটো আলাদা হিসাব।${status === "hold" && latest.approval_note ? ` HQ নোট: ${latest.approval_note}` : ""}`,
                en: `Calls, follow-ups and reports can all continue as usual. Only new leads for ${latest.unlock_for_date} will arrive after HQ review. Top performance (Top 3) and pending work are counted separately.${status === "hold" && latest.approval_note ? ` HQ note: ${latest.approval_note}` : ""}`,
              })}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
