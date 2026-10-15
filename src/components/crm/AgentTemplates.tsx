import { useServerFn } from "@tanstack/react-start";
import { ClipboardList, Copy, Loader2, Sparkles } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { applyExtraction, buildTemplate, EXTRACT_FIELDS, EXTRACT_LABELS, type TemplateFacts, type TemplateId } from "@/lib/agent-templates";
import { getBuyerCheckFacts } from "@/lib/buyer-facts.functions";
import { extractBuyerCheck } from "@/lib/buyer-extract.functions";
import { getAdminToken } from "@/lib/local-session";

type Extracted = Awaited<ReturnType<typeof extractBuyerCheck>>["fields"];

/** Pre-filled buyer-check / call-prep drafts from saved CRM facts. Nothing is sent or saved. */
export function AgentTemplates({ leadId, facts }: { leadId?: string; facts: TemplateFacts }) {
  const loadFacts = useServerFn(getBuyerCheckFacts);
  const runExtract = useServerFn(extractBuyerCheck);
  const runSave = useServerFn(saveBuyerCheck);
  const [saving, setSaving] = useState(false);
  const [text, setText] = useState("");
  const [tpl, setTpl] = useState<TemplateId | null>(null);
  const [flagged, setFlagged] = useState(false);
  const [busy, setBusy] = useState(false);
  const [ai, setAi] = useState<Extracted | null>(null);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiFlagged, setAiFlagged] = useState(false);

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
    setTpl(id);
    setAi(null);
    setAiFlagged(false);
  };

  const analyse = async () => {
    if (!leadId) return;
    setAiBusy(true);
    try {
      const r = await runExtract({ data: { token: getAdminToken(), leadId } });
      setAi(r.fields);
      setAiFlagged(r.flagged);
      if (!Object.keys(r.fields).length) toast.info("নোটে নতুন তথ্য পাওয়া যায়নি");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gemini বিশ্লেষণ ব্যর্থ — আবার চেষ্টা করুন");
    } finally {
      setAiBusy(false);
    }
  };

  const found = ai ? EXTRACT_FIELDS.filter((k) => ai[k]) : [];

  const confirmSave = async () => {
    if (!leadId || !ai) return;
    if (!window.confirm("এই তথ্যগুলো লিডে সেভ হবে (শুধু খালি ঘর পূরণ হবে)। নিশ্চিত?")) return;
    setSaving(true);
    try {
      const r = await runSave({ data: { token: getAdminToken(), leadId, fields: ai as Record<string, { value: string; evidence?: string }> } });
      setText(applyExtraction(text, ai));
      if (r.saved.length) toast.success(`${r.saved.length}টি ঘর লিডে সেভ হয়েছে${r.skipped.length ? ` — ${r.skipped.length}টি আগে থেকেই পূরণ ছিল, বদলানো হয়নি` : ""}`);
      else toast.info("সব ঘর আগে থেকেই পূরণ — কিছু বদলানো হয়নি");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "সেভ করা যায়নি");
    } finally {
      setSaving(false);
    }
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
          {tpl === "buyer_check" && (
            <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="flex items-center gap-1.5 text-xs font-semibold">
                  <Sparkles className="size-3.5 text-primary" /> Gemini বিশ্লেষণ — কল নোট থেকে পাওয়া তথ্য
                  {aiBusy && <Loader2 className="size-3.5 animate-spin" />}
                </p>
                <Button size="sm" variant="outline" disabled={aiBusy || busy || !leadId} onClick={() => void analyse()}>
                  কল নোট বিশ্লেষণ করুন
                </Button>
              </div>
              {aiFlagged && (
                <p className="text-xs text-destructive">নোটে সন্দেহজনক নির্দেশ পাওয়া গেছে — সেটি ব্যবহার হয়নি।</p>
              )}
              {ai && (found.length > 0 ? (
                <>
                  <ul className="space-y-1 text-xs">
                    {found.map((k) => (
                      <li key={k}>
                        <span className="font-medium">{EXTRACT_LABELS[k].replace(/: $/, ":")}</span>{" "}
                        {ai[k]!.value}
                        {ai[k]!.evidence ? <span className="text-muted-foreground"> — “{ai[k]!.evidence}”</span> : null}
                      </li>
                    ))}
                  </ul>
                  <Button size="sm" variant="default" disabled={saving || !leadId} onClick={() => void confirmSave()}>
                    {saving ? <Loader2 className="size-4 animate-spin" /> : null} নিশ্চিত করে লিডে সেভ করুন
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => { setText(applyExtraction(text, ai)); toast.success("সাজেশন খসড়ায় বসানো হয়েছে — মিলিয়ে দেখে সম্পাদনা করুন"); }}>
                    যাচাইয়ের ঘরে বসান
                  </Button>
                </>
              ) : (
                <p className="text-xs text-muted-foreground">নোটে নতুন তথ্য পাওয়া যায়নি — “যাচাই প্রয়োজন” ঘরগুলো খালি রইল।</p>
              ))}
              <p className="text-xs text-muted-foreground">Gemini শুধু সাজেশন দেয় — কোনো তথ্য সেভ হয় না, কিছু পাঠানো হয় না।</p>
            </div>
          )}
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
