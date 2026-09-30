import { Link, useRouterState } from "@tanstack/react-router";
import { PAGE_SECTIONS, type SectionRoute } from "@/lib/page-sections";
import {
  BarChart3,
  BookOpen,
  Boxes,
  Brain,
  Building2,
  DatabaseZap,
  FileText,
  Headset,
  HelpCircle,
  Home,
  Inbox,
  KeyRound,
  LayoutDashboard,
  LifeBuoy,
  Network,
  PhoneCall,
  Server,
  ShieldCheck,
  Ticket,
  Users,
  type LucideIcon,
} from "lucide-react";

type Item = { to: string; label: string };

const ICONS: Record<string, LucideIcon> = {
  "/": Home,
  "/desk": PhoneCall,
  "/coach": Brain,
  "/leadhub": Network,
  "/hq": LayoutDashboard,
  "/inventory": Building2,
  "/reports": BarChart3,
  "/system": Server,
  "/ingest": DatabaseZap,
  "/migration": Boxes,
  "/migration-export": FileText,
  "/security": KeyRound,
  "/docs": BookOpen,
  "/docs-admin": ShieldCheck,
  "/inbox": Inbox,
  "/tickets": Ticket,
  "/customers": Users,
  "/support-admin": Headset,
  "/help": HelpCircle,
};

const GROUPS: { title: string; routes: string[] }[] = [
  { title: "প্রধান", routes: ["/", "/desk", "/coach"] },
  { title: "লিড ও বিক্রয়", routes: ["/leadhub", "/inventory", "/reports"] },
  { title: "ম্যানেজমেন্ট", routes: ["/hq"] },
  { title: "সাপোর্ট", routes: ["/inbox", "/tickets", "/customers", "/support-admin"] },
  {
    title: "আইটি ও নিরাপত্তা",
    routes: ["/system", "/security", "/ingest", "/migration", "/migration-export"],
  },
  { title: "সহায়তা", routes: ["/docs", "/docs-admin", "/help"] },
];

/** Grouped left navigator for desktop; mobile keeps the top pill bar. */
export function NavSidebar({ items }: { items: readonly Item[] }) {
  const byRoute = new Map(items.map((i) => [i.to, i]));
  const path = useRouterState({ select: (st) => st.location.pathname });
  const activeS = useRouterState({ select: (st) => String((st.location.search as Record<string, unknown>)["s"] ?? "") });
  return (
    <aside className="sticky top-14 hidden h-[calc(100vh-3.5rem)] w-60 shrink-0 overflow-y-auto border-r border-border bg-card/60 px-3 py-5 backdrop-blur lg:block">
      {GROUPS.map((group) => {
        const list = group.routes.map((r) => byRoute.get(r)).filter(Boolean) as Item[];
        if (list.length === 0) return null;
        return (
          <div key={group.title} className="mb-5">
            <p className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              {group.title}
            </p>
            <nav className="flex flex-col gap-0.5">
              {list.map((item) => {
                const Icon = ICONS[item.to] ?? LifeBuoy;
                const subs = PAGE_SECTIONS[item.to as SectionRoute];
                return (
                  <div key={item.to}>
                  <Link
                    to={item.to}
                    activeOptions={{ exact: item.to === "/" }}
                    className="group flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-medium text-muted-foreground transition-all duration-200 hover:bg-accent/60 hover:text-foreground data-[status=active]:bg-primary data-[status=active]:text-primary-foreground data-[status=active]:shadow-sm"
                  >
                    <Icon className="size-4 shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </Link>
                  {subs && path === item.to && (
                    <div className="ml-5 mt-1 flex flex-col gap-0.5 border-l border-border pl-2">
                      {subs.map((sub, i) => {
                        const on = activeS === sub.key || (!subs.some((x) => x.key === activeS) && i === 0);
                        return (
                          <Link
                            key={sub.key}
                            to={item.to}
                            search={{ s: sub.key } as never}
                            className={`rounded-md px-2 py-1.5 text-[12px] transition-colors ${on ? "bg-primary/10 font-semibold text-primary" : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"}`}
                          >
                            {sub.label}
                          </Link>
                        );
                      })}
                    </div>
                  )}
                  </div>
                );
              })}
            </nav>
          </div>
        );
      })}
    </aside>
  );
}
