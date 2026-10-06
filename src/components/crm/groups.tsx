import { useState, type ReactNode } from "react";
import { AlertTriangle, ChevronDown, Inbox, Loader2, Lock, WifiOff } from "lucide-react";

/**
 * Shared Winstone "smart group" building blocks. One visual language for
 * sections, metric groups, action rows and grouped states across the CRM.
 */

type SectionGroupProps = {
  title: string;
  subtitle?: string | undefined;
  eyebrow?: string | undefined;
  count?: number | string | undefined;
  actions?: ReactNode;
  collapsible?: boolean;
  defaultOpen?: boolean;
  tone?: "plain" | "tinted";
  children: ReactNode;
};

export function SectionGroup({
  title, subtitle, eyebrow, count, actions, collapsible, defaultOpen = true, tone = "plain", children,
}: SectionGroupProps) {
  const [open, setOpen] = useState(defaultOpen);
  const bg = tone === "tinted" ? "bg-surface-2/60" : "bg-card";
  const heading = (
    <div className="flex min-w-0 items-center gap-2">
      <div className="min-w-0">
        {eyebrow && (
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-primary">{eyebrow}</p>
        )}
        <h2 className="flex items-center gap-2 truncate text-sm font-semibold text-foreground">
          {title}
          {count !== undefined && (
            <span className="tabular rounded-full border border-border bg-background px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
              {count}
            </span>
          )}
        </h2>
        {subtitle && <p className="truncate text-xs text-muted-foreground">{subtitle}</p>}
      </div>
    </div>
  );
  return (
    <section className={`section-shell rounded-2xl border border-border ${bg}`}>
      <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-border/70 px-4 py-3">
        {collapsible ? (
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            className="flex min-w-0 items-center gap-2 text-left"
          >
            <ChevronDown className={`size-4 shrink-0 text-muted-foreground transition-transform ${open ? "" : "-rotate-90"}`} />
            {heading}
          </button>
        ) : (
          heading
        )}
        {actions && <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">{actions}</div>}
      </header>
      {(!collapsible || open) && <div className="space-y-4 p-4">{children}</div>}
    </section>
  );
}

export type Metric = {
  label: string;
  value: number | string | null | undefined;
  tone?: "ok" | "warn" | "bad" | undefined;
  hint?: string | undefined;
};

const KPI_CYCLE = ["kpi-info", "kpi-ok", "kpi-warn", "kpi-neutral"] as const;
const TONE = { ok: "text-success", warn: "text-warning", bad: "text-destructive" } as const;

/** A labelled cluster of related KPIs. Unknown values show "…" / "—", never a fake 0. */
export function MetricGroup({
  label, metrics, loading, error,
}: { label: string; metrics: Metric[]; loading?: boolean; error?: boolean }) {
  return (
    <div className="min-w-0 rounded-2xl border border-border bg-card p-3">
      <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">{label}</p>
      <dl className="grid grid-cols-2 gap-2">
        {metrics.map((m, i) => (
          <div key={m.label} className={`kpi-tile min-w-0 ${m.tone ? `kpi-${m.tone}` : KPI_CYCLE[i % KPI_CYCLE.length]}`}>
            <dt className="truncate text-[11px] text-muted-foreground">{m.label}</dt>
            <dd className={`tabular text-xl font-bold leading-tight ${m.tone ? TONE[m.tone] : "text-foreground"}`}>
              {error ? "—" : loading || m.value === undefined ? "…" : m.value === null ? "—" : typeof m.value === "number" ? m.value.toLocaleString("en-US") : m.value}
            </dd>
            {m.hint && <p className="truncate text-[10px] text-muted-foreground">{m.hint}</p>}
          </div>
        ))}
      </dl>
    </div>
  );
}

/** Keeps the 1–3 primary actions together; sticky at the bottom on phones when `sticky`. */
export function ActionGroup({ children, sticky }: { children: ReactNode; sticky?: boolean }) {
  return (
    <div
      className={`flex flex-wrap items-center gap-2 ${
        sticky
          ? "sticky bottom-[calc(env(safe-area-inset-bottom)+4.5rem)] z-20 rounded-2xl border border-border bg-card/95 p-2 shadow-md backdrop-blur sm:static sm:border-0 sm:bg-transparent sm:p-0 sm:shadow-none"
          : ""
      }`}
    >
      {children}
    </div>
  );
}

/** Label + value pairs for detail views (Lead Identity, Assignment, …). */
export function DetailGroup({ title, items }: { title: string; items: { label: string; value: ReactNode }[] }) {
  return (
    <div className="rounded-xl border border-border bg-background p-3">
      <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">{title}</p>
      <dl className="grid gap-2 sm:grid-cols-2">
        {items.map((i) => (
          <div key={i.label} className="min-w-0">
            <dt className="text-[11px] text-muted-foreground">{i.label}</dt>
            <dd className="truncate text-sm font-medium text-foreground">{i.value ?? "—"}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

/** One grouped state for loading / empty / error / offline / permission. */
export function GroupState({
  kind, message,
}: { kind: "loading" | "empty" | "error" | "offline" | "denied"; message?: string | undefined }) {
  const map = {
    loading: { Icon: Loader2, text: "লোড হচ্ছে…", cls: "text-muted-foreground", spin: true },
    empty: { Icon: Inbox, text: "এখানে এখনো কিছু নেই", cls: "text-muted-foreground", spin: false },
    error: { Icon: AlertTriangle, text: "লোড হয়নি — আবার চেষ্টা করুন", cls: "text-destructive", spin: false },
    offline: { Icon: WifiOff, text: "অফলাইন — সংযোগ ফিরলে সিঙ্ক হবে", cls: "text-warning", spin: false },
    denied: { Icon: Lock, text: "এই অংশ দেখার অনুমতি নেই", cls: "text-muted-foreground", spin: false },
  }[kind];
  return (
    <div role={kind === "error" ? "alert" : "status"} className={`flex items-center gap-2 rounded-xl border border-dashed border-border px-3 py-4 text-sm ${map.cls}`}>
      <map.Icon className={`size-4 shrink-0 ${map.spin ? "animate-spin" : ""}`} />
      <span>{message ?? map.text}</span>
    </div>
  );
}
