import { useMutation, useQuery } from "@tanstack/react-query";
import { useRouterState } from "@tanstack/react-router";
import { Lock, LogIn, ShieldAlert } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { lovable } from "@/integrations/lovable";
import { useAdminToken } from "@/lib/local-session";
import { getMaintenanceStatus, requestPaymentHelp } from "@/lib/maintenance.functions";
import { MAINTENANCE_FEE_LABEL, dhakaTime } from "@/lib/maintenance-rules";

export function useMaintenance() {
  const adminToken = useAdminToken();
  return useQuery({
    queryKey: ["maintenance-status", Boolean(adminToken)],
    queryFn: () => getMaintenanceStatus({ data: { adminToken } }),
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  });
}

type Status = NonNullable<ReturnType<typeof useMaintenance>["data"]>;

function statusLabel(s: Status) {
  if (s.stage === "paid") return "VERIFIED";
  if (s.stage === "unlocked") return "TEMPORARILY UNLOCKED";
  if (s.openRequest) return "UNLOCK PENDING";
  if (s.paymentStatus === "pending") return "PAYMENT PENDING";
  return "PAYMENT REQUIRED";
}

/** Whether any maintenance notice should be visible at all. */
function needsNotice(s: Status) {
  return s.stage === "upcoming" || s.stage === "soon" || s.stage === "due_today" || s.stage === "locked";
}

function RequestButton() {
  const adminToken = useAdminToken();
  const send = useMutation({
    mutationFn: () => requestPaymentHelp({ data: { adminToken } }),
    onSuccess: () => toast.success("IT Console has been notified."),
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <Button variant="destructive" className="w-full" disabled={send.isPending || send.isSuccess} onClick={() => send.mutate()}>
      {send.isSuccess ? "REQUEST SENT TO IT CONSOLE" : "PAYMENT / UNLOCK REQUEST"}
    </Button>
  );
}

/** Direct Google sign-in for IT Console / System Architect from the lock screen. */
function LockSignInButton() {
  const [busy, setBusy] = useState(false);
  return (
    <Button
      variant="outline"
      className="w-full"
      disabled={busy}
      onClick={() => {
        setBusy(true);
        void lovable.auth
          .signInWithOAuth("google", { redirect_uri: window.location.origin })
          .then((r) => {
            if (r.error) toast.error(r.error.message);
          })
          .finally(() => setBusy(false));
      }}
    >
      <LogIn className="size-4" /> {busy ? "Signing in…" : "Sign in with Google (IT / Architect)"}
    </Button>
  );
}

function NoticeBody({ s }: { s: Status }) {
  return (
    <div className="space-y-3 text-sm">
      <p>
        {s.locked
          ? "Winstone CRM is temporarily unavailable because the monthly system maintenance payment is pending."
          : "Your monthly system maintenance payment is due."}
      </p>
      <dl className="grid grid-cols-2 gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3">
        <dt className="text-muted-foreground">Fee</dt>
        <dd className="font-semibold">{MAINTENANCE_FEE_LABEL}</dd>
        <dt className="text-muted-foreground">Billing date</dt>
        <dd className="font-semibold">14th of every month (lock 15th 00:00)</dd>
        <dt className="text-muted-foreground">Lock time</dt>
        <dd className="font-semibold">{dhakaTime(s.lockAt)}</dd>
        <dt className="text-muted-foreground">Current status</dt>
        <dd className="font-semibold text-destructive">{statusLabel(s)}</dd>
      </dl>
      <p className="text-muted-foreground">
        Please contact IT Console / authorized team to complete payment and request system unlock.
      </p>
      <RequestButton />
    </div>
  );
}

/** The red / amber / green "P" badge with its popup. Renders nothing when nothing is due. */
export function MaintenanceBadge() {
  const { data } = useMaintenance();
  const [open, setOpen] = useState(false);
  if (!data) return null;
  if (data.stage === "paid") {
    return <span className="rounded-full border border-success/40 bg-success/10 px-2 py-0.5 text-[11px] font-bold text-success">🟢 VERIFIED</span>;
  }
  if (!needsNotice(data) && !data.openRequest) return null;
  const amber = data.openRequest || data.paymentStatus === "pending";
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-bold ${
          amber && !data.locked
            ? "border-warning/50 bg-warning/15 text-warning"
            : "border-destructive/50 bg-destructive/15 text-destructive"
        }`}
        aria-label="System maintenance notice"
      >
        {amber && !data.locked ? "🟠" : "🔴"} P
        {data.locked && <span className="inline-flex items-center gap-0.5"><Lock className="size-3" /> LOCKED</span>}
        {data.openRequest && !data.locked && <span>UNLOCK PENDING</span>}
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <ShieldAlert className="size-5" /> SYSTEM MAINTENANCE NOTICE
            </DialogTitle>
          </DialogHeader>
          <NoticeBody s={data} />
        </DialogContent>
      </Dialog>
    </>
  );
}

/** Profile-card version: prominent red box for Agent and Executive profiles. */
export function MaintenanceProfileNotice() {
  const { data } = useMaintenance();
  if (!data || !needsNotice(data)) return null;
  return (
    <div className="mt-3 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm">
      <div className="flex items-center justify-between gap-2">
        <p className="font-bold text-destructive">🔴 P — SYSTEM MAINTENANCE NOTICE</p>
        <MaintenanceBadge />
      </div>
      <p className="mt-1">
        Monthly System Maintenance Fee: <b>{MAINTENANCE_FEE_LABEL}</b> · Due: 14th of every month (lock 15th 00:00) ·
        Status: <b className="text-destructive">{statusLabel(data)}</b>
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        Please contact IT Console / authorized team to complete the maintenance payment and request system unlock.
      </p>
    </div>
  );
}

const OPEN_PATHS = ["/system", "/architect", "/auth", "/service-bill-alert", "/service-bill-unlock"];

/** CRM-wide banner before the lock, full lock screen after it. */
export function MaintenanceGate() {
  const { data } = useMaintenance();
  const path = useRouterState({ select: (r) => r.location.pathname });
  if (!data) return null;
  if (OPEN_PATHS.some((p) => path.startsWith(p))) return null;

  if (data.locked && !data.exempt) {
    return (
      <div className="fixed inset-0 z-[80] grid place-items-center overflow-y-auto bg-background/95 p-4 backdrop-blur">
        <div className="card-elevated w-full max-w-md space-y-4 border-destructive/40 p-6">
          <h1 className="flex items-center gap-2 text-lg font-bold text-destructive">
            <Lock className="size-5" /> SYSTEM MAINTENANCE LOCKED
          </h1>
          <NoticeBody s={data} />
          <LockSignInButton />
          <p className="text-center text-xs text-muted-foreground">
            IT Console বা System Architect হলে Google দিয়ে সাইন ইন করুন — সাইন ইনের পর IT Console খুলবে।
          </p>
        </div>
      </div>
    );
  }

  if (!needsNotice(data)) return null;
  const text =
    data.stage === "locked"
      ? "🔴 SYSTEM MAINTENANCE LOCKED — IT access only"
      : data.stage === "due_today"
        ? `🔴 Maintenance payment is due today — ${MAINTENANCE_FEE_LABEL} — CONTACT IT CONSOLE`
        : data.stage === "soon"
          ? `🔴 SYSTEM MAINTENANCE PAYMENT DUE SOON — ${MAINTENANCE_FEE_LABEL} — CONTACT IT CONSOLE`
          : `সিস্টেম রক্ষণাবেক্ষণ ফি (${MAINTENANCE_FEE_LABEL}) ১৪ তারিখের মধ্যে IT Console জমা দেবে — আপনার কাজ স্বাভাবিক চলবে।`;
  const strong = data.stage !== "upcoming";
  return (
    <div
      className={`fixed inset-x-0 bottom-0 z-[60] px-3 py-2 text-center text-xs font-semibold sm:text-sm ${
        strong ? "bg-destructive text-destructive-foreground" : "bg-warning/90 text-warning-foreground"
      }`}
      role="status"
    >
      {text}
    </div>
  );
}
