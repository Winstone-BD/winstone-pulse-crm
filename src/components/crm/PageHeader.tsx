import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

/**
 * The single page header for every CRM route. Title size, description tone and
 * the action slot behave identically everywhere, and the row survives 320px by
 * giving the text column `min-w-0` and the actions `shrink-0`.
 */
export function PageHeader({
  title,
  description,
  icon: Icon,
  actions,
}: {
  title: ReactNode;
  description?: ReactNode;
  icon?: LucideIcon;
  actions?: ReactNode;
}) {
  return (
    <header className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 sm:flex sm:flex-wrap sm:items-end sm:justify-between sm:gap-4">
      <div className="min-w-0 space-y-1">
        <h1 className="page-title flex min-w-0 items-center gap-2">
          {Icon && <Icon className="size-5 shrink-0 text-primary" />}
          <span className="min-w-0 truncate">{title}</span>
        </h1>
        {description && (
          <p className="text-sm leading-relaxed text-muted-foreground">{description}</p>
        )}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

/** Heading for a section inside a page. */
export function SectionHeading({
  title,
  icon: Icon,
  description,
  actions,
}: {
  title: ReactNode;
  icon?: LucideIcon;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 sm:flex sm:flex-wrap sm:items-center sm:justify-between">
      <div className="min-w-0 space-y-0.5">
        <h2 className="section-title min-w-0">
          {Icon && <Icon className="size-4 shrink-0 text-primary" />}
          <span className="min-w-0 truncate">{title}</span>
        </h2>
        {description && <p className="text-xs text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
