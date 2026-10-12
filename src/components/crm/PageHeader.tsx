import type { ReactNode } from "react";

/** Shared page title block: title, one-line description, actions on the right. */
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
    <header className="mb-5 grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
      <div className="flex min-w-0 items-center gap-3">
        {icon && (
          <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-primary/12 text-primary">{icon}</span>
        )}
        <div className="min-w-0">
          <h1 className="truncate text-xl font-bold tracking-tight sm:text-2xl">{title}</h1>
          {description && <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">{description}</p>}
        </div>
      </div>
      {actions && <div className="flex shrink-0 flex-wrap justify-end gap-2">{actions}</div>}
    </header>
  );
}
