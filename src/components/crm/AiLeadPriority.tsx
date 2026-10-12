import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Copy, Loader2, MessageSquareText, Sparkles } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { draftAiMessage, getAiLeadPriority } from "@/lib/ai-features.functions";
import { useLang, useT } from "@/lib/i18n";

/**
 * Winstone AI on the agent desk: suggests which of the agent's own leads to
 * call first, and drafts a follow-up message the agent edits and sends
 * themselves. Nothing is saved or sent by the AI.
 */
export function AiLeadPriority() {
  const t = useT();
  const lang = useLang();
  const priority = useServerFn(getAiLeadPriority);
  const [draftLead, setDraftLead] = useState<{ id: string; name: string } | null>(null);

  const run = useMutation({
    mutationFn: () => priority({ data: {} }),
    onError: (e) => toast.error(e instanceof Error ? e.message : String(e)),
  });

  return (
    <section className="card-elevated space-y-3 p-4" aria-label={t({ bn: "AI কল ক্রম", en: "AI call order" })}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <Sparkles className="size-4 text-primary" aria-hidden />
          {t({ bn: "Winstone AI — কাকে আগে ডাকবেন", en: "Winstone AI — who to call first" })}
        </h2>
        <Button size="sm" variant="outline" disabled={run.isPending} onClick={() => run.mutate()}>
          {run.isPending ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
          {t({ bn: "কলের ক্রম বলুন", en: "Suggest call order" })}
        </Button>
      </div>

      {run.data?.items.length === 0 && (
        <p className="text-sm text-muted-foreground">
          {t({ bn: "এই মুহূর্তে আপনার খোলা লিড নেই।", en: "You have no open leads right now." })}
        </p>
      )}

      {run.data?.items.length ? (
        <ol className="space-y-2">
          {run.data.items.map((item, i) => (
            <li
              key={item.leadId}
              className="flex items-start justify-between gap-3 rounded-lg border border-border bg-card px-3 py-2"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium">
                  <span className="mr-1 text-muted-foreground">{i + 1}.</span>
                  {item.name}
                </p>
                <p className="text-xs text-muted-foreground">{item.reason}</p>
              </div>
              <Button
                size="sm"
                variant="ghost"
                className="shrink-0"
                onClick={() => setDraftLead({ id: item.leadId, name: item.name })}
              >
                <MessageSquareText className="size-4" />
                {t({ bn: "মেসেজ খসড়া", en: "Draft message" })}
              </Button>
            </li>
          ))}
        </ol>
      ) : null}

      {draftLead && (
        <MessageDraftDialog
          leadId={draftLead.id}
          leadName={draftLead.name}
          lang={lang}
          onClose={() => setDraftLead(null)}
        />
      )}
    </section>
  );
}

function MessageDraftDialog(props: {
  leadId: string;
  leadName: string;
  lang: "bn" | "en";
  onClose: () => void;
}) {
  const t = useT();
  const draft = useServerFn(draftAiMessage);
  const [text, setText] = useState("");

  const run = useMutation({
    mutationFn: () => draft({ data: { leadId: props.leadId, lang: props.lang } }),
    onSuccess: (r) => setText(r.draft),
    onError: (e) => toast.error(e instanceof Error ? e.message : String(e)),
  });

  return (
    <Dialog open onOpenChange={(open) => !open && props.onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {t({ bn: "মেসেজ খসড়া — ", en: "Message draft — " })}
            {props.leadName}
          </DialogTitle>
          <DialogDescription>
            {t({
              bn: "AI শুধু খসড়া লিখে দেয় — পাঠানোর আগে দেখে এডিট করুন।",
              en: "The AI only drafts — review and edit before sending.",
            })}
          </DialogDescription>
        </DialogHeader>
        {text ? (
          <div className="space-y-3">
            <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={6} />
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => run.mutate()} disabled={run.isPending}>
                {t({ bn: "আবার লিখুন", en: "Regenerate" })}
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  void navigator.clipboard.writeText(text);
                  toast.success(t({ bn: "কপি হয়েছে", en: "Copied" }));
                }}
              >
                <Copy className="size-4" />
                {t({ bn: "কপি করুন", en: "Copy" })}
              </Button>
            </div>
          </div>
        ) : (
          <Button onClick={() => run.mutate()} disabled={run.isPending}>
            {run.isPending ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
            {t({ bn: "খসড়া লিখুন", en: "Write draft" })}
          </Button>
        )}
      </DialogContent>
    </Dialog>
  );
}
