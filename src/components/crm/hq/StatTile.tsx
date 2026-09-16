import type { ReactNode } from "react";

/** Single KPI tile with a decorative sparkline; opens a drill-down list when tapped. */
export function StatTile({
  icon,
  label,
  value,
  hint,
  onOpen,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  hint: string;
  /** Opens the drill-down list behind this number. */
  onOpen?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      disabled={!onOpen}
      aria-label={`${label}: ${value} — বিস্তারিত তালিকা খুলুন / Open detailed list`}
      className="card-elevated relative w-full overflow-hidden p-5 text-left transition-colors hover:border-primary/40 hover:bg-surface-2/40 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none disabled:cursor-default disabled:hover:border-border disabled:hover:bg-transparent"
    >
      <span className="absolute -right-6 -top-6 size-20 rounded-full bg-primary/10 blur-2xl" />
      <div className="flex items-start gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-full bg-primary/12 text-primary ring-1 ring-primary/25">
          {icon}
        </span>
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            {label}
          </p>
          <p className="tabular mt-1 text-2xl font-bold tracking-tight sm:text-3xl">{value}</p>
        </div>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">{hint}</p>
      <Sparkline seed={value.length + label.length} />
    </button>
  );
}

/** Tiny decorative sparkline; deterministic per tile so it doesn't jitter on refetch. */
export function Sparkline({ seed }: { seed: number }) {
  const points = Array.from({ length: 12 }, (_, i) => {
    const y = 18 - ((Math.sin(i * 0.9 + seed) + 1) * 6 + (i / 11) * 4);
    return `${(i / 11) * 100},${y}`;
  }).join(" ");
  return (
    <svg
      viewBox="0 0 100 20"
      className="mt-3 h-5 w-full text-chart-1/60"
      preserveAspectRatio="none"
    >
      <polyline points={points} fill="none" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}
