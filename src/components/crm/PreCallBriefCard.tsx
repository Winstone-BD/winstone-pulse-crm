import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { getPreCallBrief } from "@/lib/precall.functions";
import { getAdminToken } from "@/lib/local-session";
import { clockTime } from "@/lib/crm-format";
import { LeadProjectFacts } from "@/components/crm/KnowledgeHubCards";
import { AgentTemplates } from "@/components/crm/AgentTemplates";
import { SalesToolkit } from "@/components/crm/SalesToolkit";
import { NegotiationCoach } from "@/components/crm/NegotiationCoach";
import { CallCoach } from "@/components/crm/CallCoach";
import { HandoverChecklist } from "@/components/crm/HandoverChecklist";

/** AI pre-call briefing: what to say on this lead's next call. */
export function PreCallBriefCard({ leadId }: { leadId: string }) {
  const run = useServerFn(getPreCallBrief);
  const brief = useMutation({
    mutationFn: () => run({ data: { leadId, token: getAdminToken() } }),
    onError: (error: unknown) =>
      toast.error(error instanceof Error ? error.message : "ব্রিফিং তৈরি হয়নি"),
  });
  const data = brief.data;

  return (
    <>
      <section className="rounded-xl border border-primary/25 bg-primary/5 p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-primary">
            <Sparkles className="size-4" /> কলের আগে সংক্ষিপ্ত তথ্য
          </div>
          <Button
            size="sm"
            variant="secondary"
            className="min-h-9"
            onClick={() => brief.mutate()}
            disabled={brief.isPending}
          >
            {brief.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
            {data ? "আবার তৈরি করুন" : "ব্রিফিং নিন"}
          </Button>
        </div>

        {!data && !brief.isPending && (
          <p className="mt-2 text-xs text-muted-foreground">
            কল করার আগে এই লিডের আগের কথাবার্তা থেকে করণীয় তৈরি করে নিন।
          </p>
        )}

        {Boolean(brief.error) && (
          <p role="status" className="mt-2 text-sm text-muted-foreground">
            ব্রিফ তৈরি হয়নি। স্বাভাবিকভাবে কল করতে পারবেন।
          </p>
        )}
        {data && (
          <div className="mt-3 space-y-3 text-sm">
            <p className="font-semibold">{data.headline}</p>
            <div className="rounded-lg border border-border bg-card p-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">শুরুর কথা</p>
              <p className="mt-1">{data.opener}</p>
            </div>

            {data.talkingPoints.length > 0 && (
              <ul className="list-disc space-y-1 pl-5">
                {data.talkingPoints.slice(0, 3).map((point) => (
                  <li key={point}>{point}</li>
                ))}
              </ul>
            )}

            {data.objections.length > 0 && (
              <details className="space-y-2">
                <summary className="min-h-11 cursor-pointer text-sm">আরও / সম্ভাব্য আপত্তি</summary>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  সম্ভাব্য আপত্তি
                </p>
                {data.objections.map((item) => (
                  <div key={item.objection} className="rounded-lg border border-border bg-card p-3">
                    <p className="font-medium">{item.objection}</p>
                    <p className="mt-1 text-muted-foreground">{item.response}</p>
                  </div>
                ))}
              </details>
            )}

            <p>
              <span className="text-muted-foreground">পরের কাজ: </span>
              {data.nextAction}
            </p>
            {data.risk && <p className="text-destructive">সতর্কতা: {data.risk}</p>}
            <p className="text-xs text-muted-foreground">
              {clockTime(data.generatedAt)}
              {data.aiAvailable ? "" : " · AI ছাড়া তৈরি"}
            </p>
          </div>
        )}
      </section>
      <details className="border-t border-border py-3">
        <summary className="min-h-11 cursor-pointer font-medium">আরও / কলের প্রস্তুতি</summary>
        <AgentTemplates leadId={leadId} facts={{ name: data?.leadName ?? null }} />
        <SalesToolkit leadId={leadId} />
        <NegotiationCoach leadId={leadId} />
        <CallCoach leadId={leadId} />
        <HandoverChecklist leadId={leadId} />
        <LeadProjectFacts leadId={leadId} />
      </details>
    </>
  );
}
