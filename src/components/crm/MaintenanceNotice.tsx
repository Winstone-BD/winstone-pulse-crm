import { useMutation, useQuery } from "@tanstack/react-query";
import { useRouterState } from "@tanstack/react-router";
import { Lock, LogIn, ShieldAlert } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { lovable } from "@/integrations/lovable";
import { useAdminToken } from "@/lib/local-session";
import { getMaintenanceStatus, requestPaymentHelp } from "@/lib/maintenance.functions";
import { CRM_PLAN_NAME, CRM_TOTAL_CENTS, MAINTENANCE_FEE_LABEL, dhakaMonthName, dhakaTime, isAmberWindow, nextRenewalDueAt, usd } from "@/lib/maintenance-rules";
import { useLang, useT } from "@/lib/i18n";

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
          ? "Winstone Pulse is temporarily unavailable because the monthly system maintenance payment is pending."
          : "Your monthly system maintenance payment is due."}
      </p>
      <dl className="grid grid-cols-2 gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3">
        <dt className="text-muted-foreground">Fee</dt>
        <dd className="font-semibold">{MAINTENANCE_FEE_LABEL}</dd>
        <dt className="text-muted-foreground">Billing date</dt>
        <dd className="font-semibold">Renewal 12th · lock 15th 00:00 (Dhaka)</dd>
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

function fmtLeft(ms: number, lang: "bn" | "en") {
  if (ms <= 0) return "00:00:00";
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const hh = String(Math.floor((s % 86400) / 3600)).padStart(2, "0");
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  const dayLabel = lang === "bn" ? "দিন" : "d";
  return `${d > 0 ? `${d} ${dayLabel} ` : ""}${hh}:${mm}:${ss}`;
}

/** Live Dhaka-time countdown to next renewal due and to the unpaid lock. */
export function MaintenanceCountdown() {
  const t = useT();
  const lang = useLang();
  const { data } = useMaintenance();
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  if (!data || now === null) return null;
  const paid = data.paymentStatus === "verified";
  const renewal = nextRenewalDueAt(new Date(now), paid);
  const lockMs = new Date(data.lockAt).getTime() - now;
  return (
    <div className="mt-3 grid gap-2 sm:grid-cols-2 text-sm">
      <div className="rounded-lg border border-border bg-card/60 p-3">
        <p className="text-[11px] text-muted-foreground">{t({ bn: "পরবর্তী Renewal Due (ঢাকা সময়)", en: "Next renewal due (Dhaka time)" })}</p>
        <p className="font-semibold">{dhakaTime(renewal)}</p>
        <p className="font-mono text-base tabular-nums text-primary">{fmtLeft(new Date(renewal).getTime() - now, lang)}</p>
      </div>
      <div className={`rounded-lg border p-3 ${paid ? "border-border bg-card/60" : "border-destructive/40 bg-destructive/5"}`}>
        <p className="text-[11px] text-muted-foreground">{t({ bn: "Unpaid Lock পর্যন্ত (ঢাকা সময়)", en: "Until unpaid lock (Dhaka time)" })}</p>
        {paid ? (
          <p className="font-semibold text-primary">{t({ bn: "🟢 পেমেন্ট যাচাইকৃত — এই মাসে লক হবে না", en: "🟢 Payment verified — no lock this month" })}</p>
        ) : (
          <>
            <p className="font-semibold">{dhakaTime(data.lockAt)}</p>
            <p className="font-mono text-base tabular-nums text-destructive">
              {lockMs > 0 ? fmtLeft(lockMs, lang) : data.locked ? t({ bn: "🔒 লক হয়েছে", en: "🔒 Locked" }) : t({ bn: "আনলক অনুমোদিত", en: "Unlock approved" })}
            </p>
          </>
        )}
      </div>
    </div>
  );
}

/** Profile-card version: prominent red box for Agent and Executive profiles. */
export function MaintenanceProfileNotice() {
  const { data } = useMaintenance();
  if (!data) return null;
  if (data.paymentStatus !== "verified" && !data.locked && isAmberWindow()) return <UpcomingInvoiceWidget />;
  if (!needsNotice(data)) return <MaintenanceCountdown />;
  return (
    <div className="notice-highlight mt-3 rounded-lg border-destructive/40 bg-destructive/10 p-3 pl-4 text-sm">
      <div className="flex items-center justify-between gap-2">
        <p className="font-bold text-destructive">🔴 P — SYSTEM MAINTENANCE NOTICE</p>
        <MaintenanceBadge />
      </div>
      <p className="mt-1">
        Monthly System Maintenance Fee: <b>{MAINTENANCE_FEE_LABEL}</b> · Renewal due: 12th · Unpaid lock: 15th 00:00 (Dhaka) ·
        Status: <b className="text-destructive">{statusLabel(data)}</b>
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        Please contact IT Console / authorized team to complete the maintenance payment and request system unlock.
      </p>
      <MaintenanceCountdown />
    </div>
  );
}

const OPEN_PATHS = ["/system", "/tech", "/auth", "/service-bill-alert", "/service-bill-unlock"];

/** CRM-wide banner before the lock, full lock screen after it. */
export function MaintenanceGate() {
  const t = useT();
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
            {t({ bn: "IT Console বা System Architect হলে Google দিয়ে সাইন ইন করুন — সাইন ইনের পর IT Console খুলবে।", en: "If you are IT Console or System Architect, sign in with Google — IT Console will open after sign-in." })}
          </p>
        </div>
      </div>
    );
  }

  if (data.paymentStatus !== "verified" && !data.locked && isAmberWindow()) return <AmberReminderBanner period={data.period ?? ""} />;
  if (!needsNotice(data)) return null;
  const text =
    data.stage === "locked"
      ? t({ bn: "🔴 কোম্পানির সিস্টেম রক্ষণাবেক্ষণ ফি বাকি — সিস্টেম লক। দয়া করে কোম্পানি কর্তৃপক্ষকে জানান।", en: "🔴 Company system maintenance fee is overdue — system locked. Please inform company management." })
      : data.stage === "due_today"
        ? t({
            bn: `🔴 আজ কোম্পানির সিস্টেম রক্ষণাবেক্ষণ ফি (${MAINTENANCE_FEE_LABEL}) পরিশোধের শেষ দিন — কর্তৃপক্ষকে মনে করিয়ে দিন।`,
            en: `🔴 Today is the last day to pay the company's system maintenance fee (${MAINTENANCE_FEE_LABEL}) — remind management.`,
          })
        : data.stage === "soon"
          ? t({
              bn: `🔴 কোম্পানির সিস্টেম রক্ষণাবেক্ষণ ফি (${MAINTENANCE_FEE_LABEL}) শিগগির পরিশোধযোগ্য — ১৫ তারিখ ০০:০০-এ লক। কর্তৃপক্ষকে জানান।`,
              en: `🔴 The company's system maintenance fee (${MAINTENANCE_FEE_LABEL}) is due soon — lock at 00:00 on the 15th. Inform management.`,
            })
          : t({
              bn: `কোম্পানির সিস্টেম রক্ষণাবেক্ষণ ফি (${MAINTENANCE_FEE_LABEL}) — রিন্যুয়াল দিন ১২ তারিখ, ১৪ তারিখ ২৩:৫৯ পর্যন্ত গ্রেস। ফি কোম্পানি দেয় — কর্তৃপক্ষ না জানলে তাঁদের জানান।`,
              en: `Company system maintenance fee (${MAINTENANCE_FEE_LABEL}) — renewal due on the 12th, grace until 23:59 on the 14th. The company pays the fee — inform management if they are unaware.`,
            });
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

function InvoiceDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { data } = useMaintenance();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{CRM_PLAN_NAME} — Invoice</DialogTitle>
        </DialogHeader>
        <dl className="grid grid-cols-2 gap-2 rounded-lg border border-border p-3 text-sm">
          <dt className="text-muted-foreground">Base monthly fee</dt><dd className="font-semibold">$15.79 USD</dd>
          <dt className="text-muted-foreground">VAT (15%)</dt><dd className="font-semibold">$2.37 USD</dd>
          <dt className="text-muted-foreground">Total due</dt><dd className="font-semibold">{usd(CRM_TOTAL_CENTS)} USD</dd>
          <dt className="text-muted-foreground">Due date</dt><dd className="font-semibold">12 {dhakaMonthName()}</dd>
          <dt className="text-muted-foreground">Lock deadline</dt><dd className="font-semibold">15th 00:00 (Dhaka)</dd>
        </dl>
        <p className="text-xs text-muted-foreground">Payment is completed by IT Console / authorized team and verified by the System Architect.</p>
        {data && <RequestButton />}
      </DialogContent>
    </Dialog>
  );
}

/** Phase 1 amber banner. Dismissal is per user/browser and per billing period; it never touches the invoice. */
function AmberReminderBanner({ period }: { period: string }) {
  const key = `billing-amber-dismissed:${period}`;
  const [hidden, setHidden] = useState(true);
  const [open, setOpen] = useState(false);
  useEffect(() => setHidden(localStorage.getItem(key) === "1"), [key]);
  if (hidden) return <InvoiceDialog open={open} onOpenChange={setOpen} />;
  return (
    <>
      <div role="status" className="fixed inset-x-0 bottom-0 z-[60] border-t border-warning/50 bg-warning/15 px-3 py-2 text-xs backdrop-blur sm:text-sm">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-2">
          <p className="min-w-0 flex-1">
            <b className="text-warning">Subscription Reminder</b> — Your monthly invoice for {CRM_PLAN_NAME} ({usd(CRM_TOTAL_CENTS)} USD) is available. Payment is due on 12 {dhakaMonthName()}.
          </p>
          <Button size="sm" variant="outline" className="h-7" onClick={() => setOpen(true)}>View Invoice</Button>
          <Button size="sm" className="h-7" onClick={() => setOpen(true)}>Pay Now</Button>
          <Button size="sm" variant="ghost" className="h-7" aria-label="Dismiss reminder" onClick={() => { localStorage.setItem(key, "1"); setHidden(true); }}>✕</Button>
        </div>
      </div>
      <InvoiceDialog open={open} onOpenChange={setOpen} />
    </>
  );
}

function UpcomingInvoiceWidget() {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-3 rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm">
      <p className="font-bold text-warning">Upcoming Invoice Due</p>
      <p className="mt-1">Complete payment by 12 {dhakaMonthName()} to maintain uninterrupted access to your CRM pipelines and sales monitoring.</p>
      <p className="mt-1">Total Due: <b>{usd(CRM_TOTAL_CENTS)} USD</b>, including 15% VAT.</p>
      <Button size="sm" className="mt-2" onClick={() => setOpen(true)}>Settle Invoice</Button>
      <InvoiceDialog open={open} onOpenChange={setOpen} />
      <MaintenanceCountdown />
    </div>
  );
}
