import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, PhoneOutgoing, Square } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { logAnyNumberCall, openMyReport, startMyCall } from "@/lib/call-reports.functions";
import { useAdminToken } from "@/lib/local-session";
import { cn } from "@/lib/utils";

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
}: {
  leadId?: string | null;
  phone: string;
  className?: string;
  label?: string;
  /** Customer name used when the number has to become a new lead. */
  name?: string | null;
}) {
  const adminToken = useAdminToken();
  const queryClient = useQueryClient();
  const begin = useServerFn(startMyCall);
  const finish = useServerFn(openMyReport);
  const logAny = useServerFn(logAnyNumberCall);
  const [live, setLive] = useState<Live | null>(null);
  const [elapsed, setElapsed] = useState(0);

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
    setLive(next);
    window.location.href = `tel:${phone}`;
  };

  const start = useMutation({
    mutationFn: async () => {
      if (!leadId) return { blocked: false as const };
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
      <Button
        type="button"
        size="lg"
        variant="destructive"
        className={cn("h-11 min-w-0 flex-1 rounded-xl text-base font-semibold", className)}
        disabled={end.isPending}
        onClick={() => end.mutate()}
      >
        {end.isPending ? <Loader2 className="size-5 animate-spin" /> : <Square className="size-5" />}
        <span className="tabular">
          কল শেষ · {mm}:{ss}
        </span>
      </Button>
    );
  }

  return (
    <Button
      type="button"
      size="lg"
      className={cn(
        "h-11 min-w-0 flex-1 rounded-xl text-base font-semibold shadow-sm",
        className,
      )}
      disabled={start.isPending}
      onClick={() => start.mutate()}
      title="কল করুন — কল শেষে রিপোর্ট বাধ্যতামূলক"
    >
      {start.isPending ? (
        <Loader2 className="size-5 animate-spin" />
      ) : (
        <PhoneOutgoing className="size-5" />
      )}
      {label}
    </Button>
  );
}
