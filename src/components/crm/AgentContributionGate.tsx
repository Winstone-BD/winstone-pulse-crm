import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Trophy } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  CONTRIBUTION_MAX_SENTENCES,
  CONTRIBUTION_MAX_WORDS,
  contributionError,
  countSentences,
  countWords,
  getMyContributionStatus,
  submitMyContribution,
} from "@/lib/agent-contribution.functions";
import { useAdminToken } from "@/lib/local-session";

const bn = (n: number) => n.toLocaleString("bn-BD");

export function AgentContributionGate() {
  const adminToken = useAdminToken();
  const qc = useQueryClient();
  const getStatus = useServerFn(getMyContributionStatus);
  const submit = useServerFn(submitMyContribution);
  const [text, setText] = useState("");
  const status = useQuery({
    queryKey: ["agent-contribution-status"],
    queryFn: () => getStatus({ data: { adminToken } }),
    refetchInterval: 60_000,
    retry: false,
  });
  const save = useMutation({
    mutationFn: () => submit({ data: { adminToken, summary: text } }),
    onSuccess: (next) => {
      qc.setQueryData(["agent-contribution-status"], next);
      setText("");
      toast.success("আজকের অর্জন রিপোর্ট জমা হয়েছে — ধন্যবাদ!");
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const s = status.data;
  const first = s?.kind === "since_joining";
  const words = countWords(text);
  const sentences = countSentences(text);
  const err = text.trim() ? contributionError(text) : "লিখুন";

  return (
    <AlertDialog open={Boolean(s?.required)}>
      <AlertDialogContent className="max-w-lg" onEscapeKeyDown={(e) => e.preventDefault()}>
        <AlertDialogHeader>
          <span className="mx-auto grid size-12 place-items-center rounded-full bg-primary/10 text-primary sm:mx-0">
            <Trophy className="size-6" />
          </span>
          <AlertDialogTitle>
            {first ? "যোগদান থেকে আজ পর্যন্ত আপনার অবদান" : "আজ আপনার কাজে কোম্পানির অর্জন"}
          </AlertDialogTitle>
          <AlertDialogDescription className="leading-6 text-foreground">
            {first
              ? "যেদিন যোগ দিয়েছেন সেদিন থেকে আজ পর্যন্ত কোম্পানিকে কী দিয়েছেন, আর কোম্পানি আপনার দ্বারা কীভাবে উপকৃত হয়েছে — সংক্ষেপে লিখুন।"
              : "আজকের কল, ফলো-আপ, ভিজিট বা বুকিং থেকে কোম্পানি কী পেল — ছোট একটি সারাংশ লিখুন।"}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={6}
          maxLength={1500}
          placeholder="যেমন: আজ ৪২টি কল করেছি, ৩ জন গ্রাহক সাইট ভিজিটে রাজি হয়েছেন…"
          aria-label="অর্জন রিপোর্ট"
        />
        <div className="flex flex-wrap justify-between gap-2 text-xs">
          <span className={words > CONTRIBUTION_MAX_WORDS ? "text-destructive" : "text-muted-foreground"}>
            শব্দ {bn(words)} / {bn(CONTRIBUTION_MAX_WORDS)}
          </span>
          <span className={sentences > CONTRIBUTION_MAX_SENTENCES ? "text-destructive" : "text-muted-foreground"}>
            বাক্য {bn(sentences)} / সর্বোচ্চ {bn(CONTRIBUTION_MAX_SENTENCES)}
          </span>
        </div>
        {text.trim() && err && <p className="text-xs text-destructive">{err}</p>}
        <AlertDialogFooter>
          <Button disabled={Boolean(err) || save.isPending} onClick={() => save.mutate()}>
            {save.isPending && <Loader2 className="size-4 animate-spin" />} জমা দিন
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
