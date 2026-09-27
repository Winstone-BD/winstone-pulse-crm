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
    ? "border-success/40 bg-success/10"
    : status === "hold"
      ? "border-destructive/40 bg-destructive/5"
      : "border-warning/50 bg-warning/10";

  return (
    <section className={`rounded-2xl border p-4 ${tone}`} role="status">
      <div className="flex items-start gap-3">
        {approved ? (
          <ClipboardCheck className="mt-0.5 size-5 shrink-0 text-success" />
        ) : (
          <ShieldAlert className="mt-0.5 size-5 shrink-0 text-warning" />
        )}
        <div className="min-w-0 space-y-1.5">
          <p className="text-sm font-semibold text-foreground">
            দৈনিক কাজের পর্যালোচনা — {STATUS_LABEL[status]}
          </p>
          <p className="text-xs text-muted-foreground">
            {latest.business_date} তারিখে {latest.eligible_count}টি কাজের মধ্যে {latest.completed_count}টি সম্পন্ন,{" "}
            {latest.pending_count}টি বাকি ({latest.pending_percent}%, সীমা 10%)। মেয়াদোত্তীর্ণ ফলো-আপ:{" "}
            {latest.overdue_followups}, অসম্পূর্ণ রিপোর্ট: {latest.missed_reports}।
          </p>
          {approved ? (
            <p className="text-xs font-medium text-success">
              Executive HQ অনুমোদন দিয়েছে — {latest.unlock_for_date} থেকে আপনার কিউ খোলা।
              {latest.approval_note ? ` নোট: ${latest.approval_note}` : ""}
            </p>
          ) : (
            <p className="text-xs font-medium text-foreground">
              HQ Review Required — {latest.unlock_for_date} তারিখের লিড কিউ Executive HQ অনুমোদনের পর খুলবে।
              এর মধ্যে বাকি ফলো-আপ ও অসম্পূর্ণ রিপোর্টগুলো শেষ করুন।
              {status === "hold" && latest.approval_note ? ` HQ নোট: ${latest.approval_note}` : ""}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
