import { Link } from "@tanstack/react-router";

export type DashboardSubnavItem = {
  to: string;
  label: string;
};

export function DashboardSubnav({
  label,
  items,
}: {
  label: string;
  items: readonly DashboardSubnavItem[];
}) {
  return (
    <nav aria-label={label} className="-mx-1 overflow-x-auto px-1 pb-1">
      <div className="flex min-w-max gap-1 rounded-lg border border-border bg-surface-2/70 p-1">
        {items.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            activeOptions={{ exact: true }}
            className="rounded-md px-3 py-2 text-xs font-semibold text-muted-foreground transition-colors hover:bg-card hover:text-foreground data-[status=active]:bg-card data-[status=active]:text-primary data-[status=active]:shadow-sm sm:text-sm"
          >
            {item.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}