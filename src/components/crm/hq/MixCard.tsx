import type { CallRecording, Lead } from "@/lib/crm-data";

/** A mix-card row carries the rows it counted, so a tap can list them. */
export type MixRow = { label: string; value: number; leads?: Lead[]; calls?: CallRecording[] };

/** Compact intelligence card: labelled rows with a proportional bar; each row drills down. */
export function MixCard({
  title,
  subtitle,
  rows,
  loading,
  emptyLabel = "এখনো লাইভ ডেটা নেই",
  onSelectRow,
}: {
  title: string;
  subtitle: string;
  rows: MixRow[];
  loading?: boolean;
  emptyLabel?: string;
  onSelectRow?: (row: MixRow) => void;
}) {
  const total = rows.reduce((sum, r) => sum + r.value, 0);
  const max = rows.reduce((m, r) => Math.max(m, r.value), 0);
  return (
    <section className="card-elevated card-pad">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="section-title">{title}</h2>
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        </div>
        {!loading && (
          <span className="tabular rounded-full border border-border px-2 py-0.5 text-[11px] text-muted-foreground">
            {total}
          </span>
        )}
      </div>
      {loading ? (
        <ul className="mt-3 space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <li key={i} className="skeleton h-6 w-full" />
          ))}
        </ul>
      ) : total === 0 ? (
        <p className="mt-6 mb-2 text-center text-xs text-muted-foreground">{emptyLabel}</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {rows.map((row) => (
            <li key={row.label}>
              <button
                type="button"
                onClick={() => onSelectRow?.(row)}
                disabled={!onSelectRow}
                aria-label={`${title} · ${row.label}: ${row.value} — এই ভাগের তালিকা খুলুন / Open this segment`}
                className="w-full space-y-1 rounded-lg px-1 py-1 text-left transition-colors hover:bg-surface-2 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none disabled:cursor-default disabled:hover:bg-transparent"
              >
                <div className="flex items-baseline justify-between gap-2 text-xs">
                  <span className="truncate capitalize">{row.label}</span>
                  <span className="tabular text-muted-foreground">
                    {row.value} · {total ? Math.round((row.value / total) * 100) : 0}%
                  </span>
                </div>
                <div
                  className="h-1.5 overflow-hidden rounded-full bg-surface-2"
                  role="progressbar"
                  aria-valuenow={row.value}
                  aria-valuemin={0}
                  aria-valuemax={max || row.value}
                  aria-label={`${row.label} অনুপাত / share`}
                >
                  <div
                    className="h-full rounded-full bg-chart-1"
                    style={{ width: `${max ? (row.value / max) * 100 : 0}%` }}
                  />
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
