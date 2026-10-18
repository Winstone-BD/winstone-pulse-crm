import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Bot, Copy, ArrowRight, WandSparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useT } from "@/lib/i18n";
import { draftInstruction, type InstructionDraft } from "@/lib/instruction-copilot";

export function InstructionCopilot({ surface, onAssignment }: { surface: "leadhub" | "system"; onAssignment?: (employeeId: string | null, count: number | null) => void }) {
  const t = useT();
  const [input, setInput] = useState("");
  const [draft, setDraft] = useState<InstructionDraft | null>(null);
  const [command, setCommand] = useState("");
  function prepare() {
    const next = draftInstruction(input);
    setDraft(next);
    setCommand(next.kind === "build" ? next.command : "");
  }
  return <section className="space-y-3 border-y border-border py-4" aria-label="Instruction copilot">
    <header className="flex flex-wrap items-center gap-2"><Bot className="size-5 text-primary" /><h2 className="font-semibold">Winstone AI · {t({ bn: "নির্দেশ কোপাইলট", en: "Instruction copilot" })}</h2><span className="ml-auto text-xs text-muted-foreground">{t({ bn: "AI ক্রেডিট খরচ: ০", en: "AI credits used: 0" })}</span></header>
    <Textarea aria-label="Copilot instruction" value={input} maxLength={4000} onChange={e => { setInput(e.target.value); setDraft(null); }} placeholder={t({ bn: "যেমন: WIN2607-কে ২৫ লিড দিন", en: "For example: assign 25 leads to WIN2607" })} />
    <Button disabled={!input.trim()} onClick={prepare}><WandSparkles className="size-4" />{t({ bn: "প্রস্তাব তৈরি", en: "Prepare proposal" })}</Button>
    {draft && <div aria-live="polite" className="space-y-3 border-l-2 border-primary pl-3">
      {draft.kind === "assignment" && <><p className="text-sm">{t({ bn: "লিড বণ্টনের প্রস্তাব", en: "Lead allocation proposal" })}: {draft.employeeId ?? t({ bn: "এজেন্ট বাছাই বাকি", en: "Agent not selected" })} · {draft.count ?? t({ bn: "সংখ্যা যাচাই বাকি", en: "Quantity needs review" })}</p>{surface === "leadhub" ? <Button variant="secondary" onClick={() => onAssignment?.(draft.employeeId, draft.count)}><ArrowRight className="size-4" />{t({ bn: "বণ্টন ফর্মে পর্যালোচনা", en: "Review in assignment form" })}</Button> : <Link to="/leadhub"><Button variant="secondary"><ArrowRight className="size-4" />{t({ bn: "LeadHub Nexus খুলুন", en: "Open LeadHub Nexus" })}</Button></Link>}</>}
      {draft.kind === "workspace" && <Link to="/system" search={{ s: draft.section }}><Button variant="secondary"><ArrowRight className="size-4" />{t({ bn: "সংশ্লিষ্ট কাজ খুলুন", en: "Open related workspace" })}</Button></Link>}
      {draft.kind === "build" && <><Textarea aria-label="Prepared Lovable instruction" value={command} onChange={e => setCommand(e.target.value)} /><Button variant="secondary" onClick={async () => { try { await navigator.clipboard.writeText(command); toast.success(t({ bn: "নির্দেশ কপি হয়েছে", en: "Instruction copied" })); } catch { toast.error(t({ bn: "কপি করা যায়নি; নির্দেশ নির্বাচন করুন", en: "Could not copy; select the instruction" })); } }}><Copy className="size-4" />{t({ bn: "Lovable নির্দেশ কপি", en: "Copy Lovable instruction" })}</Button></>}
    </div>}
  </section>;
}