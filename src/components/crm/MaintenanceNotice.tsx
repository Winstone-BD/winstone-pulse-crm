import { useMutation, useQuery } from "@tanstack/react-query";
import { useRouterState } from "@tanstack/react-router";
import { CalendarClock, Check, ChevronRight, Clock, FileText, Lock, LogIn, ShieldAlert } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { lovable } from "@/integrations/lovable";
import { cn } from "@/lib/utils";
import { useAdminToken } from "@/lib/local-session";
import { getMaintenanceStatus, requestPaymentHelp } from "@/lib/maintenance.functions";
import {
  CRM_PLAN_NAME,
  CRM_TOTAL_CENTS,
  MAINTENANCE_FEE_LABEL,
  dhakaClockLabel,
  dhakaDateLabel,
  dhakaMonthName,
  dhakaTime,
  deadlineLeftLabel,
  nextRenewalDueAt,
  paymentDueLabel,
  subscriptionNoticeCopy,
  subscriptionNoticeState,
  usd,
} from "@/lib/maintenance-rules";
import { useLang, useT } from "@/lib/i18n";
import { amberDismissed, dismissAmber, firstRedModalThisSession } from "@/lib/billing-dismiss";

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
type NoticeState = "amber" | "blue" | "red";

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
    return <span className="rounded-full border border-success/40 bg-success/10 px-2 py-0.5 text-[11px] font-bold text-success">🟢 Subscription active</span>;
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

/* ------------------------------------------------------------------ *
 * Subscription notice card — the one payment notice design.
 * Red (#DC2626 CTA / #FEF2F2 canvas / #FCA5A5 accent) is reserved for
 * this notice; Executive HQ and IT Console actions stay deep green.
 * ------------------------------------------------------------------ */

type Tone = {
  card: string;
  stripe: string;
  badgeOuter: string;
  badgeInner: string;
  title: string;
  body: string;
  chip: string;
  chipLabel: string;
  chipLeft: string;
  chipMeta: string;
  divider: string;
  cta: string;
};

const TONES: Record<NoticeState, Tone> = {
  red: {
    card: "border-pay-danger-border bg-pay-danger-bg",
    stripe: "bg-pay-danger",
    badgeOuter: "bg-pay-danger-border/45",
    badgeInner: "bg-pay-danger text-pay-danger-fg",
    title: "text-pay-danger-ink",
    body: "text-pay-danger-body",
    chip: "border-pay-danger-border/70 bg-pay-danger-border/25",
    chipLabel: "text-pay-danger-ink",
    chipLeft: "text-pay-danger",
    chipMeta: "text-pay-danger-body",
    divider: "bg-pay-danger-border/60",
    cta: "bg-pay-danger text-pay-danger-fg hover:bg-pay-danger-hover active:bg-pay-danger-hover shadow-lg",
  },
  amber: {
    card: "border-warning/50 bg-warning/12",
    stripe: "bg-warning",
    badgeOuter: "bg-warning/25",
    badgeInner: "bg-warning text-warning-foreground",
    title: "text-warning",
    body: "text-muted-foreground",
    chip: "border-warning/45 bg-warning/15",
    chipLabel: "text-warning",
    chipLeft: "text-warning",
    chipMeta: "text-muted-foreground",
    divider: "bg-warning/40",
    cta: "bg-primary text-primary-foreground hover:bg-primary/90 active:bg-primary/80 shadow-lg",
  },
  blue: {
    card: "border-verify/50 bg-verify/12",
    stripe: "bg-verify",
    badgeOuter: "bg-verify/25",
    badgeInner: "bg-verify text-pay-danger-fg",
    title: "text-verify",
    body: "text-muted-foreground",
    chip: "border-verify/45 bg-verify/15",
    chipLabel: "text-verify",
    chipLeft: "text-verify",
    chipMeta: "text-muted-foreground",
    divider: "bg-verify/40",
    cta: "bg-primary text-primary-foreground hover:bg-primary/90",
  },
};

/** Ticks once a second so the notice countdown stays live. */
function useNow(intervalMs = 1000): number | null {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}

function DeadlineChip({
  tone,
  label,
  left,
  date,
  clock,
  stacked,
}: {
  tone: Tone;
  label: string;
  left: string | null;
  date: string;
  clock: string;
  stacked?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border",
        stacked ? "mt-3 flex items-center justify-between gap-3 px-3 py-2" : "w-36 shrink-0 px-3 py-2 text-center",
        tone.chip,
      )}
    >
      <div className={cn("flex items-center gap-1.5", tone.chipLabel, stacked ? "min-w-0" : "justify-center")}>
        <CalendarClock className="size-3 shrink-0" aria-hidden />
        <span className="text-[10px] font-bold uppercase tracking-wide">{label}</span>
      </div>
      <div className={stacked ? "text-right" : ""}>
        {left && <p className={cn("text-base font-extrabold leading-tight tabular-nums", tone.chipLeft)}>{left}</p>}
        <p className={cn("text-[11px] font-semibold leading-tight", tone.chipMeta)}>{date}</p>
        <p className={cn("text-[11px] leading-tight", tone.chipMeta)}>{clock}</p>
      </div>
    </div>
  );
}

function NoticeCard({
  state,
  title,
  body,
  cta,
  onCta,
  onDismiss,
  deadline,
}: {
  state: NoticeState;
  title: string;
  body: string[];
  cta: string | null;
  onCta?: () => void;
  onDismiss?: (() => void) | undefined;
  deadline: { label: string; left: string | null; date: string; clock: string };
}) {
  const tone = TONES[state];
  const badge =
    state === "blue" ? <Check className="size-3.5" aria-hidden /> : state === "amber" ? <Clock className="size-3.5" aria-hidden /> : <span className="text-[15px] font-black leading-none">!</span>;
  return (
    <div
      role={state === "red" ? "alert" : "status"}
      className={cn("relative overflow-hidden rounded-2xl border pl-5 shadow-card backdrop-blur-sm", tone.card)}
    >
      <span aria-hidden className={cn("absolute inset-y-px left-px w-1.5 rounded-l-[14px]", tone.stripe)} />
      {onDismiss && (
        <button
          type="button"
          aria-label="Dismiss reminder"
          onClick={onDismiss}
          className="absolute right-2 top-2 rounded-full px-1.5 py-0.5 text-xs font-bold opacity-60 transition hover:opacity-100 focus-visible:ring-2 focus-visible:ring-ring"
        >
          ✕
        </button>
      )}
      <div className="p-4">
        <div className="flex items-start gap-3">
          <span className={cn("grid size-11 shrink-0 place-items-center rounded-full", tone.badgeOuter)}>
            <span className={cn("grid size-7 place-items-center rounded-full", tone.badgeInner)}>{badge}</span>
          </span>
          <div className="min-w-0 flex-1 space-y-1.5">
            <h2 className={cn("pr-5 text-[15px] font-extrabold leading-snug", tone.title)}>{title}</h2>
            {body.map((p) => (
              <p key={p} className={cn("text-[12.5px] leading-relaxed", tone.body)}>
                {p}
              </p>
            ))}
          </div>
          <span aria-hidden className={cn("hidden w-px self-stretch sm:block", tone.divider)} />
          <span className="hidden sm:block">
            <DeadlineChip tone={tone} {...deadline} />
          </span>
        </div>
        <span className="sm:hidden">
          <DeadlineChip tone={tone} {...deadline} stacked />
        </span>
        {cta && (
          <Button
            onClick={onCta}
            className={cn("mt-3 h-11 w-full justify-between rounded-xl px-4 text-sm font-bold", tone.cta)}
          >
            <span className="inline-flex items-center gap-2">
              <FileText className="size-4" aria-hidden />
              {cta}
            </span>
            <ChevronRight className="size-4" aria-hidden />
          </Button>
        )}
      </div>
    </div>
  );
}

/** Floating placement for the CRM-wide notice: bottom-centre on phones, bottom-right on desktops. */
function NoticeShell({ children }: { children: ReactNode }) {
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[60] flex justify-center p-3 pb-24 sm:justify-end sm:p-5 sm:pb-28">
      <div className="pointer-events-auto w-full max-w-lg">{children}</div>
    </div>
  );
}

/** Once-per-session renewal modal for authorized management while payment is unverified. */
function RenewalModal({
  open,
  onOpenChange,
  month,
  paymentStatus,
  onPay,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  month: string;
  paymentStatus: string;
  onPay: () => void;
}) {
  const statusText = paymentStatus === "pending" ? "Verification Pending" : paymentDueLabel();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <ShieldAlert className="size-5" /> Action Required: Subscription Renewal
          </DialogTitle>
        </DialogHeader>
        <ul className="space-y-1.5 text-sm">
          <li>● Outstanding Balance: <b>{usd(CRM_TOTAL_CENTS)} USD</b>, including VAT</li>
          <li>● Payment Due Date: <b>12 {month}</b></li>
          <li>● Lock Deadline: <b>15 {month}, 00:00 Asia/Dhaka</b></li>
          <li>● Payment Status: <b className="text-destructive">{statusText}</b></li>
        </ul>
        <p className="text-sm text-muted-foreground">Complete payment and ensure verification before the deadline.</p>
        <div className="grid gap-2 sm:grid-cols-2">
          <Button className="bg-pay-danger text-pay-danger-fg hover:bg-pay-danger-hover active:bg-pay-danger-hover" onClick={onPay}>
            Pay Online
          </Button>
          <Button variant="outline" asChild>
            <a href="/system">Submit Transfer Receipt</a>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** One card per billing state. Dismissal is display-only and never touches the invoice. */
function NoticeCardHost({ state, status, float }: { state: NoticeState; status: Status; float: boolean }) {
  const now = useNow();
  const [invoice, setInvoice] = useState(false);
  const [modal, setModal] = useState(false);
  const [hidden, setHidden] = useState(false);
  const period = status.period ?? "";
  useEffect(() => {
    if (state === "amber") setHidden(amberDismissed(period));
  }, [state, period]);
  useEffect(() => {
    if (state === "red" && status.exempt && firstRedModalThisSession(period)) setModal(true);
  }, [state, period, status.exempt]);

  const month = dhakaMonthName();
  const copy = subscriptionNoticeCopy(state, {
    month,
    totalLabel: `${usd(CRM_TOTAL_CENTS)} USD`,
    lockDate: dhakaDateLabel(status.lockAt),
    lockClock: dhakaClockLabel(status.lockAt),
  });
  if (hidden) return <InvoiceDialog open={invoice} onOpenChange={setInvoice} />;
  const ms = now === null ? null : new Date(status.lockAt).getTime() - now;
  const card = (
    <NoticeCard
      state={state}
      title={copy.title}
      body={copy.body}
      cta={copy.cta}
      onCta={() => setInvoice(true)}
      onDismiss={
        state === "amber"
          ? () => {
              dismissAmber(period);
              setHidden(true);
            }
          : undefined
      }
      deadline={{
        label: state === "blue" ? "Verification window" : "Payment deadline",
        left: state === "blue" || ms === null ? null : deadlineLeftLabel(ms),
        date: dhakaDateLabel(status.lockAt),
        clock: dhakaClockLabel(status.lockAt),
      }}
    />
  );
  const body = (
    <>
      {!(float && (invoice || modal)) && card}
      {state === "red" && status.exempt && (
        <RenewalModal
          open={modal}
          onOpenChange={setModal}
          month={month}
          paymentStatus={status.paymentStatus}
          onPay={() => {
            setModal(false);
            setInvoice(true);
          }}
        />
      )}
      <InvoiceDialog open={invoice} onOpenChange={setInvoice} />
    </>
  );
  return float ? <NoticeShell>{body}</NoticeShell> : <div className="mt-3">{body}</div>;
}

/** IT-only preview of every notice state with a fabricated deadline. Display-only — never touches the real invoice. */
export function NoticePreview() {
  const month = dhakaMonthName();
  const lockAt = new Date(Date.now() + 7 * 24 * 3600_000).toISOString();
  const opts = {
    month,
    totalLabel: `${usd(CRM_TOTAL_CENTS)} USD`,
    lockDate: dhakaDateLabel(lockAt),
    lockClock: dhakaClockLabel(lockAt),
  };
  const msLeft = new Date(lockAt).getTime() - Date.now();
  const deadline = (state: NoticeState) => ({
    label: state === "blue" ? "Verification window" : "Payment deadline",
    left: state === "blue" ? null : deadlineLeftLabel(msLeft),
    date: dhakaDateLabel(lockAt),
    clock: dhakaClockLabel(lockAt),
  });
  return (
    <div className="space-y-3">
      {(["amber", "blue", "red"] as const).map((s) => {
        const copy = subscriptionNoticeCopy(s, opts);
        return (
          <NoticeCard
            key={s}
            state={s}
            title={copy.title}
            body={copy.body}
            cta={copy.cta}
            deadline={deadline(s)}
          />
        );
      })}
      <div className="rounded-2xl border border-border bg-card p-4 text-sm">
        <span className="font-semibold text-primary">🟢 Subscription active</span>
        <p className="mt-1 text-xs text-muted-foreground">
          Verified payment — after successful verification no notice is shown on the dashboard.
        </p>
      </div>
    </div>
  );
}

/** Profile-card version: the same notice design, inline on Agent and Executive profiles. */
export function MaintenanceProfileNotice() {
  const { data } = useMaintenance();
  if (!data) return null;
  if (data.paymentStatus !== "verified" && !data.locked) {
    const state = subscriptionNoticeState(data.paymentStatus, data.locked);
    if (state) return <NoticeCardHost state={state} status={data} float={false} />;
  }
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

/** CRM-wide notice card before the lock, full lock screen after it. */
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

  if (data.paymentStatus === "verified") return null; // verified → notice removed automatically
  const notice = subscriptionNoticeState(data.paymentStatus, data.locked);
  if (notice) return <NoticeCardHost state={notice} status={data} float />;
  if (!data.locked) return null;
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
