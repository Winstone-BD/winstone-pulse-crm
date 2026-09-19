import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CalendarClock, CheckCircle2, Loader2, Phone, Sparkles, X } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { triageMyLead } from "@/lib/agent-desk.functions";
import { useSnapshot } from "@/lib/crm-data";
import { shortDate } from "@/lib/crm-format";
import { useAdminToken } from "@/lib/local-session";

const TEMP_STYLES: Record<string, string> = {
  hot: "border-destructive/40 bg-destructive/10 text-destructive",
  warm: "border-warning/40 bg-warning/10 text-warning",
  cold: "border-primary/30 bg-primary/10 text-primary",
};

const SWIPE_THRESHOLD = 96;

/**
 * Mobile-only swipe queue: the agent works today's open leads one card at a
 * time — swipe right to park it for follow-up, swipe left to close it, or tap
 * the big call button. Hidden on tablet and desktop, where the lead table and
 * card view already cover this.
 */
export function MobileLeadQueue() {
  const { leads } = useSnapshot();
  const adminToken = useAdminToken();
  const queryClient = useQueryClient();
  const run = useServerFn(triageMyLead);

  const [index, setIndex] = useState(0);
  const [dragX, setDragX] = useState(0);
  const startX = useRef<number | null>(null);

  const queue = useMemo(
    () =>
      leads
        .filter((l) => l.status === "pending" || l.status === "contacted")
        .sort((a, b) => {
          const rank = (t?: string | null) => (t === "hot" ? 0 : t === "warm" ? 1 : 2);
          const byTemp = rank(a.temperature) - rank(b.temperature);
          if (byTemp !== 0) return byTemp;
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        }),
    [leads],
  );

  const lead = queue[Math.min(index, Math.max(queue.length - 1, 0))];

  const triage = useMutation({
    mutationFn: (vars: { leadId: string; action: "follow_up" | "closed" }) =>
      run({ data: { adminToken, leadId: vars.leadId, action: vars.action } }),
    onSuccess: (_result, vars) => {
      toast.success(
        vars.action === "follow_up"
          ? "আগামীকাল সকাল ১০টায় ফলো-আপে রাখা হলো"
          : "লিডটি বন্ধ করা হলো",
      );
      setDragX(0);
      setIndex((i) => i + 1);
      void queryClient.invalidateQueries({ queryKey: ["crm-snapshot"] });
      void queryClient.invalidateQueries({ queryKey: ["my-follow-ups"] });
    },
    onError: (error: Error) => {
      setDragX(0);
      toast.error(error.message);
    },
  });

  const act = (action: "follow_up" | "closed") => {
    if (!lead || triage.isPending) return;
    triage.mutate({ leadId: lead.id, action });
  };

  const onPointerDown = (e: React.PointerEvent) => {
    startX.current = e.clientX;
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (startX.current === null) return;
    setDragX(e.clientX - startX.current);
  };
  const onPointerUp = () => {
    if (startX.current === null) return;
    const dx = dragX;
    startX.current = null;
    if (dx > SWIPE_THRESHOLD) act("follow_up");
    else if (dx < -SWIPE_THRESHOLD) act("closed");
    else setDragX(0);
  };

  return (
    <section className="card-elevated space-y-3 p-3 md:hidden">
      <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
        <div className="min-w-0">
          <h2 className="flex items-center gap-1.5 truncate text-sm font-bold tracking-tight">
            <Sparkles className="size-4 shrink-0 text-primary" /> দ্রুত লিড কিউ
          </h2>
          <p className="text-[11px] text-muted-foreground">
            ডানে সোয়াইপ = ফলো-আপ · বাঁয়ে সোয়াইপ = বন্ধ
          </p>
        </div>
        <Badge variant="secondary" className="shrink-0">
          {Math.max(queue.length - index, 0)}টি বাকি
        </Badge>
      </header>

      {!lead || index >= queue.length ? (
        <div className="rounded-xl border border-dashed p-6 text-center">
          <CheckCircle2 className="mx-auto size-6 text-primary" />
          <p className="mt-2 text-sm font-semibold">কিউ খালি</p>
          <p className="text-xs text-muted-foreground">
            এই মুহূর্তে হাতে নেওয়ার মতো খোলা লিড নেই।
          </p>
          {queue.length > 0 && (
            <Button size="sm" variant="outline" className="mt-3" onClick={() => setIndex(0)}>
              আবার শুরু থেকে দেখুন
            </Button>
          )}
        </div>
      ) : (
        <div className="relative touch-pan-y select-none">
          <div className="pointer-events-none absolute inset-0 flex items-center justify-between px-4 text-xs font-semibold">
            <span className={dragX > 24 ? "text-primary" : "text-muted-foreground/40"}>
              ফলো-আপ →
            </span>
            <span className={dragX < -24 ? "text-destructive" : "text-muted-foreground/40"}>
              ← বন্ধ
            </span>
          </div>
          <div
            className="relative rounded-xl border border-border bg-card p-4 shadow-sm transition-transform"
            style={{
              transform: `translateX(${dragX}px) rotate(${dragX / 40}deg)`,
              transition: startX.current === null ? "transform 160ms ease-out" : "none",
            }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-base font-bold tracking-tight">{lead.name}</p>
                <p className="tabular text-sm text-muted-foreground">{lead.phone_number}</p>
              </div>
              {lead.temperature ? (
                <span
                  className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${
                    TEMP_STYLES[lead.temperature] ?? "border-border bg-muted text-muted-foreground"
                  }`}
                >
                  {lead.temperature}
                </span>
              ) : null}
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px]">
              {lead.grade ? <Badge variant="outline">গ্রেড {lead.grade}</Badge> : null}
              <Badge variant="outline">{lead.status.replace("_", " ")}</Badge>
              <span className="text-muted-foreground">
                {shortDate(lead.last_call_at ?? lead.created_at)}
              </span>
            </div>

            {lead.company ? (
              <p className="mt-2 truncate text-xs text-muted-foreground">{lead.company}</p>
            ) : null}

            {/* Gated call: the report popup opens as soon as the call ends. */}
            <WebCallButton
              leadId={lead.id}
              phone={lead.phone_number}
              name={lead.name}
              className="mt-3 h-12 w-full"
            />
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2">
            <Button
              variant="secondary"
              className="h-12"
              disabled={triage.isPending}
              onClick={() => act("follow_up")}
            >
              {triage.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <CalendarClock className="size-4" />
              )}
              ফলো-আপ
            </Button>
            <Button
              variant="outline"
              className="h-12"
              disabled={triage.isPending}
              onClick={() => act("closed")}
            >
              <X className="size-4" /> বন্ধ করুন
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}
