import type { LucideIcon } from "lucide-react";
import { Inbox } from "lucide-react";
import type { ReactNode } from "react";

/**
 * One truthful empty / no-result state for the whole CRM. It never invents
 * sample data: it states plainly that nothing is there yet and, where useful,
 * offers the one action that would fill it.
 */
export function EmptyState({
  title,
  description,
  icon: Icon = Inbox,
  action,
  compact = false,
}: {
  title: ReactNode;
  description?: ReactNode;
  icon?: LucideIcon;
  action?: ReactNode;
  compact?: boolean;
}) {
  return (
    <div
      className={`flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-surface/50 text-center ${
        compact ? "px-4 py-6" : "px-6 py-10"
      }`}
    >
      <span className="grid size-10 shrink-0 place-items-center rounded-full bg-accent">
        <Icon className="size-4 text-primary" />
      </span>
      <p className="text-sm font-semibold">{title}</p>
      {description && (
        <p className="max-w-sm text-xs leading-relaxed text-muted-foreground">{description}</p>
      )}
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}
