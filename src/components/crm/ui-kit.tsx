import type { ReactNode } from "react";

/** Reference-style stat card: coloured left edge, label + icon, big value. Semantic tokens only. */
export type StatTone = "primary" | "live" | "chart4" | "destructive" | "accent" | "muted";

const EDGE: Record<StatTone, string> = {
  primary: "border-l-primary",
  live: "border-l-live",
  chart4: "border-l-chart-4",
  destructive: "border-l-destructive",
  accent: "border-l-accent-foreground",
  muted: "border-l-border",
};
const ICON: Record<StatTone, string> = {
  primary: "text-primary",
  live: "text-live",
  chart4: "text-chart-4",
  destructive: "text-destructive",
  accent: "text-accent-foreground",
  muted: "text-muted-foreground",
};

export function StatCard({
  label,
  value,
  sub,
  icon,
  tone = "primary",
  loading = false,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  icon?: ReactNode;
  tone?: StatTone;
  loading?: boolean;
}) {
  return (
    <div className={`min-w-0 rounded-lg border border-l-4 border-border bg-card p-4 shadow-card ${EDGE[tone]}`} aria-busy={loading}>
      <div className="flex items-start justify-between gap-2">
        <p className="break-words text-sm font-medium leading-snug text-muted-foreground">{label}</p>
        {icon ? <span className={`shrink-0 [&_svg]:size-4 ${ICON[tone]}`} aria-hidden>{icon}</span> : null}
      </div>
      {loading ? (
        <div className="mt-3 h-8 w-20 animate-pulse rounded-lg bg-muted motion-reduce:animate-none" />
      ) : (
        <p className="mt-2 break-words text-2xl font-semibold tabular-nums">{value}</p>
      )}
      {sub && !loading ? <p className="mt-1 break-words text-xs leading-relaxed text-muted-foreground">{sub}</p> : null}
    </div>
  );
}

/** Friendly empty state: icon, title, hint, optional action. */
export function EmptyState({
  icon,
  title,
  hint,
  action,
  compact = false,
}: {
  icon?: ReactNode;
  title: string;
  hint?: string;
  action?: ReactNode;
  compact?: boolean;
}) {
  return (
    <div className={`flex min-w-0 flex-col items-center justify-center px-4 text-center ${compact ? "gap-1 py-6" : "gap-2 py-12"}`}>
      {icon ? <span className="text-muted-foreground/70 [&_svg]:size-10" aria-hidden>{icon}</span> : null}
      <p className="font-semibold">{title}</p>
      {hint ? <p className="max-w-sm break-words text-sm leading-relaxed text-muted-foreground">{hint}</p> : null}
      {action ? <div className="mt-2 flex max-w-full flex-wrap justify-center gap-2">{action}</div> : null}
    </div>
  );
}

/** Page title block used by reference-style sections. */
export function SectionTitle({ title, sub, actions }: { title: string; sub?: string; actions?: ReactNode }) {
  return (
    <div className="grid min-w-0 grid-cols-1 items-end gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
      <div className="min-w-0">
        <h2 className="break-words text-2xl font-semibold leading-snug">{title}</h2>
        {sub ? <p className="mt-1 break-words text-sm leading-relaxed text-muted-foreground">{sub}</p> : null}
      </div>
      {actions ? <div className="flex min-w-0 flex-wrap items-center gap-2 sm:justify-end">{actions}</div> : null}
    </div>
  );
}
