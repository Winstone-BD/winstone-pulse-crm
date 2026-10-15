import { useServerFn } from "@tanstack/react-start";
import { ClipboardList, Copy, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { buildTemplate, type TemplateFacts, type TemplateId } from "@/lib/agent-templates";
import { getBuyerCheckFacts } from "@/lib/buyer-facts.functions";
import { getAdminToken } from "@/lib/local-session";

/** Pre-filled buyer-check / call-prep drafts from saved CRM facts. Nothing is sent or saved. */
export function AgentTemplates({ leadId, facts }: { leadId?: string; facts: TemplateFacts }) {
  const loadFacts = useServerFn(getBuyerCheckFacts);
  const [text, setText] = useState("");
  const [flagged, setFlagged] = useState(false);
  const [busy, setBusy] = useState(false);

  const open = async (id: TemplateId) => {
    let f: TemplateFacts = facts;
    if (leadId) {
      setBusy(true);
      try {
        f = { ...facts, ...(await loadFacts({ data: { token: getAdminToken(), leadId } })) };
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "CRM তথ্য আনা যায়নি — খালি টেমপ্লেট দেখানো হলো");
      } finally {
        setBusy(false);
      }
    }
    const t = buildTemplate(id, f);
    setText(t.text);
    setFlagged(t.flagged);
  };

  return (
    <section className="rounded-xl border border-border bg-card p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <ClipboardList className="size-4 text-primary" /> খসড়া টেমপ্লেট
          {busy && <Loader2 className="size-4 animate-spin" />}
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" disabled={busy} onClick={() => void open("buyer_check")}>ক্রেতা যাচাই</Button>
          <Button size="sm" variant="outline" disabled={busy} onClick={() => void open("call_prep")}>কল প্রস্তুতি</Button>
        </div>
      </div>
      {text && (
        <>
          {flagged && (
            <p className="text-xs text-destructive">
              লিডের তথ্যে সন্দেহজনক নির্দেশ পাওয়া গেছে — সেটি টেমপ্লেটে বসানো হয়নি।
            </p>
          )}
          <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={12} />
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">CRM-এ সেভ করা তথ্য থেকে পূরণ — শুধু খসড়া, কিছু পাঠানো বা সেভ হয় না।</p>
            <Button size="sm" onClick={() => { void navigator.clipboard.writeText(text); toast.success("কপি হয়েছে"); }}>
              <Copy className="size-4" /> কপি
            </Button>
          </div>
        </>
      )}
    </section>
  );
}
