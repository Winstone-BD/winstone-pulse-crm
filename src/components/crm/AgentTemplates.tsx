import { ClipboardList, Copy } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { buildTemplate, type TemplateFacts, type TemplateId } from "@/lib/agent-templates";

/** Pre-filled buyer-check / call-prep drafts. Agent edits and copies; nothing is sent or saved. */
export function AgentTemplates({ facts }: { facts: TemplateFacts }) {
  const [text, setText] = useState("");
  const [flagged, setFlagged] = useState(false);

  const open = (id: TemplateId) => {
    const t = buildTemplate(id, facts);
    setText(t.text);
    setFlagged(t.flagged);
  };

  return (
    <section className="rounded-xl border border-border bg-card p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <ClipboardList className="size-4 text-primary" /> খসড়া টেমপ্লেট
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => open("buyer_check")}>ক্রেতা যাচাই</Button>
          <Button size="sm" variant="outline" onClick={() => open("call_prep")}>কল প্রস্তুতি</Button>
        </div>
      </div>
      {text && (
        <>
          {flagged && (
            <p className="text-xs text-destructive">
              লিডের তথ্যে সন্দেহজনক নির্দেশ পাওয়া গেছে — সেটি টেমপ্লেটে বসানো হয়নি।
            </p>
          )}
          <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={10} />
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">শুধু খসড়া — কিছু পাঠানো বা সেভ হয় না।</p>
            <Button
              size="sm"
              onClick={() => {
                void navigator.clipboard.writeText(text);
                toast.success("কপি হয়েছে");
              }}
            >
              <Copy className="size-4" /> কপি
            </Button>
          </div>
        </>
      )}
    </section>
  );
}
