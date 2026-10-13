import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
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
} from "lucide-react";
import { useState } from "react";

import logoAsset from "@/assets/winstone-mark.png.asset.json";
import { HomeSignupForm } from "@/components/HomeSignupForm";
import androidAsset from "@/assets/device-android.png.asset.json";
import webAsset from "@/assets/device-web.png.asset.json";
import desktopAsset from "@/assets/device-desktop.png.asset.json";
import { MaintenanceFloorNotice } from "@/components/crm/MaintenanceNotice";
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

  return (
    <div className="theme-exec min-h-screen bg-background">
      <main className="mx-auto flex min-h-screen w-full max-w-6xl animate-rise flex-col px-4 py-10 sm:px-6 sm:py-14">
        <header className="grid items-center gap-8 lg:grid-cols-2 lg:gap-14">
          <div className="text-center lg:text-left">
            <div className="flex items-center justify-center gap-3 lg:justify-start">
              <img
                src={logoAsset.url}
                alt="Winstone logo"
                className="size-14 rounded-full object-cover ring-1 ring-border sm:size-16"
              />
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.12em] text-gold sm:text-base">
                  Winstone Properties Ltd.
                </p>
                <p className="text-[10px] font-medium uppercase tracking-[0.24em] text-muted-foreground">
                  Find. Build. Invest.
                </p>
              </div>
            </div>
            <h1 className="mt-6 font-hand text-[2.6rem] font-semibold leading-[1.15] tracking-normal text-foreground sm:mt-8 sm:text-6xl sm:leading-[1.1] lg:text-7xl lg:leading-[1.05]">

              Winstone <span className="text-gold">Pulse</span>
            </h1>
            <p className="mt-2 font-hand text-[1.65rem] font-semibold leading-snug tracking-normal text-foreground sm:mt-3 sm:text-3xl lg:text-4xl">
              Close more deals, <span className="text-gold">less chaos.</span>
            </p>
            <p className="mx-auto mt-4 max-w-md text-[15px] leading-[1.65] text-muted-foreground sm:mt-5 sm:text-base sm:leading-relaxed lg:text-[17px] lg:mx-0">
              The visual CRM that your sales team will actually love using. Drag, drop, and close —
              live sales monitoring, lead management, call activity, follow-up deadlines and team
              performance, all in one place.
            </p>
            <div className="mt-6 grid grid-cols-2 gap-3 sm:mt-7 sm:flex sm:flex-wrap sm:items-center sm:justify-center lg:justify-start">
              <Button
                size="lg"
                className="w-full rounded-md px-5 text-base font-semibold hover:-translate-y-px hover:bg-charcoal hover:shadow-md active:translate-y-0 active:bg-charcoal/90 sm:w-auto sm:min-w-36 sm:px-7 transition-all duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 focus-visible:ring-offset-background active:scale-[0.97] motion-reduce:transition-none motion-reduce:active:scale-100 motion-reduce:hover:translate-y-0 motion-reduce:hover:shadow-none"
                onClick={() =>
                  document
                    .getElementById("workspace-signin")
                    ?.scrollIntoView({ behavior: "smooth", block: "start" })
                }
              >
                Get started <ChevronRight className="size-5" />
              </Button>
              <Button asChild size="lg" variant="outline" className="w-full rounded-md px-5 text-base font-medium hover:-translate-y-px hover:border-foreground/40 hover:bg-muted active:translate-y-0 active:bg-muted/80 sm:w-auto sm:min-w-36 sm:px-7 transition-all duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 focus-visible:ring-offset-background active:scale-[0.97] motion-reduce:transition-none motion-reduce:active:scale-100 motion-reduce:hover:translate-y-0 motion-reduce:hover:shadow-none">
                <Link to="/auth" search={{ role: "agent", mode: "signin" }}>
                  Sign in
                </Link>
              </Button>
            </div>
            <div className="mt-7 flex flex-wrap items-center justify-center gap-x-5 gap-y-2.5 sm:mt-8 sm:gap-x-6 lg:justify-start">
              {[
                { icon: Headphones, label: "Manage Your Team" },
                { icon: BarChart3, label: "Track Sales Pipeline" },
                { icon: Smartphone, label: "Monitor Call Activity" },
              ].map(({ icon: Icon, label }) => (
                <span key={label} className="inline-flex items-center gap-2 text-sm font-semibold text-foreground">
                  <span className="grid size-8 place-items-center rounded-full bg-gold/10 text-gold ring-1 ring-gold/40">
                    <Icon className="size-4" />
                  </span>
                  {label}
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
                <p className="text-lg font-semibold tracking-tight">Live, every second</p>
                <p className="text-xs font-medium text-gold">↑ Updated in real time</p>
              </div>
              <div className="rounded-xl border border-border bg-card px-4 py-3">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Follow-ups
                </p>
                <p className="text-lg font-semibold tracking-tight">Never missed</p>
              </div>
            </div>
          </div>
        </header>

        <HomeSignupForm />

        <h2 className="mt-10 text-center font-hand text-2xl font-semibold leading-snug tracking-normal sm:text-4xl sm:tracking-tight">
          Choose Your Workspace
          <span aria-hidden className="mx-auto mt-2 block h-0.5 w-12 bg-gold" />
        </h2>
        <p className="mt-2 text-center text-sm text-muted-foreground">
          Select the mode you are using — the same Winstone Pulse opens on every device.
        </p>

        <div className="mt-5 grid grid-cols-3 gap-2 sm:mt-8 sm:gap-6">
          <ModeCard
            illustration={<SmartphoneIllustration />}
            title="Android"
            subtitle="Mobile-first CRM"
            onClick={() => chooseMode("android")}
          />
          <ModeCard
            illustration={<WebIllustration />}
            title="Web / iOS"
            subtitle="Responsive CRM"
            onClick={() => chooseMode("web")}
          />
          <ModeCard
            illustration={<DesktopIllustration />}
            title="Desktop"
            subtitle="Full CRM Workspace"
            onClick={() => chooseMode("desktop")}
          />
        </div>

        <p className="mt-5 text-center text-[10px] font-medium uppercase sm:mt-8 sm:text-xs tracking-[0.25em] text-muted-foreground">
          One CRM. One data layer. Every device.
        </p>

        <h2
          id="workspace-signin"
          className="mt-10 scroll-mt-6 text-center font-hand text-2xl font-semibold leading-snug tracking-normal sm:text-4xl sm:tracking-tight"
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

        {scope !== "none" && (
          <p className="mt-8 text-center text-sm text-muted-foreground">
            Already signed in —{" "}
            <Link to="/desk" className="font-semibold text-gold hover:underline">
              go to my desk
            </Link>
          </p>
        )}

        {/* The subscription notice lives here, in normal page flow below the content. */}
        <MaintenanceFloorNotice className="pt-8" />

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
  illustration,
  title,
  subtitle,
  onClick,
}: {
  illustration: React.ReactNode;
  title: string;
  subtitle: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex min-w-0 flex-col items-center gap-2 rounded-xl border border-border bg-card p-3 text-center transition-colors sm:min-h-44 sm:gap-4 sm:p-7 hover:border-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
    >
      <span className="text-foreground">
        {illustration}
      </span>
      <span>
        <span className="block text-sm font-semibold tracking-tight sm:text-lg">{title}</span>
        <span className="mt-0.5 block text-[11px] leading-tight text-muted-foreground sm:mt-1 sm:text-sm">{subtitle}</span>
      </span>
      <span className="btn-enter mt-auto inline-flex h-9 items-center gap-1 rounded-full px-3 text-xs font-semibold sm:h-11 sm:px-5 sm:text-sm">
        Select <ChevronRight className="size-4" />
      </span>
    </button>
  );
}

function DevicePhoto({ src, alt }: { src: string; alt: string }) {
  return (
    <span className="block h-20 w-24 overflow-hidden rounded-lg border border-border bg-card sm:h-32 sm:w-44">
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


