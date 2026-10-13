import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MaintenanceCountdown, NoticePreview } from "@/components/crm/MaintenanceNotice";
import { UnlockRequestCard } from "@/components/crm/UnlockRequestCard";
import { Loader2, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAdminToken } from "@/lib/local-session";
import {
  itMaintenance,
  nextMaintenanceInvoicePreview,
  requestSystemUnlock,
  setMaintenanceLockAt,
  submitMaintenancePayment,
  withdrawMaintenancePayment,
} from "@/lib/maintenance.functions";
import { MAINTENANCE_FEE_LABEL, UNLOCK_PRESET_HOURS, dhakaTime, billingStatusLine, moneyLabel } from "@/lib/maintenance-rules";
import { downloadVoucher, printVoucher } from "@/lib/voucher";

function Tone({ tone, children }: { tone: "red" | "amber" | "green"; children: React.ReactNode }) {
  const cls =
    tone === "red"
      ? "border-destructive/40 bg-destructive/10 text-destructive"
      : tone === "amber"
        ? "border-warning/40 bg-warning/15 text-warning"
        : "border-success/40 bg-success/10 text-success";
  return <span className={`rounded-full border px-2 py-0.5 text-[11px] font-bold ${cls}`}>{children}</span>;
}

const HISTORY_ACTIONS: Record<string, { label: string; tone: "red" | "amber" | "green" }> = {
  maintenance_due: { label: "Invoice issued", tone: "amber" },
  payment_submitted: { label: "Payment submitted", tone: "amber" },
  payment_withdrawn: { label: "Submission withdrawn", tone: "red" },
  payment_verified: { label: "Verified", tone: "green" },
  payment_rejected: { label: "Rejected", tone: "red" },
  lock_time_changed: { label: "Deadline changed", tone: "amber" },
  system_locked: { label: "Workspace locked", tone: "red" },
  unlock_approved: { label: "Access restored", tone: "green" },
};

/** Dhaka wall-clock value for a datetime-local input. */
function toLocalInput(iso: string) {
  const d = new Date(new Date(iso).getTime() + 6 * 3600_000);
  return d.toISOString().slice(0, 16);
}

/** IT Console → Maintenance & System Access. */
export function MaintenancePanel() {
  const adminToken = useAdminToken();
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["it-maintenance", adminToken],
    queryFn: () => itMaintenance({ data: { adminToken } }),
    enabled: Boolean(adminToken),
    refetchInterval: 30_000,
  });
  const [ref, setRef] = useState("");
  const [hours, setHours] = useState(4);
  const [reason, setReason] = useState("");
  const [lockAt, setLockAt] = useState("");

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ["it-maintenance"] });
    void qc.invalidateQueries({ queryKey: ["maintenance-status"] });
  };
  const run = (fn: () => Promise<unknown>, ok: string) => ({
    mutationFn: fn,
    onSuccess: () => { toast.success(ok); refresh(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const submit = useMutation(run(() => submitMaintenancePayment({ data: { adminToken, paymentRef: ref } }), "Submitted — waiting for System Architect verification"));
  const withdraw = useMutation(run(() => withdrawMaintenancePayment({ data: { adminToken, reason: "Submission withdrawn by IT" } }), "Submission withdrawn"));
  const [search, setSearch] = useState("");
  const [kind, setKind] = useState<AuditKind>("all");
  const unlock = useMutation(run(() => requestSystemUnlock({ data: { adminToken, hours, reason: reason || undefined } }), "Unlock request sent to System Architect"));
  const saveLock = useMutation(run(() => setMaintenanceLockAt({ data: { adminToken, lockAt: new Date(`${lockAt}:00+06:00`).toISOString() } }), "Lock time updated"));

  if (!adminToken) return <p className="text-sm text-muted-foreground">Unlock IT Console to manage maintenance.</p>;
  if (q.isLoading) return <Loader2 className="size-5 animate-spin" />;
  if (q.error || !q.data) return <p className="text-sm text-destructive">{(q.error as Error)?.message ?? "Unavailable"}</p>;
  const { state, requests, audit, periods, vouchers } = q.data;

  return (
    <section className="card-elevated space-y-5 p-4">
      <header className="flex flex-wrap items-center gap-2">
        <ShieldCheck className="size-5 text-primary" />
        <h2 className="text-base font-semibold">Maintenance & System Access</h2>
        <span className="ml-auto flex gap-2">
          {state.locked ? <Tone tone="red">🔒 LOCKED</Tone> : <Tone tone="green">CRM ACTIVE</Tone>}
          {state.paymentStatus === "verified" ? <Tone tone="green">🟢 VERIFIED</Tone> : state.paymentStatus === "pending" ? <Tone tone="amber">🟠 PENDING</Tone> : <Tone tone="red">🔴 UNPAID</Tone>}
          {state.openRequest && <Tone tone="amber">UNLOCK PENDING</Tone>}
        </span>
      </header>

      <MaintenanceCountdown />

      <UnlockRequestCard state={state} adminToken={adminToken} />

      <dl className="grid gap-2 text-sm sm:grid-cols-3">
        {[
          ["Billing period", state.period],
          ["Maintenance fee", state.amountLabel],
          ["Due date", dhakaTime(state.dueDate)],
          ["Lock time", dhakaTime(state.lockAt)],
          ["Verified by", state.paymentVerifiedBy ?? "—"],
          ["Verified at", dhakaTime(state.paymentVerifiedAt)],
          ["Unlock status", state.unlockStatus.toUpperCase()],
          ["Unlock expires", dhakaTime(state.unlockExpiresAt)],
          ["Approved by", state.approvedBy ?? "—"],
        ].map(([k, v]) => (
          <div key={k} className="rounded-md border border-border p-2">
            <dt className="text-[11px] text-muted-foreground">{k}</dt>
            <dd className="font-medium">{v}</dd>
          </div>
        ))}
      </dl>

      <NextInvoicePreview />

      <div className="rounded-lg border border-border bg-muted/40 p-3 text-xs leading-relaxed">
        <p className="mb-1 text-sm font-semibold">কীভাবে কাজ করে (ঢাকা সময়)</p>
        <ol className="list-decimal space-y-0.5 pl-4 text-muted-foreground">
          <li>৯ তারিখ ০০:০০ — সবার স্ক্রিনে পেমেন্ট নোটিশ শুরু।</li>
          <li>১৪ তারিখ ০০:০০ — Renewal Due ({MAINTENANCE_FEE_LABEL} পরিশোধের দিন)।</li>
          <li>১৪ তারিখ ২৩:৫৯ পর্যন্ত — CRM পুরোপুরি চালু (গ্রেস সময়)।</li>
          <li>১৫ তারিখ ০০:০০ — পেমেন্ট যাচাই না হলে এজেন্ট/HQ লক; IT Console খোলা থাকে।</li>
          <li>পেমেন্ট হলে নিচে আসল ট্রানজ্যাকশন/রসিদ নম্বর লিখে “Submit for verification” চাপুন — মাসটি PENDING হবে।</li>
          <li>চূড়ান্ত যাচাই শুধু System Architect করেন; যাচাই হলেই মাসটি PAID হয়, লক হবে না।</li>
          <li>যাচাইয়ের আগে জরুরি দরকার হলে “Request system unlock” — শুধু System Architect সর্বোচ্চ ২৪ ঘণ্টার জন্য খুলতে পারে।</li>
        </ol>
        <p className="mt-1 text-muted-foreground">এই বক্সের মাস: <b>{state.period}</b>। প্রতিটি কাজ কে, কখন, কোন রেফারেন্সে করেছে — নিচের অডিটে স্থায়ীভাবে থাকে।</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-2 rounded-lg border border-border p-3">
          <p className="text-sm font-semibold">Payment submission — {state.period}</p>
          {state.paymentRef && <p className="text-xs text-muted-foreground">Current reference: <b>{state.paymentRef}</b></p>}
          <Label htmlFor="mt-ref">Payment reference</Label>
          <Input id="mt-ref" value={ref} onChange={(e) => setRef(e.target.value)} placeholder="bKash TrxID / bank receipt" />
          <Button className="w-full" disabled={ref.trim().length < 3 || submit.isPending || state.paymentStatus === "verified"} onClick={() => submit.mutate()}>
            Submit for verification
          </Button>
          <Button variant="ghost" size="sm" className="w-full" disabled={withdraw.isPending || state.paymentStatus !== "pending"} onClick={() => withdraw.mutate()}>Withdraw submission</Button>
          <p className="text-xs text-muted-foreground">Final verification requires System Architect approval.</p>
        </div>

        <div className="space-y-2 rounded-lg border border-border p-3">
          <p className="text-sm font-semibold">Request system unlock</p>
          {state.paymentStatus !== "verified" && (
            <p className="rounded bg-warning/15 p-2 text-xs text-warning">Payment is not verified. The request will be sent marked as unverified.</p>
          )}
          <Label>Requested duration</Label>
          <div className="flex flex-wrap gap-1">
            {UNLOCK_PRESET_HOURS.map((h) => (
              <Button key={h} size="sm" variant={hours === h ? "default" : "secondary"} onClick={() => setHours(h)}>{h}h</Button>
            ))}
          </div>
          <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason (optional)" />
          <Button variant="destructive" className="w-full" disabled={unlock.isPending || state.openRequest} onClick={() => unlock.mutate()}>
            {state.openRequest ? "Request waiting for Architect" : "REQUEST SYSTEM UNLOCK"}
          </Button>
        </div>

        <div className="space-y-2 rounded-lg border border-border p-3">
          <p className="text-sm font-semibold">Lock time (Asia/Dhaka)</p>
          <Input type="datetime-local" value={lockAt || toLocalInput(state.lockAt)} onChange={(e) => setLockAt(e.target.value)} />
          <Button variant="secondary" className="w-full" disabled={!lockAt || saveLock.isPending} onClick={() => saveLock.mutate()}>Save lock time</Button>
          <p className="text-xs text-muted-foreground">Default: 15th at 00:00 Dhaka (notice from the 9th).</p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div>
          <p className="mb-2 text-sm font-semibold">Unlock requests</p>
          <div className="max-h-72 space-y-2 overflow-y-auto">
            {requests.length === 0 && <p className="text-xs text-muted-foreground">No requests yet.</p>}
            {requests.map((r) => (
              <div key={r.id} className="rounded-md border border-border p-2 text-xs">
                <div className="flex flex-wrap justify-between gap-2">
                  <b>{r.billing_period} · {r.requested_hours}h</b>
                  <Tone tone={r.status === "approved" ? "green" : r.status === "denied" ? "red" : "amber"}>{r.status.toUpperCase()}</Tone>
                </div>
                <p>By {r.requested_by} · {dhakaTime(r.requested_at)} · payment {r.payment_status_at_request}</p>
                {r.decision_reason && <p>Architect: {r.decision_reason}</p>}
                {r.unlock_expires_at && <p>Expires {dhakaTime(r.unlock_expires_at)}</p>}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div>
        <p className="mb-1 text-sm font-semibold">Billing notice preview</p>
        <p className="mb-2 text-xs text-muted-foreground">How each payment notice looks before publishing — amber, blue, red, and verified. Display-only; nothing here changes the real invoice.</p>
        <NoticePreview />
      </div>

      <div>
        <p className="mb-1 text-sm font-semibold">Subscription payment history</p>
        <p className="mb-2 text-xs text-muted-foreground">Each invoice with its deadline, every payment submission and the verification result. Read-only.</p>
        <div className="space-y-2">
          {periods.length === 0 && <p className="text-xs text-muted-foreground">No invoices yet.</p>}
          {periods.map((p) => {
            const events = audit
              .filter((a) => a.billing_period === p.billing_period && HISTORY_ACTIONS[a.action])
              .slice()
              .sort((a, b) => a.at.localeCompare(b.at));
            const deadlinePassed = p.lock_at ? new Date(p.lock_at).getTime() <= Date.now() : false;
            return (
              <details key={p.billing_period} className="rounded border border-border bg-card" open={p.billing_period === state.period}>
                <summary className="flex cursor-pointer flex-wrap items-center gap-2 p-3 text-xs">
                  <span className="font-semibold">Invoice {p.billing_period}</span>
                  <span>{p.total_cents != null ? moneyLabel(p.total_cents, p.currency) : `$${Number(p.fee_usd).toFixed(2)} USD`}</span>
                  <Tone tone={p.payment_status === "verified" ? "green" : p.payment_status === "pending" ? "amber" : "red"}>
                    {p.payment_status === "verified" ? "VERIFIED" : p.payment_status === "pending" ? "VERIFICATION PENDING" : "UNPAID"}
                  </Tone>
                  <span className="ml-auto text-muted-foreground">
                    Deadline {p.lock_at ? dhakaTime(p.lock_at) : "—"}
                    {p.payment_status !== "verified" && deadlinePassed ? " · passed" : ""}
                  </span>
                </summary>
                <ol className="space-y-1.5 border-t border-border p-3 text-xs">
                  {events.length === 0 && <li className="text-muted-foreground">No submissions recorded for this invoice.</li>}
                  {events.map((e) => {
                    const meta = (e.metadata ?? {}) as { payment_ref?: string };
                    const kind = HISTORY_ACTIONS[e.action]!;
                    return (
                      <li key={e.id} className="flex flex-wrap items-baseline gap-x-2">
                        <Tone tone={kind.tone}>{kind.label}</Tone>
                        <span className="text-muted-foreground">{dhakaTime(e.at)}</span>
                        <span>by {e.actor}</span>
                        {meta.payment_ref && <span>· Ref {meta.payment_ref}</span>}
                        {e.reason && <span className="w-full text-muted-foreground">“{e.reason}”</span>}
                      </li>
                    );
                  })}
                </ol>
              </details>
            );
          })}
        </div>
      </div>

      <div>
        <p className="mb-1 text-sm font-semibold">Saved receipts</p>
        <p className="mb-2 text-xs text-muted-foreground">Every verified payment keeps a permanent receipt here — reopen, download, or print it any time.</p>
        <div className="space-y-2">
          {vouchers.length === 0 && <p className="text-xs text-muted-foreground">No receipts yet — one is saved automatically when a payment is verified.</p>}
          {vouchers.map((v) => (
            <div key={v.no} className="flex flex-wrap items-center gap-2 rounded border border-success/40 bg-success/5 p-3 text-xs">
              <div className="min-w-0">
                <p className="font-semibold">Receipt {v.no}</p>
                <p className="text-muted-foreground">{v.period} · {moneyLabel(v.totalCents, v.currency)} paid · ref {v.ref} · {v.at}</p>
              </div>
              <div className="ml-auto flex gap-2">
                <Button size="sm" variant="outline" onClick={() => downloadVoucher(v)}>Download</Button>
                <Button size="sm" variant="outline" onClick={() => printVoucher(v)}>Print</Button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div>
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <p className="text-sm font-semibold">Audit history</p>
          <Input className="h-8 max-w-xs text-xs" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search action, reason, user, date…" />
          <div className="flex flex-wrap gap-1">
            {AUDIT_KINDS.map((k) => (
              <Button key={k.id} size="sm" variant={kind === k.id ? "default" : "secondary"} onClick={() => setKind(k.id)}>{k.label}</Button>
            ))}
          </div>
        </div>
        <div className="max-h-80 overflow-auto rounded border border-border">
          <table className="w-full min-w-[560px] text-xs">
            <thead className="bg-muted/50 text-left"><tr><th className="p-2">Time</th><th className="p-2">Action</th><th className="p-2">Actor</th><th className="p-2">Change</th><th className="p-2">Reason</th></tr></thead>
            <tbody>
              {filterAudit(audit, kind, search).map((a) => (
                <tr key={a.id} className="border-t border-border">
                  <td className="p-2 whitespace-nowrap">{dhakaTime(a.at)}</td>
                  <td className="p-2">{a.action}</td>
                  <td className="p-2">{a.actor} <span className="text-muted-foreground">({a.actor_role})</span></td>
                  <td className="p-2">{a.previous_state ?? ""}{a.new_state ? ` → ${a.new_state}` : ""}</td>
                  <td className="p-2">{a.reason ?? ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

type AuditKind = "all" | "payment" | "lock" | "policy";
const AUDIT_KINDS: { id: AuditKind; label: string }[] = [
  { id: "all", label: "সব" },
  { id: "payment", label: "পেমেন্ট" },
  { id: "lock", label: "লক / আনলক" },
  { id: "policy", label: "পলিসি" },
];

type AuditRow = { at: string; action: string; actor: string; actor_role: string; reason: string | null; billing_period: string | null };

function filterAudit<T extends AuditRow>(rows: T[], kind: AuditKind, search: string): T[] {
  const q = search.trim().toLowerCase();
  return rows.filter((a) => {
    const act = a.action;
    if (kind === "payment" && !act.startsWith("payment") && act !== "maintenance_due") return false;
    if (kind === "lock" && !/locked|relocked|unlock/.test(act)) return false;
    if (kind === "policy" && !/lock_at|policy|lock_time/.test(act)) return false;
    if (!q) return true;
    return [act, a.actor, a.actor_role, a.reason ?? "", a.billing_period ?? "", dhakaTime(a.at)].join(" ").toLowerCase().includes(q);
  });
}

/** Read-only: next not-yet-generated invoice from the canonical rule + configured VAT. Creates nothing, changes nothing. */
function NextInvoicePreview() {
  const adminToken = useAdminToken();
  const q = useQuery({
    queryKey: ["next-invoice-preview", adminToken],
    queryFn: () => nextMaintenanceInvoicePreview({ data: { adminToken } }),
    enabled: Boolean(adminToken),
  });
  if (q.isLoading) return <p className="text-xs text-muted-foreground">Loading next invoice preview…</p>;
  if (q.error || !q.data) return <p className="text-xs text-destructive">Next invoice preview unavailable.</p>;
  const { preview: p, status } = q.data;
  const row = (k: string, v: string) => (<div className="flex justify-between gap-3"><dt className="text-muted-foreground">{k}</dt><dd className="font-medium tabular-nums">{v}</dd></div>);
  return (
    <section aria-label="Next invoice preview" className="rounded-lg border border-dashed border-border p-3 text-sm">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Preview only · not an issued invoice</p>
      <p className="mt-1 text-xs"><span className="text-muted-foreground">Current status: </span><span className="font-semibold">{billingStatusLine(status)}</span></p>
      <p className="mt-2 font-semibold">Next invoice · {p.period}</p>
      <dl className="mt-1 space-y-0.5 text-xs">
        {row("Subtotal", p.subtotalLabel)}
        {row("VAT rate", p.vatRateLabel)}
        {row("VAT amount", p.vatLabel ?? "—")}
        {row("Total", p.totalLabel ?? "— (VAT rate not configured)")}
        {row("Due (Asia/Dhaka)", dhakaTime(p.dueAt))}
        {row("Lock (Asia/Dhaka)", dhakaTime(p.lockAt))}
      </dl>
      {p.vatRateBps != null && <p className="mt-1 text-[11px] text-muted-foreground">VAT = {p.subtotalLabel} × {p.vatRateLabel} = {p.vatLabel}</p>}
    </section>
  );
}
