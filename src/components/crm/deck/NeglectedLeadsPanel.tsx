import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, ArrowRightLeft } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { ScoreBreakdown } from "@/components/crm/LeadInsightScoreCard";
import { listNeglectedHighPotential, listReassignmentAudit, reassignNeglectedLead } from "@/lib/lead-insight.functions";
import { useLeadHubToken } from "@/lib/local-session";
import { HIGH_POTENTIAL_SCORE, MIN_REASON, OVERDUE_FOLLOW_UP_HOURS } from "@/lib/lead-insight-score";
import { useT } from "@/lib/i18n";

type Data = Awaited<ReturnType<typeof listNeglectedHighPotential>>;
type Row = Data["leads"][number];

export function NeglectedLeadsPanel() {
  const token = useLeadHubToken();
  const list = useServerFn(listNeglectedHighPotential);
  const t = useT();
  const [open, setOpen] = useState<Row | null>(null);
  const q = useQuery({ queryKey: ["neglected-hp", token], queryFn: () => list({ data: { adminToken: token } }), retry: false });

  return (
    <section className="card-elevated space-y-3 p-4">
      <header>
        <h2 className="flex items-center gap-2 text-lg font-semibold"><AlertTriangle className="size-5 text-primary" /> {t({ bn: "অবহেলিত উচ্চ-সম্ভাবনার লিড", en: "Neglected high-potential leads" })}</h2>
        <p className="text-xs text-muted-foreground">{t({
          bn: `২ কার্যদিবস (৪৮ ঘণ্টা) যোগাযোগ হয়নি, বা ফলো-আপ ${OVERDUE_FOLLOW_UP_HOURS} ঘণ্টার বেশি বাকি — এবং স্কোর ≥ ${HIGH_POTENTIAL_SCORE} বা সাইট ভিজিটে আগ্রহ। স্বয়ংক্রিয় রিকল নিয়ম আগের মতোই চলে।`,
          en: `Not contacted for 2 business days (48h), or a follow-up over ${OVERDUE_FOLLOW_UP_HOURS}h overdue — and score ≥ ${HIGH_POTENTIAL_SCORE} or site-visit interest. The automatic recall rule still runs as before.`,
        })}</p>
      </header>
      {q.isPending && <p className="text-sm text-muted-foreground">{t({ bn: "লোড হচ্ছে…", en: "Loading…" })}</p>}
      {q.isError && <p className="text-sm text-destructive">{t({ bn: "তালিকা লোড হয়নি", en: "Couldn't load the list" })} <Button size="sm" variant="ghost" onClick={() => q.refetch()}>{t({ bn: "আবার চেষ্টা", en: "Try again" })}</Button></p>}
      {q.data && q.data.leads.length === 0 && <p className="text-sm text-muted-foreground">{t({ bn: "এখন কোনো অবহেলিত উচ্চ-সম্ভাবনার লিড নেই।", en: "No neglected high-potential leads right now." })}</p>}
      <ul className="divide-y divide-border">
        {q.data?.leads.map((l) => (
          <li key={l.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
            <div className="min-w-0">
              <p className="font-medium">{l.name ?? l.phone}</p>
              <p className="text-xs text-muted-foreground">
                {l.ownerName} · {l.reason === "uncontacted" ? t({ bn: "যোগাযোগ হয়নি", en: "Not contacted" }) : t({ bn: "ফলো-আপ বাকি", en: "Follow-up overdue" })} · {new Date(l.since).toLocaleDateString("en-GB", { timeZone: "Asia/Dhaka" })}
                {l.score.visitInterest && ` · ${t({ bn: "ভিজিটে আগ্রহ", en: "Visit interest" })}`}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-lg font-bold tabular-nums">{l.score.total}<span className="text-xs text-muted-foreground">/100</span></span>
              <Button size="sm" variant="secondary" onClick={() => setOpen(l)}><ArrowRightLeft className="size-4" /> {t({ bn: "বদলান", en: "Reassign" })}</Button>
            </div>
          </li>
        ))}
      </ul>
      {open && q.data && <ReassignDialog row={open} targets={q.data.targets} token={token} onClose={() => setOpen(null)} />}
      <ReassignmentAudit token={token} />
    </section>
  );
}

function ReassignmentAudit({ token }: { token: string | null }) {
  const t = useT();
  const fn = useServerFn(listReassignmentAudit);
  const q = useQuery({ queryKey: ["reassign-audit", token], queryFn: () => fn({ data: { adminToken: token } }), retry: false });
  if (q.isPending || q.isError || !q.data?.rows.length) return null;
  return (
    <div className="space-y-2 border-t border-border pt-3">
      <h3 className="text-sm font-semibold">{t({ bn: "বদলের ইতিহাস", en: "Reassignment history" })}</h3>
      <ul className="divide-y divide-border text-sm">
        {q.data.rows.map((r) => (
          <li key={r.id} className="py-2">
            <p className="font-medium">{r.leadName}: {r.fromName} → {r.toName}</p>
            <p className="text-xs text-muted-foreground">
              {new Date(r.at).toLocaleString("en-GB", { timeZone: "Asia/Dhaka" })} · {t({ bn: "করেছেন", en: "by" })} {r.by}
            </p>
            {r.reason && <p className="mt-0.5 text-xs text-muted-foreground">{t({ bn: "কারণ", en: "Reason" })}: {r.reason}</p>}
            {r.bypass && <p className="mt-0.5 text-xs text-destructive">{t({ bn: "বাইপাস", en: "Bypass" })}: {r.bypass}</p>}
          </li>
        ))}
      </ul>
    </div>
  );
}

function ReassignDialog({ row, targets, token, onClose }: { row: Row; targets: Data["targets"]; token: string | null; onClose: () => void }) {
  const t = useT();
  const qc = useQueryClient();
  const run = useServerFn(reassignNeglectedLead);
  const [to, setTo] = useState("");
  const [reason, setReason] = useState("");
  const [bypass, setBypass] = useState("");
  const [needsBypass, setNeedsBypass] = useState<{ upcomingVisits: number; activeBookings: number } | null>(null);
  const m = useMutation({
    mutationFn: () => run({ data: { adminToken: token, leadId: row.id, toAgentId: to, reason, bypassReason: bypass || null } }),
    onSuccess: (r) => {
      if (!r.ok) { setNeedsBypass({ upcomingVisits: r.upcomingVisits, activeBookings: r.activeBookings }); return; }
      toast.success(t({ bn: "লিড বদল হয়েছে ও ইতিহাসে লেখা হয়েছে", en: "Lead reassigned and logged to history" }));
      qc.invalidateQueries({ queryKey: ["neglected-hp"] });
      onClose();
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Reassignment failed"),
  });
  const ok = to && reason.trim().length >= MIN_REASON && (!needsBypass || bypass.trim().length >= MIN_REASON);

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{t({ bn: "লিড বদল", en: "Reassign lead" })} — {row.name ?? row.phone}</DialogTitle></DialogHeader>
        <div className="space-y-4 text-sm">
          <ScoreBreakdown score={row.score} />
          <label className="block space-y-1">
            <span className="font-medium">{t({ bn: "নতুন এজেন্ট", en: "New agent" })}</span>
            <select className="w-full rounded-md border border-input bg-background p-2" value={to} onChange={(e) => setTo(e.target.value)}>
              <option value="">—</option>
              {targets.filter((a) => a.id !== row.ownerId).map((a) => (
                <option key={a.id} value={a.id} disabled={!a.available}>{a.name} · {a.assignedToday}/{a.quota}{a.why ? ` · ${a.why}` : ""}</option>
              ))}
            </select>
          </label>
          <label className="block space-y-1">
            <span className="font-medium">{t({ bn: "কারণ (আবশ্যক)", en: "Reason (required)" })}</span>
            <Textarea value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} />
          </label>
          {needsBypass && (
            <div className="space-y-2 rounded-lg border border-destructive/40 bg-destructive/5 p-3">
              <p className="font-medium text-destructive">{t({
                bn: `এই লিডের ${needsBypass.upcomingVisits}টি নিশ্চিত আসন্ন সাইট ভিজিট ও ${needsBypass.activeBookings}টি সক্রিয় বুকিং আছে।`,
                en: `This lead has ${needsBypass.upcomingVisits} confirmed upcoming site visit(s) and ${needsBypass.activeBookings} active booking(s).`,
              })}</p>
              <Textarea placeholder={t({ bn: "কেন তবুও বদল করছেন?", en: "Why transfer anyway?" })} value={bypass} onChange={(e) => setBypass(e.target.value)} maxLength={500} />
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>{t({ bn: "বাতিল", en: "Cancel" })}</Button>
          <Button disabled={!ok || m.isPending} onClick={() => m.mutate()}>{needsBypass ? t({ bn: "বাইপাস করে বদলান", en: "Bypass and reassign" }) : t({ bn: "বদলান", en: "Reassign" })}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
