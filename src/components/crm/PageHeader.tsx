import type { ReactNode } from "react";

/** Shared page title block: title with wrapped phone actions and right-aligned desktop actions. */
export function PageHeader({
  title,
  description,
  icon,
  actions,
}: {
  title: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="mb-5 grid min-w-0 grid-cols-1 items-start gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
      <div className="flex min-w-0 items-center gap-3">
        {icon && (
          <span className="grid size-11 shrink-0 place-items-center rounded-md border border-gold/30 bg-accent text-gold">{icon}</span>
        )}
        <div className="min-w-0">
          <h1 className="break-words text-xl font-semibold leading-snug sm:text-2xl">{title}</h1>
          {description && <p className="mt-1 break-words text-sm leading-relaxed text-muted-foreground">{description}</p>}
        </div>
      </div>
      {actions && <div className="flex min-w-0 flex-wrap gap-2 sm:justify-end">{actions}</div>}
    </header>
  );
}
