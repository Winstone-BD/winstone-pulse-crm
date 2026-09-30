import { Link, useLocation } from "@tanstack/react-router";
import { ChevronDown, Lock, LockOpen, LogOut, Menu, Smartphone, Sparkles } from "lucide-react";
import { NavSidebar } from "@/components/crm/NavSidebar";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";

import logoAsset from "@/assets/winstone-logo.png.asset.json";
import { AboutLegalModal } from "@/components/crm/AboutLegalModal";
import { AdminPinDialog } from "@/components/crm/AdminPinDialog";
import { AnyNumberCallDialog } from "@/components/crm/AnyNumberCallDialog";
import { PostCallReportGate } from "@/components/crm/PostCallReportGate";
import { AgentBriefingGate } from "@/components/crm/AgentBriefingGate";

import { ReminderBell } from "@/components/crm/ReminderBell";
import { NoticeBoardBell } from "@/components/crm/NoticeBoardBell";
import { InstallAppButton } from "@/components/crm/InstallAppButton";
import { AgentSelector } from "@/components/crm/AgentSelector";
import { CopilotDrawer } from "@/components/crm/CopilotDrawer";
import { OfflineSyncBar } from "@/components/crm/OfflineSyncBar";


import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useCrmRealtime } from "@/hooks/use-crm-realtime";
import { setAdminToken, useAdminToken } from "@/lib/local-session";
import { useMyAccount, useSignOut } from "@/lib/session";

// Latest build is streamed from the backend; the bundled asset stays as a fallback.
const APK_URL = "/api/public/download/apk";

type Scope = "authority" | "coordinator" | "agent" | "none";

export const NAV = [
  { to: "/", label: "Home", scopes: ["authority", "coordinator", "agent", "none"] },
  { to: "/desk", label: "My Desk", scopes: ["coordinator", "agent"] },
  { to: "/coach", label: "AI Coach", scopes: ["authority", "coordinator", "agent"] },
  { to: "/leadhub", label: "LeadHub Nexus", scopes: ["authority", "coordinator", "agent", "none"] },
  { to: "/hq", label: "Executive HQ", scopes: ["authority"] },
  { to: "/inventory", label: "ইনভেন্টরি", scopes: ["authority", "coordinator"] },
  { to: "/reports", label: "Reports", scopes: ["authority", "coordinator", "agent"] },
  { to: "/system", label: "IT Console", scopes: ["authority"] },
  { to: "/ingest", label: "Ingest Check", scopes: ["authority"] },
  { to: "/migration", label: "Migration Checklist", scopes: ["authority"] },
  { to: "/migration-export", label: "Migration Export", scopes: ["authority"] },
  { to: "/security", label: "PIN ও অ্যাক্সেস", scopes: ["authority", "coordinator", "agent"] },
  { to: "/docs", label: "Docs", scopes: ["authority", "coordinator", "agent", "none"] },
  { to: "/docs-admin", label: "Docs Admin", scopes: ["authority", "coordinator"] },
  { to: "/inbox", label: "Support Inbox", scopes: ["authority", "coordinator", "agent"] },
  { to: "/tickets", label: "Tickets", scopes: ["authority", "coordinator", "agent"] },
  { to: "/customers", label: "Customers", scopes: ["authority", "coordinator", "agent"] },
  { to: "/support-admin", label: "Support Admin", scopes: ["authority", "coordinator"] },
  { to: "/help", label: "Help Centre", scopes: ["authority", "coordinator", "agent", "none"] },
] as const satisfies ReadonlyArray<{ to: string; label: string; scopes: readonly Scope[] }>;

const PRIMARY_ROUTES: Record<Scope, readonly string[]> = {
  authority: ["/", "/leadhub", "/hq", "/system"],
  coordinator: ["/", "/desk", "/reports"],
  agent: ["/", "/desk", "/coach", "/reports"],
  none: ["/", "/docs", "/help"],
};

export function AppShell({ children }: { children: ReactNode }) {
  useCrmRealtime();
  const adminToken = useAdminToken();
  const { scope } = useMyAccount();
  const location = useLocation();
  const signOut = useSignOut();
  const [pinOpen, setPinOpen] = useState(false);
  const nav = NAV.filter((item) => (item.scopes as readonly Scope[]).includes(scope as Scope));
  const primaryRoutes = PRIMARY_ROUTES[scope as Scope] ?? PRIMARY_ROUTES.none;
  const primaryNav = nav.filter((item) => primaryRoutes.includes(item.to));
  const moreNav = nav.filter((item) => !primaryRoutes.includes(item.to));
  const moreIsActive = moreNav.some((item) => location.pathname === item.to);

  return (
    <div className="min-h-screen grid-noise">
      <header className="glass sticky top-0 z-40 border-b border-border">
        <div className="mx-auto flex h-14 w-full max-w-[1600px] items-center gap-2 px-3 sm:gap-4 sm:px-6">
          <Link to="/" className="flex min-w-0 shrink items-center gap-2.5">
            <img
              src={logoAsset.url}
              alt="Winstone Properties Ltd. logo"
              className="size-9 shrink-0 rounded-full object-cover shadow-sm ring-1 ring-border"
            />
            <span className="min-w-0 leading-tight">
              <span className="block truncate text-[13px] font-bold tracking-tight">
                Winstone Connect
              </span>
              <span className="hidden truncate text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground sm:block">
                Tele-Sales OS
              </span>
            </span>
          </Link>


          <div className="ml-auto flex min-w-0 items-center justify-end gap-1.5 sm:gap-2">
            {adminToken && <AgentSelector />}

            {scope !== "none" && <ReminderBell />}

            {scope !== "none" && <NoticeBoardBell />}

            {scope !== "none" && <AnyNumberCallDialog />}

            <InstallAppButton />

            <button
              type="button"
              onClick={() => {
                if (adminToken) {
                  setAdminToken(null);
                  toast.info("Control board locked");
                } else {
                  setPinOpen(true);
                }
              }}
              className={
                adminToken
                  ? "inline-flex h-8 items-center gap-1.5 rounded-full border border-primary/25 bg-accent px-3 text-xs font-semibold text-accent-foreground transition-all duration-300 hover:shadow-sm"
                  : "inline-flex h-8 items-center gap-1.5 rounded-full border border-border bg-card px-3 text-xs font-semibold text-muted-foreground transition-all duration-300 hover:text-foreground hover:shadow-sm"
              }
            >
              {adminToken ? <LockOpen className="size-3.5" /> : <Lock className="size-3.5" />}
              <span className="hidden lg:inline">
                {adminToken ? "Authority unlocked" : "Master PIN"}
              </span>
            </button>

            {scope !== "none" && !adminToken && (
              <button
                type="button"
                aria-label="Sign out"
                onClick={() => {
                  void signOut().then(() => toast.info("Signed out"));
                }}
                className="inline-flex h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border border-border bg-card px-2.5 text-xs font-semibold text-muted-foreground transition-all duration-300 hover:text-foreground hover:shadow-sm sm:px-3"
              >
                <LogOut className="size-3.5 sm:hidden" />
                <span className="hidden sm:inline">Sign out</span>
              </button>
            )}

            <Button
              size="sm"
              aria-label="Download Agent Android App"
              className="h-8 shrink-0 gap-1.5 whitespace-nowrap rounded-full px-2.5 text-xs font-semibold shadow-sm transition-all duration-300 hover:shadow-md sm:px-3.5"
              onClick={() => {
                const a = document.createElement("a");
                a.href = APK_URL;
                a.download = "winstone-connect.apk";
                document.body.appendChild(a);
                a.click();
                a.remove();
                toast.success("Agent app download started");
              }}
            >
              <Smartphone className="size-3.5" />
              <span className="hidden xl:inline">Download Agent Android App</span>
              <span className="hidden sm:inline xl:hidden">Agent App</span>
            </Button>

            <div className="hidden h-8 items-center gap-2 rounded-full border border-live/30 bg-live/10 px-3 md:flex">
              <span className="relative flex size-2">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-live opacity-75" />
                <span className="relative inline-flex size-2 rounded-full bg-live" />
              </span>
              <span className="text-[11px] font-semibold text-live">Live</span>
            </div>
          </div>
        </div>

        <nav className="flex items-center gap-1 px-3 pb-2 lg:hidden">
          <div className="flex min-w-0 flex-1 gap-1 overflow-x-auto">
          {primaryNav.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              activeOptions={{ exact: item.to === "/" }}
              className="shrink-0 rounded-full border border-border px-3 py-1 text-xs font-medium text-muted-foreground data-[status=active]:border-primary/30 data-[status=active]:bg-accent data-[status=active]:text-primary"
            >
              {item.label}
            </Link>
          ))}
          </div>
          {moreNav.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  aria-label="Open more navigation links"
                  className={`size-7 shrink-0 rounded-full ${moreIsActive ? "border-primary/30 bg-accent text-primary" : ""}`}
                >
                  <Menu className="size-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>More tools</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {moreNav.map((item) => (
                  <DropdownMenuItem key={item.to} asChild>
                    <Link
                      to={item.to}
                      activeOptions={{ exact: item.to === "/" }}
                      className="w-full cursor-pointer data-[status=active]:bg-accent data-[status=active]:text-primary"
                    >
                      {item.label}
                    </Link>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </nav>
      </header>

      <div className="mx-auto flex w-full max-w-[1600px]">
        <NavSidebar items={nav} />
        <main className="min-w-0 flex-1 animate-rise px-3 py-5 sm:px-6 sm:py-6">
          <OfflineSyncBar />
          {children}
        </main>
      </div>


      <footer className="border-t border-border px-4 py-6 text-center text-xs text-muted-foreground sm:px-6">
        <p>© 2026 TrendFlux Digital. All Rights Reserved.</p>
        <p className="mt-1">Developed &amp; Powered by Zahid Hasan Emon.</p>
        <div className="mt-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
          <Link
            to="/privacy"
            className="transition-colors hover:text-foreground"
            activeOptions={{ exact: true }}
          >
            Privacy Policy
          </Link>
          <span className="hidden sm:inline">·</span>
          <Link
            to="/terms"
            className="transition-colors hover:text-foreground"
            activeOptions={{ exact: true }}
          >
            Terms of Service
          </Link>
          <span className="hidden sm:inline">·</span>
          <AboutLegalModal />
        </div>
      </footer>

      {adminToken && (
        <div className="fixed bottom-5 right-5 z-40">
          <CopilotDrawer
            trigger={
              <Button
                size="lg"
                className="gap-2 rounded-full shadow-md transition-all duration-300 hover:shadow-lg"
              >
                <Sparkles className="size-4" /> AI Copilot
              </Button>
            }
          />
        </div>
      )}

      {/* The mandatory post-call report follows the agent across every page, not
          just the desk: a call that ended anywhere must be reported. */}
      {scope !== "none" && <PostCallReportGate />}
      {scope === "agent" && <AgentBriefingGate />}

      <AdminPinDialog open={pinOpen} onOpenChange={setPinOpen} />
    </div>
  );
}
