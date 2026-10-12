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
  Lightbulb,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Network,
  Newspaper,
  MapPin,
  PhoneCall,
  Server,
  ShieldCheck,
  Ticket,
  Trophy,
  Users,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";

import { useT } from "@/lib/i18n";
import { useMyAccount, useSignOut } from "@/lib/session";
import { LogOut } from "lucide-react";
import logoAsset from "@/assets/winstone-logo.png.asset.json";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

type Item = { to: string; label: string };

const ICONS: Record<string, LucideIcon> = {
  "/": Home,
  "/desk": PhoneCall,
  "/coach": Brain,
  "/leadhub": Network,
  "/hq": LayoutDashboard,
  "/contributions": Trophy,
  "/live-leads": Network,
  "/booking-review": ShieldCheck,
  "/staff-portal": Users,
  "/runtime-errors": Server,
  "/inventory": Building2,
  "/projects": Building2,
  "/sales-intel": Lightbulb,
  "/news": Newspaper,
  "/site-visits": MapPin,
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

const GROUPS: { title: { bn: string; en: string }; routes: string[] }[] = [
  { title: { bn: "প্রধান", en: "Main" }, routes: ["/", "/desk", "/coach"] },
  { title: { bn: "লিড ও বিক্রয়", en: "Leads & sales" }, routes: ["/leadhub", "/live-leads", "/booking-review", "/sales-intel", "/news", "/site-visits", "/projects", "/inventory", "/reports"] },
  { title: { bn: "ম্যানেজমেন্ট", en: "Management" }, routes: ["/hq", "/contributions", "/staff-portal"] },
  { title: { bn: "সাপোর্ট", en: "Support" }, routes: ["/inbox", "/tickets", "/customers", "/support-admin"] },
  {
    title: { bn: "আইটি ও নিরাপত্তা", en: "IT & security" },
    routes: ["/system", "/runtime-errors", "/security", "/ingest", "/migration", "/migration-export"],
  },
  { title: { bn: "সহায়তা", en: "Help" }, routes: ["/docs", "/docs-admin", "/help"] },
];

const FOCUS = "outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";

/** Arrow keys / Home / End move focus between menu links. */
function onNavKeys(e: KeyboardEvent<HTMLElement>) {
  if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(e.key)) return;
  const links = [...e.currentTarget.querySelectorAll<HTMLElement>("[data-nav-link]")];
  if (!links.length) return;
  e.preventDefault();
  const i = links.indexOf(document.activeElement as HTMLElement);
  const next =
    e.key === "Home" ? 0 : e.key === "End" ? links.length - 1
    : e.key === "ArrowDown" ? (i + 1) % links.length
    : (i - 1 + links.length) % links.length;
  links[next]?.focus();
}

function NavContent({
  items,
  onNavigate,
  collapsed = false,
}: {
  items: readonly Item[];
  onNavigate?: () => void;
  collapsed?: boolean;
}) {
  const t = useT();
  const byRoute = new Map(items.map((i) => [i.to, i]));
  const path = useRouterState({ select: (st) => st.location.pathname });
  const activeS = useRouterState({ select: (st) => String((st.location.search as Record<string, unknown>)["s"] ?? "") });
  return (
    <>
      {GROUPS.map((group) => {
        const list = group.routes.map((r) => byRoute.get(r)).filter(Boolean) as Item[];
        if (list.length === 0) return null;
        return (
          <div key={group.title.en} className="mb-5">
            <p hidden={collapsed} className="mb-2 px-3 text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground/80">
              {t(group.title)}
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
                    onClick={onNavigate}
                    data-nav-link
                    title={collapsed ? item.label : undefined}
                    aria-label={collapsed ? item.label : undefined}
                    className={`${FOCUS} group flex items-center gap-2.5 ${collapsed ? "justify-center" : ""} relative min-h-10 rounded-xl px-3 py-2 text-[13px] font-medium text-foreground/75 transition-all duration-200 hover:bg-card hover:text-foreground data-[status=active]:bg-primary data-[status=active]:font-semibold data-[status=active]:text-primary-foreground data-[status=active]:shadow-md`}
                  >
                    <Icon className="size-4 shrink-0" />
                    {!collapsed && <span className="truncate">{item.label}</span>}
                  </Link>
                  {!collapsed && subs && path === item.to && (
                    <div className="ml-5 mt-1.5 flex flex-col gap-0.5 border-l-2 border-primary/25 pl-2.5">
                      {subs.map((sub, i) => {
                        const on = activeS === sub.key || (!subs.some((x) => x.key === activeS) && i === 0);
                        return (
                          <Link
                            key={sub.key}
                            to={item.to}
                            search={{ s: sub.key } as never}
                            onClick={onNavigate}
                            data-nav-link
                            className={`${FOCUS} rounded-md px-2 py-1.5 text-[12px] transition-colors ${on ? "bg-card font-semibold text-foreground shadow-sm" : "text-muted-foreground hover:bg-card/70 hover:text-foreground"}`}
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
    </>
  );
}

/** Grouped left navigator for desktop; collapsible to icons (Ctrl/⌘+B). */
export function NavSidebar({ items }: { items: readonly Item[] }) {
  const t = useT();
  const [collapsed, setCollapsed] = useState(false);
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    setCollapsed(localStorage.getItem("nav-collapsed") === "1");
  }, []);
  const toggle = () =>
    setCollapsed((c) => {
      localStorage.setItem("nav-collapsed", c ? "0" : "1");
      return !c;
    });
  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "b") {
        e.preventDefault();
        toggle();
      }
      // Alt+M jumps keyboard focus into the menu.
      if (e.altKey && e.key.toLowerCase() === "m") {
        e.preventDefault();
        (ref.current?.querySelector('[data-status="active"]') as HTMLElement | null ?? ref.current?.querySelector<HTMLElement>("[data-nav-link]"))?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  return (
    <aside
      ref={ref}
      aria-label="প্রধান নেভিগেশন"
      onKeyDown={onNavKeys}
      className={`sticky top-14 hidden h-[calc(100vh-3.5rem)] shrink-0 flex-col border-r border-border bg-sidebar py-4 transition-[width] duration-200 lg:flex ${collapsed ? "w-16 px-2" : "w-64 px-3"}`}
    >
      <button
        type="button"
        onClick={toggle}
        aria-expanded={!collapsed}
        aria-label={collapsed ? "সাইডবার প্রসারিত করুন (Ctrl+B)" : "সাইডবার ভাঁজ করুন (Ctrl+B)"}
        title={collapsed ? "প্রসারিত করুন (Ctrl+B)" : "ভাঁজ করুন (Ctrl+B)"}
        className={`${FOCUS} mb-4 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-[12px] text-muted-foreground hover:bg-accent/60 hover:text-foreground ${collapsed ? "justify-center" : ""}`}
      >
        {collapsed ? <PanelLeftOpen className="size-4" /> : <PanelLeftClose className="size-4" />}
        {!collapsed && <span>{t({ bn: "ভাঁজ করুন", en: "Collapse" })}</span>}
      </button>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <NavContent items={items} collapsed={collapsed} />
      </div>
      <SidebarAccount collapsed={collapsed} />
    </aside>
  );
}

/** Avatar + sign-out at the foot of the sidebar; same sign-out as the top bar. */
function SidebarAccount({ collapsed }: { collapsed: boolean }) {
  const { account, scope } = useMyAccount();
  const signOut = useSignOut();
  const t = useT();
  if (scope === "none" || !account?.profile) return null;
  const name = account.profile.name ?? "";
  return (
    <div className={`mt-3 flex items-center gap-2 border-t border-border pt-3 ${collapsed ? "flex-col" : ""}`}>
      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-primary/15 text-xs font-bold text-primary" aria-hidden>
        {name.slice(0, 2)}
      </span>
      {!collapsed && (
        <span className="min-w-0 flex-1 leading-tight">
          <span className="block truncate text-[13px] font-semibold">{name}</span>
          <span className="block truncate text-[10px] text-muted-foreground">{account.profile.employee_id ?? ""}</span>
        </span>
      )}
      <button
        type="button"
        onClick={() => void signOut()}
        aria-label={t({ bn: "সাইন আউট", en: "Sign out" })}
        title={t({ bn: "সাইন আউট", en: "Sign out" })}
        className={`${FOCUS} grid size-8 shrink-0 place-items-center rounded-lg text-muted-foreground hover:bg-card hover:text-foreground`}
      >
        <LogOut className="size-4" />
      </button>
    </div>
  );
}

/** Left-side navigation drawer for tablet and mobile widths. */
export function MobileNavDrawer({ items }: { items: readonly Item[] }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.altKey && e.key.toLowerCase() === "m" && window.innerWidth < 1024) {
        e.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button
          type="button"
          aria-label="নেভিগেশন মেনু খুলুন (Alt+M)"
          className={`${FOCUS} inline-flex size-8 shrink-0 items-center justify-center rounded-full border border-border bg-card text-foreground transition-all duration-200 hover:bg-accent/60 lg:hidden`}
        >
          <Menu className="size-4.5" />
        </button>
      </SheetTrigger>
      <SheetContent
        side="bottom"
        className="max-h-[85dvh] w-full overflow-y-auto bg-background p-0"
      >
        <SheetHeader className="m-0 border-b border-border px-4 py-4 text-left">
          <SheetTitle asChild>
            <span className="flex items-center gap-2.5">
              <img
                src={logoAsset.url}
                alt="Winstone Properties Ltd. logo"
                className="size-8 shrink-0 rounded-full object-cover ring-1 ring-border"
              />
              <span className="min-w-0 leading-tight">
                <span className="block truncate text-sm font-bold tracking-tight">
                  Winstone Pulse
                </span>
                <span className="block truncate text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
Premium Real Estate CRM
                </span>
              </span>
            </span>
          </SheetTitle>
        </SheetHeader>
        <div className="px-3 py-4" onKeyDown={onNavKeys}>
          <NavContent items={items} onNavigate={() => setOpen(false)} />
        </div>
      </SheetContent>
    </Sheet>
  );
}
