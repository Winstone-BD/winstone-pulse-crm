import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { KeyRound, Loader2, LogOut, ShieldAlert, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import {
  architectDecision,
  architectPaymentDecision,
  architectIdentity,
  architectLogin,
  architectOverview,
} from "@/lib/maintenance.functions";
import { CRM_ONLY_FEE_LABEL, MAINTENANCE_FEE_LABEL, UNLOCK_PRESET_HOURS, dhakaTime } from "@/lib/maintenance-rules";

export const Route = createFileRoute("/tech")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "System Architect Control Center — Winstone Pulse" },
      { name: "description", content: "Restricted maintenance unlock control for the Winstone Pulse System Architect." },
      { property: "og:title", content: "System Architect Control Center — Winstone Pulse" },
      { property: "og:description", content: "Restricted maintenance unlock control for the Winstone Pulse System Architect." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: ArchitectPage,
});

function ArchitectPage() {
  const [hasSession, setHasSession] = useState<boolean | null>(null);
  const [session, setSession] = useState<string | null>(null); // memory only
  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => setHasSession(Boolean(data.session)));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setHasSession(Boolean(s)));
    return () => sub.subscription.unsubscribe();
  }, []);

  const identity = useQuery({
    queryKey: ["architect-identity", hasSession],
    queryFn: () => architectIdentity(),
    enabled: hasSession === true,
    retry: false,
  });

  const shell = (child: React.ReactNode) => (
    <main className="mx-auto min-h-screen max-w-3xl space-y-6 p-4 sm:p-8">
      <header className="flex items-center gap-2">
        <ShieldCheck className="size-6 text-primary" />
        <h1 className="text-xl font-bold">SYSTEM ARCHITECT CONTROL CENTER</h1>
        {hasSession && (
          <Button variant="ghost" size="sm" className="ml-auto" onClick={() => { setSession(null); void supabase.auth.signOut(); }}>
            <LogOut className="size-4" /> Sign out
          </Button>
        )}
      </header>
      {child}
    </main>
  );

  if (hasSession === null) return shell(<Loader2 className="size-5 animate-spin" />);
  if (!hasSession) {
    return shell(
      <div className="card-elevated space-y-3 p-6">
        <p className="text-sm">Sign in with the authorized Google account to continue.</p>
        <Button
          onClick={async () => {
            const r = await lovable.auth.signInWithOAuth("google", {
              redirect_uri: `${window.location.origin}/tech${window.location.search}`,
              extraParams: { prompt: "select_account" },
            });
            if (r.error) toast.error(r.error.message);
          }}
        >
          Continue with Google
        </Button>
      </div>,
    );
  }
  if (identity.isLoading) return shell(<Loader2 className="size-5 animate-spin" />);
  if (!identity.data?.authorized) {
    return shell(
      <div className="card-elevated space-y-2 border-destructive/40 p-6">
        <p className="flex items-center gap-2 font-bold text-destructive"><ShieldAlert className="size-5" /> ACCESS DENIED</p>
        <p className="text-sm">This Google account is not authorized as System Architect.</p>
        <Dialog open>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-destructive"><ShieldAlert className="size-5" /> Approval failed</DialogTitle>
            </DialogHeader>
            <p className="text-sm">This account cannot approve payments or unlock the system. Nothing was changed.</p>
            <Button variant="outline" onClick={() => void supabase.auth.signOut()}>Sign out and try another account</Button>
          </DialogContent>
        </Dialog>
      </div>,
    );
  }
  if (!session) return shell(<CredentialStep onSession={setSession} />);
  return shell(<><AutoApprove session={session} /><Dashboard session={session} onExpired={() => setSession(null)} /></>);
}

function CredentialStep({ onSession }: { onSession: (s: string) => void }) {
  const [value, setValue] = useState("");
  const login = useMutation({
    mutationFn: () => architectLogin({ data: { credential: value } }),
    onSuccess: (r) => { setValue(""); onSession(r.session); },
    onError: (e: Error) => { setValue(""); toast.error(e.message); },
  });
  return (
    <form className="card-elevated space-y-3 p-6" onSubmit={(e) => { e.preventDefault(); login.mutate(); }}>
      <p className="flex items-center gap-2 text-sm font-semibold"><KeyRound className="size-4" /> Secure architect credential</p>
      <Input type="password" autoComplete="off" value={value} onChange={(e) => setValue(e.target.value)} />
      <Button type="submit" disabled={!value || login.isPending}>Verify</Button>
    </form>
  );
}

function Dashboard({ session, onExpired }: { session: string; onExpired: () => void }) {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["architect-overview"],
    queryFn: () => architectOverview({ data: { session } }),
    refetchInterval: 30_000,
    retry: false,
  });
  useEffect(() => {
    if (q.error) { toast.error((q.error as Error).message); onExpired(); }
  }, [q.error, onExpired]);
  if (!q.data) return <Loader2 className="size-5 animate-spin" />;
  const { state, requests } = q.data;
  const open = requests.filter((r) => r.status === "requested");
  const last = requests.find((r) => r.status === "approved");

  return (
    <div className="space-y-6">
      {state.stage === "unlocked" && (
        <div className="card-elevated border-success/40 p-4 text-sm">
          <p className="font-bold text-success">SYSTEM UNLOCKED</p>
          <p>Approved by: System Architect · Started {dhakaTime(state.unlockStartedAt)} · Expires {dhakaTime(state.unlockExpiresAt)}</p>
          {state.approvalReason && <p>Reason: {state.approvalReason}</p>}
        </div>
      )}
      <table className="card-elevated w-full text-sm">
        <tbody>
          {[
            ["CRM Status", state.locked ? "LOCKED" : "ACTIVE"],
            ["Maintenance Fee", MAINTENANCE_FEE_LABEL],
            ["Billing Period", state.period],
            ["Due Date", dhakaTime(state.dueDate)],
            ["Payment Status", state.paymentStatus.toUpperCase()],
            ["Payment Reference", state.paymentRef ?? "—"],
            ["Unlock Request", open.length ? "PENDING" : (requests[0]?.status ?? "none").toUpperCase()],
            ["Last Unlock", dhakaTime(last?.unlock_started_at)],
            ["Unlock Expires", dhakaTime(state.unlockExpiresAt)],
            ["Approved By", state.approvedBy ?? "—"],
          ].map(([k, v]) => (
            <tr key={k} className="border-b border-border last:border-0">
              <td className="p-2 text-muted-foreground">{k}</td>
              <td className="p-2 font-semibold">{v}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="card-elevated space-y-1 p-4 text-sm">
        <p className="font-bold">Unlock pricing (15% VAT included)</p>
        <p><b>CRM only — installation files:</b> {CRM_ONLY_FEE_LABEL}</p>
        <p><b>Full operating system unlock:</b> {MAINTENANCE_FEE_LABEL}</p>
        <p className="text-xs text-muted-foreground">Approvals on this page apply to the CRM part only. Keeping the whole operating system unlocked requires the full bill payment.</p>
      </div>
      <PaymentReview session={session} status={state.paymentStatus} paymentRef={state.paymentRef} period={state.period} onDone={() => void qc.invalidateQueries({ queryKey: ["architect-overview"] })} />
      <h2 className="text-base font-semibold">Maintenance access requests</h2>
      {open.length === 0 && <p className="text-sm text-muted-foreground">No pending request.</p>}
      {open.map((r) => (
        <RequestCard key={r.id} r={r} session={session} locked={state.locked} onDone={() => void qc.invalidateQueries({ queryKey: ["architect-overview"] })} />
      ))}
    </div>
  );
}

type Req = Awaited<ReturnType<typeof architectOverview>>["requests"][number];

function RequestCard({ r, session, locked, onDone }: { r: Req; session: string; locked: boolean; onDone: () => void }) {
  const [hours, setHours] = useState<number>(r.requested_hours);
  const [custom, setCustom] = useState("");
  const [reason, setReason] = useState("");
  const minutes = custom ? Math.round(Number(custom) * 60) : hours * 60;
  const decide = useMutation({
    mutationFn: (approve: boolean) =>
      architectDecision({ data: { session, requestId: r.id, approve, minutes: approve ? minutes : undefined, reason: reason || undefined } }),
    onSuccess: (res) => { toast.success(res.status === "approved" ? "System unlocked" : "Request denied"); onDone(); },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <div className="card-elevated space-y-3 p-4 text-sm">
      <p className="font-semibold">IT Console has requested temporary system unlock.</p>
      <dl className="grid grid-cols-2 gap-1 text-xs">
        <dt>Request ID</dt><dd className="break-all">{r.id}</dd>
        <dt>Billing period</dt><dd>{r.billing_period}</dd>
        <dt>Maintenance fee</dt><dd>{MAINTENANCE_FEE_LABEL}</dd>
        <dt>Payment status</dt><dd className={r.payment_status_at_request === "verified" ? "text-success" : "text-destructive"}>{r.payment_status_at_request.toUpperCase()}</dd>
        <dt>Payment verified</dt><dd>{dhakaTime(r.payment_verified_at_request)}</dd>
        <dt>Requested by</dt><dd>{r.requested_by}</dd>
        <dt>Requested at</dt><dd>{dhakaTime(r.requested_at)}</dd>
        <dt>Reason</dt><dd>{r.reason ?? "—"}</dd>
        <dt>Current system</dt><dd>{locked ? "LOCKED" : "ACTIVE"}</dd>
      </dl>
      <div className="flex flex-wrap gap-1">
        {UNLOCK_PRESET_HOURS.map((h) => (
          <Button key={h} size="sm" variant={!custom && hours === h ? "default" : "secondary"} onClick={() => { setCustom(""); setHours(h); }}>{h} Hour{h > 1 ? "s" : ""}</Button>
        ))}
        <Input className="w-32" inputMode="decimal" placeholder="Custom hours" value={custom} onChange={(e) => setCustom(e.target.value)} />
      </div>
      <Input placeholder="Reason (required to deny)" value={reason} onChange={(e) => setReason(e.target.value)} />
      <div className="flex gap-2">
        <Button disabled={decide.isPending} onClick={() => decide.mutate(true)}>APPROVE & UNLOCK</Button>
        <Button variant="destructive" disabled={decide.isPending || reason.trim().length < 3} onClick={() => decide.mutate(false)}>DENY</Button>
      </div>
    </div>
  );
}

/** Architect-only payment verification. IT can only submit a reference. */
function PaymentReview({ session, status, paymentRef, period, onDone }: { session: string; status: string; paymentRef: string | null; period: string; onDone: () => void }) {
  const [reason, setReason] = useState("");
  const decide = useMutation({
    mutationFn: (approve: boolean) => architectPaymentDecision({ data: { session, approve, reason } }),
    onSuccess: (_d, approve) => { toast.success(approve ? "Payment verified — no lock this month" : "Payment rejected"); setReason(""); onDone(); },
    onError: (e: Error) => toast.error(e.message),
  });
  if (status !== "pending" || !paymentRef) return null;
  return (
    <div className="card-elevated space-y-2 border-warning/40 p-4 text-sm">
      <p className="font-bold">Payment submitted for verification — {period}</p>
      <p>Reference: <b>{paymentRef}</b> · {MAINTENANCE_FEE_LABEL}</p>
      <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Audit reason (required)" />
      <div className="flex gap-2">
        <Button disabled={reason.trim().length < 3 || decide.isPending} onClick={() => decide.mutate(true)}>Verify &amp; mark paid</Button>
        <Button variant="destructive" disabled={reason.trim().length < 3 || decide.isPending} onClick={() => decide.mutate(false)}>Reject</Button>
      </div>
    </div>
  );
}

/**
 * Pay → Google → PIN flow (?auto=1): once the server has accepted the authorized
 * Google account AND the PIN, the pending payment and open unlock requests are
 * approved automatically. The server re-checks the architect on every call, so a
 * wrong account can never approve — it gets "Approval failed" before this runs.
 */
function AutoApprove({ session }: { session: string }) {
  const qc = useQueryClient();
  const [result, setResult] = useState<null | { ok: boolean; text: string }>(null);
  const [ran, setRan] = useState(false);
  const auto = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("auto") === "1";
  useEffect(() => {
    if (!auto || ran) return;
    setRan(true);
    void (async () => {
      try {
        const { state, requests } = await architectOverview({ data: { session } });
        const done: string[] = [];
        if (state.paymentStatus === "pending" && state.paymentRef) {
          await architectPaymentDecision({ data: { session, approve: true, reason: "Auto-approved: authorized architect signed in with PIN" } });
          done.push("payment verified");
        }
        for (const r of requests.filter((x) => x.status === "requested")) {
          await architectDecision({ data: { session, requestId: r.id, approve: true, minutes: r.requested_hours * 60, reason: "Auto-approved by authorized architect" } });
          done.push("system unlocked");
        }
        setResult(done.length
          ? { ok: true, text: `President unlock approved — ${[...new Set(done)].join(" and ")}.` }
          : { ok: false, text: "Nothing to approve yet — no payment reference or unlock request has been submitted." });
      } catch (e) {
        setResult({ ok: false, text: `Approval failed: ${(e as Error).message}` });
      } finally {
        window.history.replaceState(null, "", "/tech");
        void qc.invalidateQueries({ queryKey: ["architect-overview"] });
      }
    })();
  }, [auto, ran, session, qc]);
  return (
    <Dialog open={result !== null} onOpenChange={(v) => { if (!v) setResult(null); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className={result?.ok ? "flex items-center gap-2 text-success" : "flex items-center gap-2 text-destructive"}>
            {result?.ok ? <ShieldCheck className="size-5" /> : <ShieldAlert className="size-5" />}
            {result?.ok ? "President unlock" : "Approval failed"}
          </DialogTitle>
        </DialogHeader>
        <p className="text-sm">{result?.text}</p>
        <Button onClick={() => setResult(null)}>OK</Button>
      </DialogContent>
    </Dialog>
  );
}
