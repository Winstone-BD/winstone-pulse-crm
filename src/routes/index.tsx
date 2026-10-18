import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  ArrowUpRight,
  BarChart3,
  ChevronRight,
  Globe,
  Headphones,
  LifeBuoy,
  Lock,
  Mic,
  Monitor,
  Server,
  Smartphone,
  Database,
  ShieldCheck,
} from "lucide-react";
import { useState } from "react";

import logoAsset from "@/assets/winstone-mark.png.asset.json";
import androidAsset from "@/assets/device-android.png.asset.json";
import webAsset from "@/assets/device-web.png.asset.json";
import desktopAsset from "@/assets/device-desktop.png.asset.json";
import { AdminPinDialog } from "@/components/crm/AdminPinDialog";
import { Button } from "@/components/ui/button";
import { useMyAccount } from "@/lib/session";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Winstone Pulse — The Premium Real Estate CRM" },
      {
        name: "description",
        content:
          "Choose your workspace: Android, Web / iOS or Desktop. One Winstone Pulse — The Premium Real Estate CRM, the same data on every device.",
      },
      { property: "og:title", content: "Winstone Pulse — The Premium Real Estate CRM" },
      {
        property: "og:description",
        content: "One CRM. One data layer. Every device. Choose Android, Web / iOS or Desktop.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: EntryHall,
});

type RoleKey = "hq" | "agent" | "leadhub" | "it";
const ROLES: { key: RoleKey; label: string; icon: typeof BarChart3 }[] = [
  { key: "hq", label: "Executive HQ", icon: BarChart3 },
  { key: "agent", label: "Sales Agent", icon: Headphones },
  { key: "leadhub", label: "LeadHub Nexus", icon: Database },
  { key: "it", label: "IT Console", icon: Server },
];

function EntryHall() {
  const navigate = useNavigate();
  const { scope } = useMyAccount();
  const [pinOpen, setPinOpen] = useState(false);
  const [pinTarget, setPinTarget] = useState<"/hq" | "/system" | "/leadhub">("/hq");

  const openPin = (target: "/hq" | "/system" | "/leadhub") => {
    setPinTarget(target);
    setPinOpen(true);
  };

  // One CRM, three layouts: the choice is only a remembered preference.
  // Every mode leads to the same existing access screen below.
  const chooseMode = (mode: "android" | "web" | "desktop") => {
    try {
      localStorage.setItem("winstone.view-mode", mode);
    } catch {
      // storage blocked: layout still adapts to the screen
    }
    document.getElementById("workspace-signin")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const [role, setRole] = useState<RoleKey>("agent");
  const startRole = () => {
    if (role === "agent") void navigate({ to: "/auth", search: { role: "agent", mode: "signin" } as never });
    else openPin(role === "hq" ? "/hq" : role === "leadhub" ? "/leadhub" : "/system");
  };

  return (
    <div className="theme-exec min-h-screen bg-background">
      <div className="sticky top-0 z-20 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between px-4 sm:h-16 sm:px-6">
          <span className="flex min-w-0 items-center gap-2.5">
            <img src={logoAsset.url} alt="" className="size-8 shrink-0 rounded-full object-cover sm:size-9" />
            <span className="min-w-0 leading-tight">
              <span className="block truncate text-sm font-bold tracking-[0.12em]">
                WINSTONE <span className="text-gold">PULSE</span>
              </span>
              <span className="block truncate text-[9px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
                The Premium Real Estate CRM
              </span>
            </span>
          </span>
          <span className="inline-flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
            <span aria-hidden className="size-1.5 rounded-full bg-live" /> Server online
          </span>
        </div>
      </div>
      <main className="mx-auto flex min-h-screen w-full max-w-6xl animate-rise flex-col px-4 py-10 sm:px-6 sm:py-14">
        <header className="grid items-center gap-10 lg:grid-cols-2 lg:gap-12">
          <div className="text-center lg:text-left">
            <div className="flex items-center justify-center gap-3 lg:justify-start">
              <img
                src={logoAsset.url}
                alt="Winstone logo"
                className="size-14 rounded-full object-cover ring-1 ring-border sm:size-16"
              />
              <div>
                <p className="text-sm font-black uppercase tracking-wide text-gold sm:text-base">
                  Winstone Properties Ltd.
                </p>
                <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-muted-foreground">
                  Find. Build. Invest.
                </p>
              </div>
            </div>
            <h1 className="mt-8 text-4xl font-black uppercase leading-[1.05] tracking-tight text-foreground sm:text-6xl">
              Winstone <span className="text-gold">Pulse</span>
            </h1>
            <p className="mt-3 text-2xl font-extrabold tracking-tight text-foreground sm:text-4xl">
              The Premium <span className="text-gold">Real Estate CRM.</span>
            </p>
            <p className="mx-auto mt-5 max-w-md text-sm leading-relaxed text-muted-foreground sm:text-base lg:mx-0">
              Leads, calls, follow-ups and team performance. One connected workspace for your sales floor.
            </p>
            <div className="mt-7 flex flex-wrap items-center justify-center gap-3 lg:justify-start">
              <Button
                size="lg"
                className="rounded-md px-7 text-base font-bold hover:bg-charcoal"
                onClick={() =>
                  document
                    .getElementById("workspace-signin")
                    ?.scrollIntoView({ behavior: "smooth", block: "start" })
                }
              >
                Get started <ChevronRight className="size-5" />
              </Button>
              <Button asChild size="lg" variant="outline" className="rounded-md px-7 text-base font-semibold">
                <Link to="/auth" search={{ role: "agent", mode: "signin" }}>
                  Sign in
                </Link>
              </Button>
            </div>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-3 lg:justify-start">
              {[
                { icon: Headphones, label: "Manage team", sub: "Agents & roles" },
                { icon: BarChart3, label: "Track pipeline", sub: "Leads & bookings" },
                { icon: Smartphone, label: "Review calls", sub: "Activity & history" },
              ].map(({ icon: Icon, label, sub }) => (
                <span key={label} className="inline-flex items-center gap-2 text-left text-sm font-semibold text-foreground">
                  <span className="grid size-8 shrink-0 place-items-center rounded-full bg-gold/10 text-gold ring-1 ring-gold/40">
                    <Icon className="size-4" />
                  </span>
                  <span className="leading-tight">
                    {label}
                    <span className="block text-xs font-normal text-muted-foreground">{sub}</span>
                  </span>
                </span>
              ))}
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-xl">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-border bg-card px-4 py-3">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Pipeline Value
                </p>
                <p className="text-lg font-extrabold tracking-tight">Live, every second</p>
                <p className="text-xs font-bold text-gold">↑ Updated in real time</p>
              </div>
              <div className="rounded-xl border border-border bg-card px-4 py-3">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Follow-ups
                </p>
                <p className="text-lg font-extrabold tracking-tight">Never missed</p>
              </div>
            </div>
          </div>
        </header>

        <h2 className="mt-10 text-center text-xl font-bold tracking-tight sm:text-3xl">
          Choose Your Workspace
          <span aria-hidden className="mx-auto mt-2 block h-0.5 w-12 bg-gold" />
        </h2>
        <p className="mt-2 text-center text-sm text-muted-foreground">
          Select the mode you are using — the same Winstone Pulse opens on every device.
        </p>

        <div className="mt-5 grid grid-cols-2 gap-2 sm:mt-8 sm:gap-4 lg:grid-cols-4">
          <ModeCard
            icon={<Smartphone />}
            illustration={<SmartphoneIllustration />}
            title="Android"
            subtitle="Mobile-first CRM"
            onClick={() => chooseMode("android")}
          />
          <ModeCard
            icon={<Globe />}
            illustration={<WebIllustration />}
            title="Web / iOS"
            subtitle="Responsive CRM"
            onClick={() => chooseMode("web")}
          />
          <ModeCard
            icon={<Monitor />}
            illustration={<DesktopIllustration />}
            title="Desktop"
            subtitle="Full CRM Workspace"
            onClick={() => chooseMode("desktop")}
          />
          <ModeCard
            icon={<ShieldCheck />}
            illustration={<div className="grid h-full w-full place-items-center rounded-lg bg-secondary text-gold"><ShieldCheck className="size-10" /></div>}
            title="IT Console"
            subtitle="Secure administration"
            onClick={() => openPin("/system")}
          />
        </div>

        <p className="mt-5 text-center text-[10px] font-medium uppercase sm:mt-8 sm:text-xs tracking-[0.2em] text-muted-foreground">
          One CRM. One data layer. Every device.
        </p>

        <div className="mx-auto mt-8 w-full max-w-md">
          <p className="text-sm font-semibold">Your role &amp; workspace</p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {ROLES.map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                type="button"
                aria-pressed={role === key}
                onClick={() => setRole(key)}
                className={`flex items-center gap-2 rounded-md border px-3 py-2.5 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold ${role === key ? "border-gold bg-secondary font-semibold" : "border-border bg-card hover:border-gold"}`}
              >
                <Icon className="size-4 shrink-0" /> <span className="truncate">{label}</span>
              </button>
            ))}
          </div>
          <Button size="lg" className="btn-enter mt-4 w-full rounded-md text-base font-bold" onClick={startRole}>
            Get started <ChevronRight className="size-5" />
          </Button>
          <p className="mt-2 text-center text-xs text-muted-foreground">
            Optional — pick a device above so we remember your preferred view.
          </p>
        </div>

        <h2
          id="workspace-signin"
          className="font-hand mt-12 scroll-mt-6 text-center text-3xl font-semibold tracking-normal sm:text-4xl"
        >
          Sign in to your workspace
          <span aria-hidden className="mx-auto mt-2 block h-0.5 w-12 bg-gold" />
        </h2>
        <div className="mt-5 grid gap-3 sm:mt-8 sm:grid-cols-2 sm:gap-4">
          <EntryCard
            icon={<Headphones className="size-6" />}
            title="Sales Agent"
            description="Your own lead queue, call log, WhatsApp threads and AI coaching."
            primary={
              <Button asChild className="btn-enter flex-1">
                <Link to="/auth" search={{ role: "agent", mode: "signin" }}>
                  Sign in
                </Link>
              </Button>
            }
            secondary={
              <Button asChild variant="secondary" className="flex-1">
                <Link to="/auth" search={{ role: "agent", mode: "signup" }}>
                  Create account
                </Link>
              </Button>
            }
          />

          <EntryCard
            icon={<Database className="size-6" />}
            title="LeadHub Nexus"
            description="Canonical lead database, imports, data quality and quantity assignment."
            primary={
              <Button className="btn-enter flex-1" onClick={() => openPin("/leadhub")}>
                <Lock className="size-4" /> Unlock PIN
              </Button>
            }
          />

          <EntryCard
            icon={<BarChart3 className="size-6" />}
            title="Executive HQ"
            description="Live floor performance, leaderboards and ask-anything reports and charts."
            primary={
              <Button className="btn-enter flex-1" onClick={() => openPin("/hq")}>
                <Lock className="size-4" /> Unlock PIN
              </Button>
            }
          />

          <EntryCard
            icon={<Server className="size-6" />}
            title="IT Console"
            description="System configuration, integrations, data health and account approvals."
            primary={
              <Button className="btn-enter flex-1" onClick={() => openPin("/system")}>
                <Lock className="size-4" /> Unlock PIN
              </Button>
            }
          />
        </div>

        <section className="mt-10 border-y border-border py-6">
          <h2 className="text-lg font-bold tracking-tight">Are you a Winstone sales agent?</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Your account and company device must be provisioned by IT HQ before you can start working.
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Already have an account? Sign in using your assigned credentials on the authorized device.
          </p>
          <p className="mt-4 border-t border-border pt-4 text-[11px] font-semibold uppercase tracking-[0.15em] text-gold">
            New agent accounts are created and managed by Winstone IT HQ.
          </p>
        </section>

        {scope !== "none" && (
          <p className="mt-8 text-center text-sm text-muted-foreground">
            Already signed in —{" "}
            <Link to="/desk" className="font-semibold text-gold hover:underline">
              go to my desk
            </Link>
          </p>
        )}

        <footer className="mt-auto pt-14 text-center text-xs text-muted-foreground">
          <p className="inline-flex items-center gap-1.5">
            <LifeBuoy className="size-3.5" /> Need help?{" "}
            <Link to="/support" className="font-semibold text-gold hover:underline">
              Contact IT HQ
            </Link>
          </p>
          <p className="mt-3">© 2026 TrendFlux Digital. All Rights Reserved.</p>
          <p className="mt-1">Developed &amp; Powered by Zahid Hasan Emon.</p>
          <div className="mt-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
            <Link to="/privacy" className="hover:text-foreground">
              Privacy Policy
            </Link>
            <span className="hidden sm:inline">·</span>
            <Link to="/terms" className="hover:text-foreground">
              Terms of Service
            </Link>
            <span className="hidden sm:inline">·</span>
            <Link
              to="/voice-transcription"
              className="inline-flex items-center gap-1 hover:text-foreground"
            >
              <Mic className="size-3" /> Voice Transcription
            </Link>
          </div>
        </footer>
      </main>

      <AdminPinDialog
        open={pinOpen}
        onOpenChange={setPinOpen}
        surface={pinTarget === "/hq" ? "hq" : pinTarget === "/leadhub" ? "leadhub" : "system"}
        onUnlocked={() => void navigate({ to: pinTarget })}
      />
    </div>
  );
}

function EntryCard({
  icon,
  title,
  description,
  primary,
  secondary,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  primary: React.ReactNode;
  secondary?: React.ReactNode;
}) {
  return (
    <section className="group relative flex flex-col gap-3 rounded-xl border border-border bg-card p-5 transition-colors hover:border-gold">
      <span className="grid size-12 place-items-center rounded-full bg-gold/10 text-gold ring-1 ring-gold/40">
        {icon}
      </span>
      <div>
        <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>
      <div className="mt-auto flex flex-wrap gap-2 pt-2">
        {primary}
        {secondary}
      </div>
    </section>
  );
}

function ModeCard({
  icon,
  illustration,
  title,
  subtitle,
  onClick,
}: {
  icon: React.ReactNode;
  illustration: React.ReactNode;
  title: string;
  subtitle: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex min-w-0 flex-col gap-3 rounded-md border border-border bg-card p-2.5 text-left transition-colors sm:gap-5 sm:p-4 hover:border-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
    >
      <span className="flex min-w-0 flex-col-reverse gap-2 sm:flex-row sm:items-start sm:justify-between">
        <span className="min-w-0">
          <span className="hidden size-8 place-items-center rounded-md border border-gold/40 text-gold sm:grid [&_svg]:size-4">
            {icon}
          </span>
          <span className="block text-sm font-bold tracking-tight sm:mt-4 sm:text-lg">{title}</span>
          <span className="mt-0.5 block text-[11px] leading-tight text-muted-foreground sm:text-xs">{subtitle}</span>
        </span>
        {illustration}
      </span>
      <span className="mt-auto flex items-center justify-between rounded-md border border-border bg-secondary px-2 py-2 text-[11px] font-semibold sm:px-3 sm:text-sm">
        <span className="truncate">Select workspace</span>
        <ArrowUpRight className="size-4 shrink-0" />
      </span>
    </button>
  );
}

function DevicePhoto({ src, alt }: { src: string; alt: string }) {
  return (
    <span className="block h-16 w-full shrink-0 overflow-hidden rounded-md sm:h-24 sm:w-24 lg:w-28">
      <img src={src} alt={alt} loading="lazy" className="h-full w-full object-contain" />
    </span>
  );
}

function SmartphoneIllustration() {
  return <DevicePhoto src={androidAsset.url} alt="Android phone" />;
}

function WebIllustration() {
  return <DevicePhoto src={webAsset.url} alt="Phone browser showing the web CRM" />;
}

function DesktopIllustration() {
  return <DevicePhoto src={desktopAsset.url} alt="Desktop computer" />;
}


