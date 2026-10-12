import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { acknowledgeMyBriefing, getMyBriefingStatus } from "@/lib/agent-briefing.functions";
import { useAdminToken } from "@/lib/local-session";
import { useT } from "@/lib/i18n";

export function AgentBriefingGate() {
  const adminToken = useAdminToken();
  const t = useT();
  const queryClient = useQueryClient();
  const getStatus = useServerFn(getMyBriefingStatus);
  const acknowledge = useServerFn(acknowledgeMyBriefing);
  const status = useQuery({
    queryKey: ["agent-briefing-status"],
    queryFn: () => getStatus({ data: { adminToken } }),
    refetchInterval: 60_000,
    retry: false,
  });
  const ack = useMutation({
    mutationFn: () => acknowledge({ data: { adminToken } }),
    onSuccess: (next) => {
      queryClient.setQueryData(["agent-briefing-status"], next);
      toast.success(t({ bn: "আজকের ব্রিফিং স্বীকার করা হয়েছে", en: "Today's briefing acknowledged" }));
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const blocked = Boolean(status.data?.required && !status.data.acknowledged);

  return (
    <AlertDialog open={blocked}>
      <AlertDialogContent
        className="max-w-md"
        onEscapeKeyDown={(event) => event.preventDefault()}
      >
        <AlertDialogHeader>
          <span className="mx-auto grid size-12 place-items-center rounded-full bg-primary/10 text-primary sm:mx-0">
            <ShieldCheck className="size-6" />
          </span>
          <AlertDialogTitle>{status.data ? t({ bn: status.data.title, en: status.data.titleEn }) : null}</AlertDialogTitle>
          <AlertDialogDescription className="leading-6 text-foreground">
            {status.data ? t({ bn: status.data.detail, en: status.data.detailEn }) : null}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="rounded-md border border-border bg-muted/40 p-3 text-sm text-muted-foreground">
          {t({ bn: "এই নোটিশ স্বীকার না করা পর্যন্ত কোনো কল শুরু হবে না।", en: "No call can start until you acknowledge this notice." })}
        </div>
        <AlertDialogFooter>
          <AlertDialogAction disabled={ack.isPending} onClick={() => ack.mutate()}>
            {ack.isPending ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
            {t({ bn: "বুঝেছি — কল শুরু করব", en: "Got it — start calling" })}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}