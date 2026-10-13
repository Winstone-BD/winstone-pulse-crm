import { useMutation } from "@tanstack/react-query";
import { CheckCircle2, Clock3, Loader2, ShieldCheck, XCircle } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { architectPaymentDecision, type architectOverview } from "@/lib/maintenance.functions";
import { dhakaTime, usd } from "@/lib/maintenance-rules";

type Overview = Awaited<ReturnType<typeof architectOverview>>;
type Period = Overview["periods"][number];
type AuditRow = Overview["audit"][number];

const PURPOSE = "Winstone Pulse · CRM Subscription Access";

function meta(a: AuditRow, key: string): string | null {
  const m = (a.metadata ?? {}) as Record<string, unknown>;
  return typeof m[key] === "string" ? (m[key] as string) : null;
}

function statusOf(p: Period): { label: string; tone: "pending" | "approved" | "rejected" | "open" } {
  if (p.payment_status === "pending") return { label: "Pending verification", tone: "pending" };
  if (p.payment_status === "verified") return { label: "Approved", tone: "approved" };
  if (p.payment_rejected_at) return { label: "Rejected", tone: "rejected" };
  return { label: "Unpaid — no reference", tone: "open" };
}

const TONE: Record<string, string> = {
  pending: "border-warning/40 bg-warning/10 text-warning",
  approved: "border-success/40 bg-success/10 text-success",
  rejected: "border-destructive/40 bg-destructive/10 text-destructive",
  open: "border-border bg-muted text-muted-foreground",
};

/**
 * Architect-only Payment Approvals. Every figure comes from stored billing rows and
 * the append-only maintenance audit; the server re-checks the architect identity,
 * session, current reference and pending state on every decision.
 */
export function PaymentApprovals({
  overview,
  session,
  stale,
  onDone,
}: {
  overview: Overview;
  session: string;
  stale: boolean;
  onDone: () => void;
}) {
  const { periods, audit } = overview;
  const pending = periods.filter((p) => p.payment_status === "pending" && p.payment_ref);
  const approvedCount = audit.filter((a) => a.action === "payment_verified").length;
  const rejectedCount = audit.filter((a) => a.action === "payment_rejected").length;
  const submissions = audit.filter((a) => a.action === "payment_submitted");
  const decisions = audit.filter((a) => a.action === "payment_verified" || a.action === "payment_rejected");
  const [selected, setSelected] = useState<string | null>(pending[0]?.billing_period ?? null);
  const current = pending.find((p) => p.billing_period === selected) ?? pending[0] ?? null;

  return (
    <section aria-labelledby="payment-approvals-title" className="card-elevated space-y-4 p-4 sm:p-5">
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 id="payment-approvals-title" className="text-lg font-semibold">Payment Approvals</h2>
          <p className="text-xs text-muted-foreground">
            Restricted to the System Architect. Super Admin and IT can submit or view, never approve.
          </p>
        </div>
        <span className="inline-flex items-center gap-1 rounded-full border border-primary/40 bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
          <ShieldCheck className="size-3" aria-hidden /> Architect verified
        </span>
      </header>

      {stale && (
        <p role="status" className="rounded-md border border-warning/40 bg-warning/10 p-2 text-xs">
          Showing the last loaded data — refreshing. Decisions are re-checked by the server.
        </p>
      )}

      <dl className="grid grid-cols-3 gap-2 text-center">
        {[
          ["Pending", pending.length, Clock3],
          ["Approved", approvedCount, CheckCircle2],
          ["Rejected", rejectedCount, XCircle],
        ].map(([label, n, Icon]) => {
          const I = Icon as typeof Clock3;
          return (
            <div key={label as string} className="rounded-lg border border-border p-2">
              <dt className="flex items-center justify-center gap-1 text-[11px] text-muted-foreground">
                <I className="size-3" aria-hidden /> {label as string}
              </dt>
              <dd className="text-xl font-semibold tabular-nums">{n as number}</dd>
            </div>
          );
        })}
      </dl>
      <p className="text-[11px] text-muted-foreground">Counts come from recorded decisions in the audit log (latest 60 events).</p>

      {pending.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
          No payment references are awaiting verification.
        </p>
      ) : (
        <div className="grid gap-4 md:grid-cols-[minmax(0,14rem)_1fr]">
          <ul className="space-y-2" aria-label="Pending payments">
            {pending.map((p) => (
              <li key={p.billing_period}>
                <button
                  type="button"
                  onClick={() => setSelected(p.billing_period)}
                  aria-pressed={current?.billing_period === p.billing_period}
                  className="w-full rounded-lg border border-border p-3 text-left text-sm transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring aria-pressed:border-primary aria-pressed:bg-primary/5"
                >
                  <span className="block font-semibold">{p.billing_period}</span>
                  <span className="block break-all text-xs text-muted-foreground">Ref {p.payment_ref}</span>
                </button>
              </li>
            ))}
          </ul>
          {current && (
            <ReviewPanel
              key={`${current.billing_period}-${current.payment_ref}`}
              period={current}
              submission={submissions.find((s) => s.billing_period === current.billing_period && meta(s, "payment_ref") === current.payment_ref) ?? null}
              session={session}
              disabled={stale}
              onDone={onDone}
            />
          )}
        </div>
      )}

      <div className="space-y-2">
        <h3 className="text-sm font-semibold">Decision history</h3>
        {decisions.length === 0 ? (
          <p className="text-xs text-muted-foreground">No payment decisions recorded yet.</p>
        ) : (
          <ul className="divide-y divide-border rounded-lg border border-border">
            {decisions.map((a) => {
              const approved = a.action === "payment_verified";
              return (
                <li key={a.id} className="grid gap-0.5 p-3 text-xs sm:grid-cols-[8rem_1fr]">
                  <span className={`inline-flex h-fit w-fit rounded-full border px-2 py-0.5 font-semibold ${TONE[approved ? "approved" : "rejected"]}`}>
                    {approved ? "Approved" : "Rejected"}
                  </span>
                  <span className="space-y-0.5">
                    <span className="block font-semibold">{a.billing_period ?? "—"} · Ref {meta(a, "payment_ref") ?? "—"}</span>
                    <span className="block">By {a.actor} · {dhakaTime(a.at)} (Dhaka)</span>
                    {a.reason && <span className="block text-muted-foreground">Reason: {a.reason}</span>}
                    {a.request_id && <span className="block break-all text-muted-foreground">Unlock request: {a.request_id}</span>}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}

function ReviewPanel({
  period,
  submission,
  session,
  disabled,
  onDone,
}: {
  period: Period;
  submission: AuditRow | null;
  session: string;
  disabled: boolean;
  onDone: () => void;
}) {
  const [reason, setReason] = useState("");
  const [confirm, setConfirm] = useState<null | "approve" | "reject">(null);
  const inflight = useRef(false);
  const status = statusOf(period);
  const decide = useMutation({
    mutationFn: (approve: boolean) =>
      architectPaymentDecision({ data: { session, approve, reason: reason.trim(), expectedRef: period.payment_ref ?? undefined } }),
    onSuccess: (_d, approve) => {
      toast.success(approve ? "Payment approved — access restored for this period" : "Payment rejected — IT will see the reason");
      setReason("");
      onDone();
    },
    onError: (e: Error) => {
      toast.error(e.message);
      onDone();
    },
    onSettled: () => {
      inflight.current = false;
      setConfirm(null);
    },
  });
  const run = (approve: boolean) => {
    if (inflight.current) return; // duplicate click guard; server compare-and-set is the real guard
    inflight.current = true;
    decide.mutate(approve);
  };
  const reasonOk = reason.trim().length >= 3;
  const busy = decide.isPending;
  const amount = period.total_cents != null ? moneyLabel(period.total_cents, period.currency) : "—";

  return (
    <article className="space-y-3 rounded-lg border border-border p-4 text-sm" aria-label={`Review ${period.billing_period}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-semibold">{PURPOSE}</h3>
        <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${TONE[status.tone]}`}>{status.label}</span>
      </div>
      <dl className="grid grid-cols-[8rem_1fr] gap-x-2 gap-y-1 text-xs">
        <dt className="text-muted-foreground">Billing period</dt><dd>{period.billing_period}</dd>
        <dt className="text-muted-foreground">Payment reference</dt><dd className="break-all font-semibold">{period.payment_ref}</dd>
        <dt className="text-muted-foreground">Amount</dt>
        <dd>
          {amount}
          {period.base_cents != null && period.vat_cents != null && (
            {period.vat_cents ? <span className="text-muted-foreground"> ({moneyLabel(period.base_cents, period.currency)} + {moneyLabel(period.vat_cents, period.currency)} VAT)</span> : null}
          )}
        </dd>
        <dt className="text-muted-foreground">Submitted by</dt><dd>{submission?.actor ?? "—"}</dd>
        <dt className="text-muted-foreground">Submitted at</dt><dd>{submission ? `${dhakaTime(submission.at)} (Dhaka)` : "—"}</dd>
        <dt className="text-muted-foreground">Note</dt><dd>{submission?.reason ?? "—"}</dd>
        <dt className="text-muted-foreground">Due date</dt><dd>{dhakaTime(period.due_date)}</dd>
        <dt className="text-muted-foreground">Lock at</dt><dd>{dhakaTime(period.lock_at)}</dd>
      </dl>
      <p className="rounded-md bg-muted p-2 text-xs text-muted-foreground">
        Only a reference was submitted — no gateway transaction is attached. Check it against your bank/bKash statement first.
        Approving marks this period paid, restores CRM access and saves a receipt. Rejecting returns it to unpaid with your reason.
      </p>
      <div className="space-y-1">
        <Label htmlFor={`reason-${period.billing_period}`}>Audit reason (required)</Label>
        <Textarea
          id={`reason-${period.billing_period}`}
          value={reason}
          maxLength={300}
          onChange={(e) => setReason(e.target.value)}
          placeholder="e.g. Matched TrxID on bKash statement 13 Oct"
          rows={2}
        />
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button className="sm:flex-1" disabled={!reasonOk || busy || disabled} onClick={() => setConfirm("approve")}>
          {busy && confirm === "approve" ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <CheckCircle2 className="size-4" aria-hidden />}
          Approve payment
        </Button>
        <Button variant="destructive" className="sm:flex-1" disabled={!reasonOk || busy || disabled} onClick={() => setConfirm("reject")}>
          <XCircle className="size-4" aria-hidden /> Reject
        </Button>
      </div>

      <AlertDialog open={confirm !== null} onOpenChange={(o) => !o && !busy && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirm === "approve" ? "Approve this payment?" : "Reject this payment?"}</AlertDialogTitle>
            <AlertDialogDescription>
              {period.billing_period} · Ref {period.payment_ref} · {amount}.{" "}
              {confirm === "approve"
                ? "The period becomes paid and access is restored. This decision is final and recorded under your account."
                : "The period returns to unpaid and IT sees your reason. This decision is recorded under your account."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy}
              onClick={(e) => { e.preventDefault(); run(confirm === "approve"); }}
              className={confirm === "reject" ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : undefined}
            >
              {busy && <Loader2 className="size-4 animate-spin" aria-hidden />}
              {confirm === "approve" ? "Confirm approval" : "Confirm rejection"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </article>
  );
}
