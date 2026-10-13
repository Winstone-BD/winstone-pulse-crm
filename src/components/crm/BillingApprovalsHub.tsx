import { useQuery } from "@tanstack/react-query";
import { BellRing, CheckCircle2, Circle, CircleDot, ExternalLink, Loader2, ShieldCheck, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  advisory,
  nextAction,
  pendingCount,
  progression,
  reminderKey,
  reminderKind,
  type ApprovalSummary,
} from "@/lib/billing-advisor";
import { useAdminToken } from "@/lib/local-session";
import { billingApprovalSummary } from "@/lib/maintenance.functions";
import { deadlineLeftLabel, dhakaTime } from "@/lib/maintenance-rules";

/** The one architect review page. Approval lives only there (Google + private PIN). */
export const ARCHITECT_REVIEW_HREF = "/tech?review=1";

export function useBillingApprovals() {
  const adminToken = useAdminToken();
  return useQuery({
    queryKey: ["billing-approval-summary", Boolean(adminToken)],
    queryFn: () => billingApprovalSummary({ data: { adminToken } }) as Promise<ApprovalSummary>,
    refetchInterval: 60_000,
    retry: false,
  });
}

/** Status strip, real progression, next action, advisory AI and the review link. */
export function BillingApprovalsHub() {
  const q = useBillingApprovals();
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);
  const [showAi, setShowAi] = useState(false);

  if (q.isLoading) return <Loader2 className="size-5 animate-spin" aria-label="Loading billing" />;
  if (q.error || !q.data) {
    return <p className="card-elevated p-4 text-sm text-destructive">Billing status unavailable: {(q.error as Error | null)?.message ?? "no data"}</p>;
  }
  const s = q.data;
  const count = pendingCount(s);
  const toLock = new Date(s.lockAt).getTime() - now.getTime();
  const unlocked = s.unlockStatus === "approved" && s.unlockExpiresAt && new Date(s.unlockExpiresAt) > now;
  const access = s.locked ? "Locked" : unlocked ? "Temporarily unlocked" : "Active";
  const cards: [string, string, string?][] = [
    ["Monthly maintenance fee", `$${s.feeUsd.toFixed(2)} USD`, `Invoice ${s.period}`],
    ["Due date", dhakaTime(s.dueDate), s.paymentStatus === "verified" ? "Paid" : toLock > 0 ? `Lock in ${deadlineLeftLabel(toLock)}` : "Lock time passed"],
    ["Payment status", s.paymentStatus === "pending" ? "Reference awaiting check" : s.paymentStatus === "verified" ? "Verified" : "Unpaid", s.paymentRef ?? undefined],
    ["Access", access, unlocked ? `Auto-relocks ${dhakaTime(s.unlockExpiresAt)}` : undefined],
    ["Pending approval", count ? `${count} waiting` : "None", s.openRequests[0] ? `Requested ${s.openRequests[0].hours}h unlock` : undefined],
  ];

  return (
    <section aria-labelledby="billing-approvals-title" className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="billing-approvals-title" className="flex items-center gap-2 text-lg font-semibold">
          <ShieldCheck className="size-5 text-primary" /> Billing &amp; Approvals
          {count > 0 && <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-bold text-primary-foreground">{count}</span>}
        </h2>
        <Button variant="outline" size="sm" onClick={() => setShowAi((v) => !v)} aria-expanded={showAi}>
          <Sparkles className="size-4" /> Ask Winstone AI
        </Button>
      </div>

      <dl className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        {cards.map(([k, v, sub]) => (
          <div key={k} className="card-elevated min-w-0 p-3">
            <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{k}</dt>
            <dd className="mt-1 break-words text-sm font-semibold">{v}</dd>
            {sub && <dd className="break-words text-xs text-muted-foreground">{sub}</dd>}
          </div>
        ))}
      </dl>

      <ol className="card-elevated grid gap-2 p-4 text-sm sm:grid-cols-5" aria-label="Approval progress">
        {progression(s, now).map((st) => (
          <li key={st.key} className={`flex items-start gap-2 ${st.state === "todo" ? "text-muted-foreground" : ""}`}>
            {st.state === "done" ? <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" /> : st.state === "current" ? <CircleDot className="mt-0.5 size-4 shrink-0 text-primary" /> : <Circle className="mt-0.5 size-4 shrink-0" />}
            <span className={st.state === "current" ? "font-semibold" : ""}>{st.label}</span>
          </li>
        ))}
      </ol>

      <div className="card-elevated flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm"><b>Next action:</b> {nextAction(s)}</p>
        {s.canApprove ? (
          <Button asChild className="shrink-0">
            <a href={ARCHITECT_REVIEW_HREF}>Open Architect review <ExternalLink className="size-4" /></a>
          </Button>
        ) : (
          <p className="text-xs text-muted-foreground">Final approval is reserved for the System Architect's verified Google account and private PIN.</p>
        )}
      </div>

      {showAi && (
        <div className="card-elevated space-y-2 border-primary/30 p-4 text-sm" role="region" aria-label="Winstone AI billing explanation">
          <p className="flex items-center gap-2 font-semibold"><Sparkles className="size-4 text-primary" /> Winstone AI · advisory only</p>
          <ul className="list-disc space-y-1 pl-5">
            {advisory(s, now).map((line) => <li key={line}>{line}</li>)}
          </ul>
          <p className="text-xs text-muted-foreground">Built only from the saved billing record. Winstone AI cannot approve, reject, verify payment, change dates or amounts, or unlock.</p>
        </div>
      )}
    </section>
  );
}

/**
 * Non-blocking reminder: at most once per browser session per period/item set.
 * Pending architect item → priority dialog; deadline window → dismissible toast.
 * Nothing pending and outside the notice window → nothing.
 */
export function BillingReminder({ onReview }: { onReview: () => void }) {
  const q = useBillingApprovals();
  const [open, setOpen] = useState(false);
  const s = q.data;
  useEffect(() => {
    if (!s) return;
    const kind = reminderKind(s);
    if (!kind) return;
    const key = reminderKey(s, kind);
    if (window.sessionStorage.getItem(key) === "1") return;
    window.sessionStorage.setItem(key, "1");
    if (kind === "approval") setOpen(true);
    else toast.warning(`Invoice ${s.period}: $${s.feeUsd.toFixed(2)} USD due ${dhakaTime(s.dueDate)}`, {
      description: "Review the billing status before the lock time.",
      action: { label: "Review billing", onClick: onReview },
      duration: 12_000,
    });
  }, [s, onReview]);
  if (!s || !open) return null;
  const r = s.openRequests[0];
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><BellRing className="size-5 text-primary" /> Approval waiting for you</DialogTitle>
          <DialogDescription>Nothing is approved until you decide on the Architect page.</DialogDescription>
        </DialogHeader>
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
          <dt className="text-muted-foreground">Invoice</dt><dd>{s.period} · ${s.feeUsd.toFixed(2)} USD</dd>
          <dt className="text-muted-foreground">Reference</dt><dd className="break-all">{s.paymentRef ?? "— none submitted"}</dd>
          {r && <><dt className="text-muted-foreground">Unlock</dt><dd>{r.hours}h requested by {r.requestedBy}</dd></>}
          {r?.reason && <><dt className="text-muted-foreground">Context</dt><dd>{r.reason}</dd></>}
          <dt className="text-muted-foreground">Expiry</dt><dd>An approved unlock relocks automatically on the server.</dd>
        </dl>
        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" onClick={() => setOpen(false)}>Later</Button>
          <Button asChild><a href={ARCHITECT_REVIEW_HREF}>Review now</a></Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
