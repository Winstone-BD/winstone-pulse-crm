import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CalendarClock, FileText, Loader2, MailCheck, Percent, ShieldCheck, Wallet } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { submitReferenceAndRequestUnlock } from "@/lib/maintenance.functions";
import { UNLOCK_PRESET_HOURS, dhakaTime } from "@/lib/maintenance-rules";

type State = { period: string; paymentStatus: string; paymentRef?: string | null; lockAt: string; openRequest: boolean };

/** Billing card (reference design) + real payment-reference / unlock request form. */
export function UnlockRequestCard({ state, adminToken }: { state: State; adminToken: string | null }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [ref, setRef] = useState("");
  const [hours, setHours] = useState(4);
  const [reason, setReason] = useState("");
  const verified = state.paymentStatus === "verified";
  const pending = state.paymentStatus === "pending";

  const send = useMutation({
    mutationFn: () => submitReferenceAndRequestUnlock({ data: { adminToken, paymentRef: ref.trim(), hours, reason: reason.trim() || undefined } }),
    onSuccess: (r) => {
      toast.success(r.emailed ? "Reference saved — approval email sent to the System Architect" : "Reference saved — request created, but the email could not be sent");
      setOpen(false); setRef(""); setReason("");
      void qc.invalidateQueries({ queryKey: ["it-maintenance"] });
      void qc.invalidateQueries({ queryKey: ["maintenance-status"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const badge = verified
    ? "border-success/40 bg-success/10 text-success"
    : pending ? "border-warning/40 bg-warning/15 text-warning" : "border-destructive/40 bg-destructive/10 text-destructive";

  return (
    <div className="space-y-4 rounded-xl border border-border bg-card p-4 sm:p-5">
      <header className="flex flex-wrap items-center gap-3 border-b border-border pb-4">
        <div className="grid size-11 place-items-center rounded-lg bg-destructive/10 text-destructive"><FileText className="size-5" /></div>
        <div>
          <p className="text-lg font-bold tracking-tight">WINSTONE <span className="text-destructive">PULSE</span></p>
          <p className="text-xs text-muted-foreground">CRM · Subscription Billing · {state.period}</p>
        </div>
        <span className={`ml-auto rounded-full border px-3 py-1 text-xs font-semibold ${badge}`}>
          {verified ? "Verified" : pending ? "Verification Pending" : "Not Paid"}
        </span>
      </header>

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Monthly subscription total</p>
          <p className="text-4xl font-bold text-destructive sm:text-5xl">$18.16</p>
          <p className="text-sm text-muted-foreground">Current CRM invoice (VAT included)</p>
        </div>
        <dl className="divide-y divide-border rounded-lg border border-border text-sm">
          <Row icon={<FileText className="size-4" />} k="Invoice amount" v="$18.16 USD" />
          <Row icon={<Percent className="size-4" />} k="VAT" v="Included" />
          <Row icon={<Wallet className="size-4" />} k="Payment status" v={verified ? "Verified" : pending ? `Pending · ${state.paymentRef ?? ""}` : "Not verified"} tone={verified ? "text-success" : "text-destructive"} />
        </dl>
      </div>

      {!verified && (
        <div className="space-y-3 rounded-lg border border-destructive/40 bg-destructive/5 p-3">
          <p className="flex gap-2 text-sm"><AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" />
            <span><b>Billing reconciliation required.</b> Submit the real bKash/bank reference so the System Architect can verify it.</span></p>
          <p className="flex gap-2 border-t border-destructive/20 pt-3 text-sm"><CalendarClock className="mt-0.5 size-4 shrink-0 text-destructive" />
            <span>Suspension deadline: <b className="text-destructive">{dhakaTime(state.lockAt)}</b> · Asia/Dhaka (UTC+6)</span></p>
        </div>
      )}

      <p className="flex gap-2 rounded-lg border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
        <ShieldCheck className="size-4 shrink-0 text-primary" />
        Approval email goes from info@winstonebd.com to the authorized approver. The link works once, for 2 hours, and needs a Confirm press.
      </p>

      <Button variant="destructive" size="lg" className="w-full" disabled={state.openRequest} onClick={() => setOpen(true)}>
        <MailCheck className="size-4" /> {state.openRequest ? "Request waiting for approval" : "Review Invoice & Submit Reference"}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Payment reference & unlock request</DialogTitle>
            <DialogDescription>Only enter a real transaction ID. Nothing unlocks until the System Architect approves.</DialogDescription>
          </DialogHeader>
          <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); send.mutate(); }}>
            <div className="space-y-1">
              <Label htmlFor="ur-ref">Payment reference / TrxID</Label>
              <Input id="ur-ref" value={ref} onChange={(e) => setRef(e.target.value)} placeholder="bKash TrxID / bank receipt no." maxLength={120} required />
            </div>
            <div className="space-y-1">
              <Label>Unlock duration</Label>
              <div className="flex flex-wrap gap-1">
                {UNLOCK_PRESET_HOURS.map((h) => (
                  <Button key={h} type="button" size="sm" variant={hours === h ? "default" : "secondary"} onClick={() => setHours(h)}>{h}h</Button>
                ))}
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="ur-note">Note (optional)</Label>
              <Textarea id="ur-note" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} rows={3} />
            </div>
            <Button type="submit" variant="destructive" className="w-full" disabled={ref.trim().length < 3 || send.isPending}>
              {send.isPending ? <Loader2 className="size-4 animate-spin" /> : <MailCheck className="size-4" />} Submit & email approver
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Row({ icon, k, v, tone }: { icon: React.ReactNode; k: string; v: string; tone?: string }) {
  return (
    <div className="flex items-center gap-3 p-3">
      <span className="grid size-8 place-items-center rounded-full bg-muted text-muted-foreground">{icon}</span>
      <dt className="font-medium">{k}</dt>
      <dd className={`ml-auto text-right font-semibold ${tone ?? ""}`}>{v}</dd>
    </div>
  );
}
