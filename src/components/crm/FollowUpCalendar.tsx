import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CalendarClock, Check, RefreshCw, X, AlertTriangle } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { WebCallButton } from "@/components/crm/WebCallButton";
import { WhatsAppAction } from "@/components/crm/WhatsAppAction";
import { completeFollowUp, myFollowUps, rescheduleFollowUp, changeFollowUp, recoverMissedFollowUp } from "@/lib/call-reports.functions";
import { isOpenFollowUp, type FollowUpAction, type FollowUpHealth } from "@/lib/follow-up-lifecycle";
import { useAdminToken } from "@/lib/local-session";
import { useLang } from "@/lib/i18n";

const tones: Record<string, string> = { overdue: "text-destructive", due_today: "text-warning", completed: "text-success", upcoming: "text-info", cancelled: "text-muted-foreground", rescheduled: "text-muted-foreground" };
export function FollowUpCalendar() {
  const adminToken = useAdminToken();
  const lang = useLang();
  const t = (bn: string, en: string) => lang === "bn" ? bn : en;
  const labels: Record<FollowUpHealth, string> = { overdue: t("সময় পার হয়েছে", "Overdue"), due_today: t("আজ করতে হবে", "Due Today"), completed: t("সম্পন্ন", "Completed"), upcoming: t("আসছে", "Upcoming"), cancelled: t("বাতিল", "Cancelled"), rescheduled: t("সময় পুনর্নির্ধারিত", "Rescheduled") };
  const actions: Record<FollowUpAction | 'recover', string> = { complete: t("সম্পন্ন করুন", "Complete"), reschedule: t("সময় বদলান", "Reschedule"), cancel: t("বাতিল করুন", "Cancel follow-up"), miss: t("মিস হয়েছে", "Mark missed"), recover: t('নতুন recovery follow-up', 'New recovery follow-up') };
  const queryClient = useQueryClient();
  const fetchEvents = useServerFn(myFollowUps);
  const done = useServerFn(completeFollowUp);
  const move = useServerFn(rescheduleFollowUp);
  const change = useServerFn(changeFollowUp);
  const recover = useServerFn(recoverMissedFollowUp);
  const [filter, setFilter] = useState<FollowUpHealth | "all">("all");
  const [editing, setEditing] = useState<{ id: string; action: FollowUpAction | 'recover'; key: string } | null>(null);
  const [reason, setReason] = useState("");
  const [nextAction, setNextAction] = useState('');
  const [newAt, setNewAt] = useState("");
  const events = useQuery({ queryKey: ["follow-ups", "health", adminToken ? "pin" : "session"], queryFn: () => fetchEvents({ data: { adminToken } }), refetchInterval: 60_000 });
  const mutation = useMutation({
    mutationFn: async () => {
      if (!editing) return;
      const data = { adminToken, eventId: editing.id, reason, key: editing.key };
      if (editing.action === 'recover') return recover({ data: { ...data, nextAction, scheduledAt: new Date(`${newAt}:00+06:00`).toISOString() } });
      if (editing.action === "complete") return done({ data });
      if (editing.action === "reschedule") return move({ data: { ...data, scheduledAt: new Date(`${newAt}:00+06:00`).toISOString() } });
      return change({ data: { ...data, action: editing.action } });
    },
    onSuccess: () => {
      setEditing(null);
      toast.success(t("ফলো-আপের ইতিহাস সংরক্ষিত হয়েছে", "Follow-up history saved"));
      for (const key of ["follow-ups", "followup-reminders", "lead-extras", "lead360", "follow-up-history", "crm-snapshot"]) void queryClient.invalidateQueries({ queryKey: [key] });
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const all = events.data ?? [];
  const replacedIds = new Set(all.map(row => row.parent_follow_up_id).filter(Boolean));
  const healthRows = all.filter(row => !isOpenFollowUp(row.status) || !replacedIds.has(row.id));
  const rows = filter === 'all' ? all : healthRows.filter(row => row.health === filter);
  const start = (id: string, action: FollowUpAction | 'recover') => { setReason(""); setNextAction(''); setNewAt(""); setEditing({ id, action, key: crypto.randomUUID() }); };
  return <section className="min-w-0 space-y-4 border-y border-border py-4">
    <header className="flex flex-wrap items-center justify-between gap-2">
      <h2 className="flex items-center gap-2 font-semibold"><CalendarClock className="size-4 text-gold" />{t("ফলো-আপ স্বাস্থ্য", "Follow-up Health")}</h2>
      <Button variant="ghost" size="sm" onClick={() => setFilter("all")} aria-pressed={filter === "all"}>{t("সব ইতিহাস", "All history")}</Button>
    </header>
    <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
      {(["overdue", "due_today", "completed", "upcoming"] as const).map(key => <Button key={key} variant="outline" className="h-auto min-h-16 flex-col items-start gap-1 bg-card p-3" aria-pressed={filter === key} onClick={() => setFilter(key)}>
        <span className={tones[key]}>{labels[key]}</span><span className="text-xl font-semibold tabular-nums">{healthRows.filter(row => row.health === key).length}</span>
      </Button>)}
    </div>
    {events.isPending ? <p role="status" className="text-sm text-muted-foreground">{t("লোড হচ্ছে…", "Loading…")}</p> : events.isError ? <div role="alert"><p className="text-sm text-destructive">{t("ফলো-আপ লোড করা যায়নি", "Could not load follow-ups")}</p><Button variant="outline" onClick={() => void events.refetch()}>{t("আবার চেষ্টা", "Retry")}</Button></div> : !rows.length ? <p className="py-6 text-center text-sm text-muted-foreground">{t("এই তালিকায় কোনো ফলো-আপ নেই", "No follow-ups in this list")}</p> : <ul className="max-h-[640px] space-y-2 overflow-y-auto">
      {rows.map(event => <li key={event.id} className="min-w-0 space-y-2 rounded-lg border border-border bg-card p-3">
        <div className="flex flex-wrap justify-between gap-2"><p className="break-words font-semibold">{event.customer_name || t("ক্রেতা", "Customer")} <span className="text-xs font-normal text-muted-foreground">{event.phone_number}</span></p><Badge variant="secondary" className={tones[event.health]}>{event.status === "missed" ? t("মিস হয়েছে · সময় পার", "Missed · Overdue") : labels[event.health]}</Badge></div>
        <p className="text-xs text-muted-foreground">{new Date(event.scheduled_at).toLocaleString(lang === "bn" ? "bn-BD" : "en-GB", { timeZone: "Asia/Dhaka" })} · {event.category}</p>
        {event.next_action || event.note ? <p className="break-words text-sm">{event.next_action || event.note}</p> : null}
        {event.transition_reason ? <p className="break-words text-sm"><span className="font-semibold">{t("ফলাফল / কারণ", "Outcome / reason")}: </span>{event.transition_reason}</p> : null}
        {event.parent_follow_up_id ? <p className="break-all text-xs text-muted-foreground">{t("আগের ফলো-আপ", "Previous follow-up")}: {event.parent_follow_up_id}</p> : null}
        {replacedIds.has(event.id) && <p className="text-xs text-muted-foreground">{t('নতুন সংযুক্ত ফলো-আপ আছে', 'A linked follow-up exists')}</p>}
        {isOpenFollowUp(event.status) && !replacedIds.has(event.id) && <div className="flex flex-wrap gap-2">
          {event.phone_number && <><WebCallButton leadId={event.lead_id} phone={event.phone_number} name={event.customer_name} label={t("কল", "Call")} /><WhatsAppAction phone={event.phone_number} leadId={event.lead_id} label={t("মেসেজ", "Message")} variant="ghost" /></>}
          <Button size="sm" variant="outline" onClick={() => start(event.id, "complete")}><Check className="size-4" />{actions.complete}</Button>
          <Button size="sm" variant="ghost" onClick={() => start(event.id, "reschedule")}><RefreshCw className="size-4" />{actions.reschedule}</Button>
          {event.health === 'overdue' && <Button size="sm" variant="outline" onClick={() => start(event.id, 'recover')}><RefreshCw className="size-4" />{actions.recover}</Button>}
          <Button size="sm" variant="ghost" onClick={() => start(event.id, "cancel")}><X className="size-4" />{actions.cancel}</Button>
          {event.health === "overdue" && event.status !== "missed" && <Button size="sm" variant="ghost" onClick={() => start(event.id, "miss")}><AlertTriangle className="size-4" />{actions.miss}</Button>}
        </div>}
      </li>)}
    </ul>}
    <Dialog open={Boolean(editing)} onOpenChange={open => { if (!open && !mutation.isPending) setEditing(null); }}><DialogContent><DialogHeader><DialogTitle>{editing ? actions[editing.action] : ""}</DialogTitle></DialogHeader>
      <form className="space-y-4" onSubmit={e => { e.preventDefault(); mutation.mutate(); }}>
        {(editing?.action === "reschedule" || editing?.action === 'recover') && <div className="space-y-2"><Label htmlFor="follow-up-at">{t("নতুন তারিখ ও সময় (ঢাকা)", "New date and time (Dhaka)")}</Label><Input id="follow-up-at" type="datetime-local" required value={newAt} onChange={e => setNewAt(e.target.value)} /></div>}
        {editing?.action === 'recover' && <div className="space-y-2"><Label htmlFor="follow-up-next">{t('পরবর্তী কাজ', 'Next action')} *</Label><Textarea id="follow-up-next" required maxLength={2000} value={nextAction} onChange={e => setNextAction(e.target.value)} /></div>}
        <div className="space-y-2"><Label htmlFor="follow-up-reason">{t("কারণ / ফলাফল", "Reason / outcome")} *</Label><Textarea id="follow-up-reason" required maxLength={2000} value={reason} onChange={e => setReason(e.target.value)} /></div>
        <DialogFooter><Button type="button" variant="outline" disabled={mutation.isPending} onClick={() => setEditing(null)}>{t("ফিরুন", "Back")}</Button><Button type="submit" disabled={mutation.isPending || !reason.trim() || ((editing?.action === "reschedule" || editing?.action === 'recover') && !newAt) || (editing?.action === 'recover' && !nextAction.trim())} aria-busy={mutation.isPending}>{t("সংরক্ষণ", "Save")}</Button></DialogFooter>
      </form>
    </DialogContent></Dialog>
  </section>;
}
