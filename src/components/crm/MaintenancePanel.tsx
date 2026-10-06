import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAdminToken } from "@/lib/local-session";
import {
  itMaintenance,
  requestSystemUnlock,
  setMaintenanceLockAt,
  setMaintenancePayment,
  verifyMaintenancePayment,
} from "@/lib/maintenance.functions";
import { MAINTENANCE_FEE_LABEL, UNLOCK_PRESET_HOURS, dhakaTime } from "@/lib/maintenance-rules";

function Tone({ tone, children }: { tone: "red" | "amber" | "green"; children: React.ReactNode }) {
  const cls =
    tone === "red"
      ? "border-destructive/40 bg-destructive/10 text-destructive"
      : tone === "amber"
        ? "border-warning/40 bg-warning/15 text-warning"
        : "border-success/40 bg-success/10 text-success";
  return <span className={`rounded-full border px-2 py-0.5 text-[11px] font-bold ${cls}`}>{children}</span>;
}

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
  const verify = useMutation(run(() => verifyMaintenancePayment({ data: { adminToken, paymentRef: ref } }), "Payment verified"));
  const pending = useMutation(run(() => setMaintenancePayment({ data: { adminToken, status: "pending" } }), "Marked as pending"));
  const unpaid = useMutation(run(() => setMaintenancePayment({ data: { adminToken, status: "unpaid", reason: "Payment rejected by IT" } }), "Marked as unpaid"));
  const unlock = useMutation(run(() => requestSystemUnlock({ data: { adminToken, hours, reason: reason || undefined } }), "Unlock request sent to System Architect"));
  const saveLock = useMutation(run(() => setMaintenanceLockAt({ data: { adminToken, lockAt: new Date(`${lockAt}:00+06:00`).toISOString() } }), "Lock time updated"));

  if (!adminToken) return <p className="text-sm text-muted-foreground">Unlock IT Console to manage maintenance.</p>;
  if (q.isLoading) return <Loader2 className="size-5 animate-spin" />;
  if (q.error || !q.data) return <p className="text-sm text-destructive">{(q.error as Error)?.message ?? "Unavailable"}</p>;
  const { state, requests, audit, periods } = q.data;

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

      <dl className="grid gap-2 text-sm sm:grid-cols-3">
        {[
          ["Billing period", state.period],
          ["Maintenance fee", MAINTENANCE_FEE_LABEL],
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

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-2 rounded-lg border border-border p-3">
          <p className="text-sm font-semibold">Payment verification</p>
          <Label htmlFor="mt-ref">Payment reference</Label>
          <Input id="mt-ref" value={ref} onChange={(e) => setRef(e.target.value)} placeholder="Transaction / receipt ID" />
          <Button className="w-full" disabled={ref.trim().length < 3 || verify.isPending || state.paymentStatus === "verified"} onClick={() => verify.mutate()}>
            Verify payment
          </Button>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" className="flex-1" disabled={pending.isPending || state.paymentStatus === "verified"} onClick={() => pending.mutate()}>Mark pending</Button>
            <Button variant="ghost" size="sm" className="flex-1" disabled={unpaid.isPending} onClick={() => unpaid.mutate()}>Mark unpaid</Button>
          </div>
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
        <div>
          <p className="mb-2 text-sm font-semibold">Payment history</p>
          <div className="max-h-72 space-y-1 overflow-y-auto text-xs">
            {periods.map((p) => (
              <div key={p.billing_period} className="flex flex-wrap justify-between gap-2 rounded border border-border p-2">
                <span>{p.billing_period} · ${Number(p.fee_usd).toFixed(2)} USD</span>
                <span>{p.payment_status.toUpperCase()} {p.payment_verified_by ? `· ${p.payment_verified_by}` : ""}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div>
        <p className="mb-2 text-sm font-semibold">Audit history</p>
        <div className="max-h-80 overflow-auto rounded border border-border">
          <table className="w-full min-w-[560px] text-xs">
            <thead className="bg-muted/50 text-left"><tr><th className="p-2">Time</th><th className="p-2">Action</th><th className="p-2">Actor</th><th className="p-2">Change</th><th className="p-2">Reason</th></tr></thead>
            <tbody>
              {audit.map((a) => (
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
