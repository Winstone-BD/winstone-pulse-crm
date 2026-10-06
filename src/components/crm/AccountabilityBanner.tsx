import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ClipboardCheck, ShieldAlert } from "lucide-react";

import { myAccountability } from "@/lib/accountability.functions";
import { STATUS_LABEL, type AccountabilityStatus } from "@/lib/accountability";

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
              ? "আপনার কাজের পর্যালোচনা অনুমোদিত হয়েছে"
              : status === "hold"
                ? "নতুন লিড এখন স্থগিত — HQ-র সাথে কথা বলুন"
                : "আগের কাজ শেষ করুন, তারপর নতুন লিড আসবে"}
          </p>
          <p className="text-xs text-muted-foreground">
            আজকের কাজ ({latest.business_date}): মোট {latest.eligible_count}টি কাজের মধ্যে {latest.completed_count}টি শেষ হয়েছে।
            বাকি — ফলো-আপ {latest.overdue_followups}টি, লিড {pendingLeads}টি
            {latest.missed_reports > 0 ? `, রিপোর্ট ${latest.missed_reports}টি` : ""}।
          </p>
          {backlog > 0 && (
            <p className="text-xs text-muted-foreground">পুরনো ব্যাকলগ (আগের দিনের ফলো-আপ): {backlog}টি — আজকের হিসাবে ধরা হয়নি।</p>
          )}
          {approved ? (
            <p className="text-xs font-medium text-success">
              {latest.unlock_for_date} থেকে নতুন লিড চালু।
              {latest.approval_note ? ` HQ নোট: ${latest.approval_note}` : ""}
            </p>
          ) : (
            <p className="text-xs text-foreground">
              কল, ফলো-আপ ও রিপোর্ট সব কাজ স্বাভাবিকভাবে করা যাবে। শুধু {latest.unlock_for_date}-এর নতুন লিড
              HQ দেখার পর আসবে। ভালো পারফরম্যান্স (Top 3) আর বাকি কাজ — দুটো আলাদা হিসাব।
              {status === "hold" && latest.approval_note ? ` HQ নোট: ${latest.approval_note}` : ""}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
