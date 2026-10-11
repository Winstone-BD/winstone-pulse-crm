import { AlertTriangle, CheckCircle2, CircleAlert, Clock, Inbox, Loader2, PhoneCall, RotateCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/** Accessible error state with a retry button (role=alert). */
export function ErrorState({ onRetry, message }: { onRetry?: () => void; message?: string }) {
  const t = useT();
  return (
    <div role="alert" className="flex flex-wrap items-center gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
      <AlertTriangle className="size-4 shrink-0" aria-hidden />
      <span className="flex-1">{message ?? t({ bn: "তথ্য লোড করা যায়নি।", en: "Could not load data." })}</span>
      {onRetry && (
        <Button size="sm" variant="outline" onClick={onRetry} className="min-h-9">
          <RotateCw className="size-3.5" aria-hidden /> {t({ bn: "আবার চেষ্টা", en: "Retry" })}
        </Button>
      )}
    </div>
  );
}

/** Polite loading indicator for screen readers. */
export function LoadingState({ label }: { label?: string }) {
  const t = useT();
  return (
    <p role="status" aria-live="polite" className="flex items-center gap-2 text-sm text-muted-foreground">
      <Loader2 className="size-4 animate-spin" aria-hidden /> {label ?? t({ bn: "লোড হচ্ছে…", en: "Loading…" })}
    </p>
  );
}

/** True-empty state (data loaded, nothing to show). */
export function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <div role="status" className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
      <Inbox className="size-5" aria-hidden />
      {children}
    </div>
  );
}

const LEAD_STATUS: Record<string, { bn: string; en: string; cls: string; Icon: typeof CheckCircle2 }> = {
  pending: { bn: "কল হয়নি", en: "Not called", cls: "border-destructive/30 bg-destructive/10 text-destructive", Icon: CircleAlert },
  follow_up: { bn: "আবার যোগাযোগ", en: "Follow-up", cls: "border-warning/40 bg-warning/10 text-foreground", Icon: Clock },
  contacted: { bn: "কথা হয়েছে", en: "Contacted", cls: "border-success/40 bg-success/10 text-success", Icon: PhoneCall },
  closed: { bn: "শেষ হয়েছে", en: "Closed", cls: "border-success/40 bg-success/10 text-success", Icon: CheckCircle2 },
};

/** Lead status badge: colour + icon + text (colour is never the only signal). Display only. */
export function LeadStatusBadge({ status, className }: { status: string; className?: string }) {
  const t = useT();
  const s = LEAD_STATUS[status];
  if (!s) return <span className={cn("rounded-full border border-border px-2 py-0.5 text-[11px] font-semibold", className)}>{status}</span>;
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold", s.cls, className)}>
      <s.Icon className="size-3" aria-hidden /> {t({ bn: s.bn, en: s.en })}
    </span>
  );
}
