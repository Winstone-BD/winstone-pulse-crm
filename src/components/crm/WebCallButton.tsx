import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, PhoneOutgoing, Sparkles, Square, NotebookPen, MicOff, Volume2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { WebsiteAnswerBox } from "@/components/crm/WebsiteAnswerBox";
import { getQuickBrief } from "@/lib/precall.functions";
import { logAnyNumberCall, openMyReport, startMyCall } from "@/lib/call-reports.functions";
import { useAdminToken } from "@/lib/local-session";
import { cn } from "@/lib/utils";
import { CallLeadContext } from "@/components/crm/CallLeadContext";
import { useT } from "@/lib/i18n";

/**
 * Calling straight from the web CRM, with the same mandatory post-call report as
 * the phone app: the call is gated, dialled through the phone's own dialler, and
 * the moment the agent marks it finished a report is opened. That is what makes a
 * web-only day appear in the shift summary and in Executive HQ exactly like an
 * app day — the summary is built from submitted reports, not from the app.
 *
 * It also serves calls that have no lead yet (a follow-up row whose lead row is
 * gone, or a bare number): in that case the number is resolved to its existing
 * lead or a new lead is created when the call ends, and the same report opens.
 * There is no "dial without a report" path anywhere in the web desk.
 *
 * The in-progress call is kept in localStorage, so leaving the browser for the
 * dialler and coming back does not lose the call timer.
 */
const KEY = "winstone.web.call.v1";
const RECENT_KEY = "winstone.web.recent-calls.v1";
const COOLDOWN_MS = 15 * 60_000;

type Live = { leadId: string; startedAt: number };

function readLive(): Live | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Live;
    return parsed?.leadId ? parsed : null;
  } catch {
    return null;
  }
}

export function WebCallButton({
  leadId = null,
  phone,
  className,
  label = "কল করুন",
  name = null,
  ariaLabel,
}: {
  leadId?: string | null;
  phone: string;
  className?: string;
  label?: string;
  /** Customer name used when the number has to become a new lead. */
  name?: string | null;
  ariaLabel?: string;
}) {
  const t = useT();
  const [contextOpen, setContextOpen] = useState(false);
  const adminToken = useAdminToken();
  const queryClient = useQueryClient();
  const begin = useServerFn(startMyCall);
  const finish = useServerFn(openMyReport);
  const logAny = useServerFn(logAnyNumberCall);
  const [live, setLive] = useState<Live | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [briefOpen, setBriefOpen] = useState(false);
  const quick = useServerFn(getQuickBrief);
  // Rules brief first (instant, no AI), AI line replaces it when ready.
  const rulesBrief = useQuery({
    queryKey: ["quick-brief", leadId, "rules"],
    queryFn: () => { if (!leadId) throw new Error("Lead required"); return quick({ data: { leadId, token: adminToken, ai: false } }); },
    enabled: briefOpen && Boolean(leadId),
    staleTime: 60_000,
    retry: false,
  });
  const aiBrief = useQuery({
    queryKey: ["quick-brief", leadId, "ai"],
    queryFn: () => { if (!leadId) throw new Error("Lead required"); return quick({ data: { leadId, token: adminToken, ai: true } }); },
    enabled: briefOpen && Boolean(leadId),
    staleTime: 5 * 60_000,
    retry: false,
  });
  const brief = aiBrief.data?.source === "ai" ? aiBrief.data : (rulesBrief.data ?? aiBrief.data);

  // One stable handle for this call target, lead or bare number.
  const handle = leadId ?? `tel:${phone}`;

  // Restore an in-progress call for this target after returning from the dialler.
  useEffect(() => {
    const found = readLive();
    if (found && found.leadId === handle) setLive(found);
  }, [handle]);

  useEffect(() => {
    if (!live) return;
    const tick = () => setElapsed(Math.floor((Date.now() - live.startedAt) / 1000));
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [live]);

  const dial = () => {
    const next: Live = { leadId: handle, startedAt: Date.now() };
    localStorage.setItem(KEY, JSON.stringify(next));
    try {
      const recent = JSON.parse(localStorage.getItem(RECENT_KEY) ?? "{}") as Record<string, number>;
      recent[handle] = Date.now();
      for (const k of Object.keys(recent)) if (Date.now() - recent[k] > COOLDOWN_MS) delete recent[k];
      localStorage.setItem(RECENT_KEY, JSON.stringify(recent));
    } catch { /* ignore */ }
    setLive(next);
    window.location.href = `tel:${phone}`;
  };

  // Guard against redialling the same number by mistake within 15 minutes.
  const confirmRecent = () => {
    try {
      const recent = JSON.parse(localStorage.getItem(RECENT_KEY) ?? "{}") as Record<string, number>;
      const at = recent[handle];
      if (!at || Date.now() - at > COOLDOWN_MS) return true;
      const mins = Math.max(1, Math.round((Date.now() - at) / 60000));
      return window.confirm(t({
        bn: `এই নম্বরে ${mins} মিনিট আগে কল করা হয়েছে। আবার কল করতে চান?`,
        en: `This number was called ${mins} min ago. Call again?`,
      }));
    } catch {
      return true;
    }
  };

  const start = useMutation({
    mutationFn: async () => {
      return begin({ data: { adminToken, leadId } });
    },
    onSuccess: (result) => {
      if (result.blocked) {
        toast.error(result.reason);
        void queryClient.invalidateQueries({ queryKey: ["pending-call-report"] });
        return;
      }
      dial();
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const startGuarded = () => { if (confirmRecent()) start.mutate(); };

  const end = useMutation({
    mutationFn: () => {
      const seconds = live ? Math.floor((Date.now() - live.startedAt) / 1000) : 0;
      const connected = seconds >= 10;
      if (leadId) {
        return finish({ data: { adminToken, leadId, durationSeconds: seconds, connected } });
      }
      return logAny({
        data: {
          adminToken,
          phoneNumber: phone,
          name,
          direction: "outgoing",
          connected,
          durationSeconds: seconds,
        },
      });
    },
    onSuccess: () => {
      localStorage.removeItem(KEY);
      setLive(null);
      toast.success("কল শেষ — এখন রিপোর্টটি পূরণ করুন");
      void queryClient.invalidateQueries({ queryKey: ["pending-call-report"] });
      void queryClient.invalidateQueries({ queryKey: ["crm-snapshot"] });
      void queryClient.invalidateQueries({ queryKey: ["follow-ups"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  if (live) {
    const mm = String(Math.floor(elapsed / 60)).padStart(2, "0");
    const ss = String(elapsed % 60).padStart(2, "0");
    return (
      <div className="min-w-0 space-y-2">
      <p role="status" className="text-xs text-muted-foreground">{t({ bn: "ডায়াল শুরু থেকে সময়", en: "Time since dial started" })} · {mm}:{ss}</p>
      <div className="grid grid-cols-2 gap-2">
        <Button variant="outline" disabled><MicOff />{t({ bn: "মিউট · ফোনে", en: "Mute · on phone" })}</Button>
        <Button variant="outline" disabled><Volume2 />{t({ bn: "স্পিকার · ফোনে", en: "Speaker · on phone" })}</Button>
      </div>
      <p className="text-xs text-muted-foreground">{t({ bn: "SIM কলের মিউট, স্পিকার ও কল কাটা ফোনের কল-পর্দা থেকে করুন।", en: "Mute, speaker and hang-up for SIM calls are controlled on your phone call screen." })}</p>
      {leadId && <Button variant="secondary" className="min-h-11 w-full" onClick={() => setContextOpen(true)}><NotebookPen />{t({ bn: "লিড · আগের নোট · ইতিহাস", en: "Lead · saved notes · history" })}</Button>}
      <Dialog open={contextOpen} onOpenChange={setContextOpen}><DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-lg"><DialogHeader><DialogTitle>{t({ bn: "কলের নোট ও ইতিহাস", en: "Call notes & history" })}</DialogTitle><DialogDescription>{t({ bn: "ব্যক্তিগত নোট", en: "Personal notes" })}</DialogDescription></DialogHeader>{leadId && <CallLeadContext leadId={leadId} />}</DialogContent></Dialog>
      <Button
        type="button"
        size="lg"
        variant="destructive"
        className={cn("h-11 min-w-0 flex-1 rounded-xl text-base font-semibold", className)}
        disabled={end.isPending}
        onClick={() => end.mutate()}
        aria-label={ariaLabel ? `${ariaLabel} শেষ করুন` : undefined}
      >
        {end.isPending ? <Loader2 className="size-5 animate-spin" /> : <Square className="size-5" />}
        <span className="tabular">
          {t({ bn: "কল শেষ হয়েছে · রিপোর্ট খুলুন", en: "Call has ended · open report" })}
        </span>
      </Button>
      </div>
    );
  }

  return (
    <>
    <Dialog open={briefOpen} onOpenChange={setBriefOpen}>
      <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Sparkles className="size-4 text-primary" /> কলের আগে এক নজরে
          </DialogTitle>
          <DialogDescription className="sr-only">Pre-call brief</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          {leadId && <CallLeadContext leadId={leadId} />}
          {brief ? (
            <>
              <p className="font-medium text-foreground">{brief.line}</p>
              <div className="rounded-lg border border-border bg-surface-2/60 p-3">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">শুরুর কথা</p>
                <p className="mt-1">{brief.opener}</p>
              </div>
              {brief.why?.length ? (
                <div className="rounded-lg border border-primary/30 bg-primary/5 p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-primary">এই লিড কেন আপনাকে দেওয়া হয়েছে</p>
                  <ul className="mt-1 list-disc space-y-0.5 pl-4">{brief.why.map((w) => <li key={w}>{w}</li>)}</ul>
                </div>
              ) : null}
              {brief.script?.length ? (
                <div className="rounded-lg border border-border p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">কথা বলার স্ক্রিপ্ট — ফলো-আপের জন্যই লিডটি দেওয়া হয়েছে</p>
                  <ul className="mt-1 space-y-1">{brief.script.map((l) => <li key={l}>{l}</li>)}</ul>
                </div>
              ) : null}
              <p className="text-[11px] text-muted-foreground">
                {brief.source === "ai" ? "AI ব্রিফ — শুধু CRM-এর তথ্য থেকে" : aiBrief.isFetching ? "AI ব্রিফ তৈরি হচ্ছে…" : "CRM তথ্য থেকে সারাংশ"}
              </p>
            </>
          ) : rulesBrief.isError ? (
            <p className="text-xs text-muted-foreground">ব্রিফ পাওয়া যায়নি — তবু কল করতে পারেন।</p>
          ) : (
            <p className="flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="size-4 animate-spin" /> ব্রিফ লোড হচ্ছে…</p>
          )}
          <WebsiteAnswerBox compact leadContext={brief?.line ?? null} />
          <Button
            type="button"
            size="lg"
            className="h-11 w-full rounded-xl text-base font-semibold"
            disabled={start.isPending}
            onClick={() => {
              setBriefOpen(false);
              start.mutate();
            }}
          >
            {start.isPending ? <Loader2 className="size-5 animate-spin" /> : <PhoneOutgoing className="size-5" />}
            এখনই কল করুন
          </Button>
        </div>
      </DialogContent>
    </Dialog>
    <Button
      type="button"
      size="lg"
      className={cn(
        "h-11 min-w-0 flex-1 rounded-xl text-base font-semibold shadow-sm",
        className,
      )}
      disabled={start.isPending}
      onClick={() => (leadId ? setBriefOpen(true) : start.mutate())}
      title="কল করুন — কল শেষে রিপোর্ট বাধ্যতামূলক"
      aria-label={ariaLabel}
    >
      {start.isPending ? (
        <Loader2 className="size-5 animate-spin" />
      ) : (
        <PhoneOutgoing className="size-5" />
      )}
      {label}
    </Button>
    </>
  );
}
