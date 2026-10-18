import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CheckCheck, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { resolveMyFollowUp } from "@/lib/agent-desk.functions";
import { useAdminToken } from "@/lib/local-session";
import { useLang } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export function FollowUpResolveActions({ leadId, leadName, className, compact = false }: { leadId: string; leadName?: string | null; className?: string; compact?: boolean }) {
  const adminToken = useAdminToken();
  const lang = useLang();
  const t = (bn: string, en: string) => lang === "bn" ? bn : en;
  const run = useServerFn(resolveMyFollowUp);
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<{ action: "complete" | "reschedule"; key: string } | null>(null);
  const [note, setNote] = useState("");
  const [at, setAt] = useState("");
  const mutation = useMutation({ mutationFn: async () => {
    if (!editing) return;
    return run({ data: { adminToken, leadId, action: editing.action, note, key: editing.key, ...(editing.action === "reschedule" ? { scheduledAt: new Date(`${at}:00+06:00`).toISOString() } : {}) } });
  }, onSuccess: () => {
    setEditing(null); toast.success(t("ফলো-আপের ইতিহাস সংরক্ষিত হয়েছে", "Follow-up history saved"));
    for (const key of ["crm-snapshot", "my-follow-ups", "follow-ups", "my-call-reports", "lead-extras", "lead360", "follow-up-history"]) void queryClient.invalidateQueries({ queryKey: [key] });
  }, onError: (error: Error) => toast.error(error.message) });
  const start = (action: "complete" | "reschedule") => { setNote(""); setAt(""); setEditing({ action, key: crypto.randomUUID() }); };
  return <div className={cn("flex flex-wrap items-center gap-2", className)}>
    <Button size="sm" variant="secondary" onClick={() => start("reschedule")} disabled={mutation.isPending}><RefreshCw className="size-4" />{t(compact ? "আবার" : "আবার ফলো-আপ", "Reschedule")}</Button>
    <Button size="sm" onClick={() => start("complete")} disabled={mutation.isPending}><CheckCheck className="size-4" />{t(compact ? "সম্পন্ন" : "ফলো-আপ সম্পন্ন", "Complete follow-up")}</Button>
    <Dialog open={Boolean(editing)} onOpenChange={open => { if (!open && !mutation.isPending) setEditing(null); }}><DialogContent><DialogHeader><DialogTitle>{editing?.action === "complete" ? t("ফলো-আপ সম্পন্ন", "Complete follow-up") : t("আবার ফলো-আপ", "Reschedule follow-up")}{leadName ? ` — ${leadName}` : ""}</DialogTitle></DialogHeader>
      <form className="space-y-4" onSubmit={e => { e.preventDefault(); mutation.mutate(); }}>
        {editing?.action === "reschedule" && <div className="space-y-2"><Label htmlFor={`retry-at-${leadId}`}>{t("নতুন সময় (ঢাকা)", "New time (Dhaka)")}</Label><Input id={`retry-at-${leadId}`} type="datetime-local" required value={at} onChange={e => setAt(e.target.value)} /></div>}
        <div className="space-y-2"><Label htmlFor={`outcome-${leadId}`}>{t("কারণ / ফলাফল", "Reason / outcome")} *</Label><Textarea id={`outcome-${leadId}`} required maxLength={2000} value={note} onChange={e => setNote(e.target.value)} /></div>
        <DialogFooter><Button type="button" variant="outline" onClick={() => setEditing(null)} disabled={mutation.isPending}>{t("ফিরুন", "Back")}</Button><Button type="submit" aria-busy={mutation.isPending} disabled={mutation.isPending || !note.trim() || (editing?.action === "reschedule" && !at)}>{t("সংরক্ষণ", "Save")}</Button></DialogFooter>
      </form>
    </DialogContent></Dialog>
  </div>;
}
