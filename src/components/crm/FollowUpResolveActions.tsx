import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CheckCheck, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { resolveMyFollowUp } from "@/lib/agent-desk.functions";
import { useAdminToken } from "@/lib/local-session";
import { cn } from "@/lib/utils";

/**
 * Shown on a lead the agent has already contacted: either give the follow-up a
 * new time, or finish it — a finished follow-up closes the lead, so it drops out
 * of the desk queue on its own.
 */
export function FollowUpResolveActions({
  leadId,
  leadName,
  className,
  compact = false,
}: {
  leadId: string;
  leadName?: string | null;
  className?: string;
  compact?: boolean;
}) {
  const adminToken = useAdminToken();
  const run = useServerFn(resolveMyFollowUp);
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (action: "reschedule" | "complete") =>
      run({ data: { adminToken, leadId, action } }),
    onSuccess: (_result, action) => {
      toast.success(
        action === "complete"
          ? "ফলো-আপ সম্পন্ন — লিডটি কিউ থেকে সরে গেছে"
          : "আবার ফলো-আপের সময় দেওয়া হয়েছে (২৪ ঘণ্টা পরে)",
      );
      void queryClient.invalidateQueries({ queryKey: ["crm-snapshot"] });
      void queryClient.invalidateQueries({ queryKey: ["my-follow-ups"] });
      void queryClient.invalidateQueries({ queryKey: ["my-call-reports"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const busy = mutation.isPending;
  const suffix = leadName ? ` — ${leadName}` : "";

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      <Button
        type="button"
        size="sm"
        variant="secondary"
        disabled={busy}
        onClick={() => mutation.mutate("reschedule")}
        aria-label={`আবার ফলো-আপের সময় দিন${suffix}`}
        title="আবার ফলো-আপ — ২৪ ঘণ্টা পরে সময় বসবে"
      >
        {busy ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
        {compact ? "আবার" : "আবার ফলো-আপ"}
      </Button>
      <Button
        type="button"
        size="sm"
        disabled={busy}
        onClick={() => mutation.mutate("complete")}
        aria-label={`ফলো-আপ সম্পন্ন করুন${suffix}`}
        title="ফলো-আপ সম্পন্ন — লিডটি নিজেই কিউ থেকে সরে যাবে"
        className="bg-live text-live-foreground hover:bg-live/90"
      >
        {busy ? <Loader2 className="size-4 animate-spin" /> : <CheckCheck className="size-4" />}
        {compact ? "সম্পন্ন" : "ফলো-আপ সম্পন্ন"}
      </Button>
    </div>
  );
}
