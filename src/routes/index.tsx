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
import { useEffect, useState } from "react";

import logoAsset from "@/assets/winstone-mark.png.asset.json";
import { HomeSignupForm } from "@/components/HomeSignupForm";
import androidAsset from "@/assets/device-android.png.asset.json";
import webAsset from "@/assets/device-web.png.asset.json";
import desktopAsset from "@/assets/device-desktop.png.asset.json";
import { MaintenanceFloorNotice } from "@/components/crm/MaintenanceNotice";
import { AdminPinDialog } from "@/components/crm/AdminPinDialog";
import { Button } from "@/components/ui/button";
import { useMyAccount } from "@/lib/session";
import { useT } from "@/lib/i18n";

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
  const { scope, account } = useMyAccount();
  const [pinOpen, setPinOpen] = useState(false);
  const [accessOpen, setAccessOpen] = useState(false);
  const [selectedMode, setSelectedMode] = useState<"android" | "web" | "desktop" | null>(null);
  const t = useT();
  const [pinTarget, setPinTarget] = useState<"/hq" | "/system" | "/leadhub">("/hq");

  const openPin = (target: "/hq" | "/system" | "/leadhub") => {
    setPinTarget(target);
    setPinOpen(true);
  };

  // One CRM, three layouts: the choice is only a remembered preference.
  // Every mode leads to the same existing access screen below.
  const chooseMode = (mode: "android" | "web" | "desktop") => {
    setSelectedMode(mode);
    try {
      localStorage.setItem("winstone.view-mode", mode);
    } catch {
      // storage blocked: layout still adapts to the screen
    }
  };

  const signedInName = account?.profile?.name ?? null;

  return (
    <div className="theme-exec min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
          <Link to="/" className="flex min-w-0 items-center gap-2.5">
            <img src={logoAsset.url} alt="Winstone logo" className="size-8 rounded-full object-cover ring-1 ring-border" />
            <span className="truncate text-sm font-semibold tracking-tight">
              WINSTONE <span className="text-gold">PULSE</span>
            </span>
          </Link>
          <div className="flex items-center gap-3">
            <SystemStatus />
            {signedInName && (
              <Link to="/desk" className="hidden max-w-[12rem] truncate rounded-full border border-border bg-card px-3 py-1 text-xs font-medium hover:border-gold sm:inline-block">
                {signedInName}
              </Link>
            )}
          </div>
        </div>
      </header>
      <main className="mx-auto flex min-h-[calc(100vh-3.5rem)] w-full max-w-6xl animate-rise flex-col px-4 py-10 sm:px-6 sm:py-16">
        <section className="grid items-end gap-10 lg:grid-cols-[1.25fr_1fr] lg:gap-16">
          <div className="text-center lg:text-left">
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-gold">
              Winstone Properties Ltd. · Find. Build. Invest.
            </p>
            <h1 className="mt-5 font-hand text-[2.8rem] font-semibold leading-[1.05] tracking-normal text-foreground sm:text-6xl lg:text-[5.25rem]">
              Winstone <span className="text-gold">Pulse</span>
            </h1>
            <p className="mt-3 text-xl font-medium tracking-tight text-foreground sm:text-2xl">
              The Premium Real Estate CRM.
            </p>
            <p className="mx-auto mt-4 max-w-lg text-[15px] leading-[1.7] text-muted-foreground sm:text-base lg:mx-0">
              Live sales monitoring, lead management, call activity, follow-up deadlines and team
              performance — one data layer for the whole sales floor.
            </p>
          </div>

          <dl className="grid grid-cols-3 divide-x divide-border overflow-hidden rounded-xl border border-border bg-card lg:grid-cols-1 lg:divide-x-0 lg:divide-y">
            {[
              { icon: Headphones, label: "Team", value: "Every agent, one floor" },
              { icon: BarChart3, label: "Pipeline", value: "Updated in real time" },
              { icon: Smartphone, label: "Calls", value: "Synced from agent SIMs" },
            ].map(({ icon: Icon, label, value }) => (
              <div key={label} className="flex flex-col items-center gap-2 px-3 py-4 text-center lg:flex-row lg:gap-4 lg:px-5 lg:text-left">
                <span className="grid size-9 shrink-0 place-items-center rounded-full border border-gold/50 text-gold">
                  <Icon className="size-4" />
                </span>
                <div className="min-w-0">
                  <dt className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">{label}</dt>
                  <dd className="mt-0.5 text-xs font-semibold leading-snug sm:text-sm">{value}</dd>
                </div>
              </div>
            ))}
          </dl>
        </section>

        <h2 className="mt-16 text-center font-hand text-3xl font-semibold leading-snug tracking-normal sm:mt-20 sm:text-4xl sm:tracking-tight">
          Choose Your Workspace
          <span aria-hidden className="mx-auto mt-2 block h-0.5 w-12 bg-gold" />
        </h2>
        <p className="mt-2 text-center text-sm text-muted-foreground">
          Select the mode you are using — the same Winstone Pulse opens on every device.
        </p>

        <div id="device-selection" className="mt-5 grid grid-cols-3 gap-2 sm:mt-8 sm:gap-6">
          <ModeCard
            illustration={<SmartphoneIllustration />}
            title="Android"
            selected={selectedMode === "android"}
            subtitle="Mobile-first CRM"
            onClick={() => chooseMode("android")}
          />
          <ModeCard
            illustration={<WebIllustration />}
            title="Web / iOS"
            selected={selectedMode === "web"}
            subtitle="Responsive CRM"
            onClick={() => chooseMode("web")}
          />
          <ModeCard
            illustration={<DesktopIllustration />}
            title="Desktop"
            selected={selectedMode === "desktop"}
            subtitle="Full CRM Workspace"
            onClick={() => chooseMode("desktop")}
          />
        </div>

        <p className="mt-5 text-center text-[10px] font-medium uppercase sm:mt-8 sm:text-xs tracking-[0.25em] text-muted-foreground">
          One CRM. One data layer. Every device.
        </p>

        <div className="mx-auto mt-6 w-full max-w-xl sm:mt-8">
          <Button
            size="lg"
            className="w-full rounded-md px-5 text-base font-semibold hover:-translate-y-px hover:bg-charcoal hover:shadow-md active:translate-y-0 active:bg-charcoal/90 transition-all duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 focus-visible:ring-offset-background active:scale-[0.97] motion-reduce:transition-none motion-reduce:active:scale-100 motion-reduce:hover:translate-y-0 motion-reduce:hover:shadow-none"
            aria-expanded={accessOpen}
            aria-controls="workspace-access"
            onClick={() => {
              setAccessOpen(true);
              window.requestAnimationFrame(() => document.getElementById("workspace-access")?.scrollIntoView({
                behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth", block: "start",
              }));
            }}
          >
            Get started <ChevronRight className="size-5" />
          </Button>
          {selectedMode === null && <p className="mt-3 text-center text-xs text-muted-foreground">{t({ en: "Optional — pick a device above so we remember your preferred view.", bn: "ঐচ্ছিক — উপরে ডিভাইস বেছে নিলে আপনার পছন্দের ভিউ মনে রাখা হবে।" })}</p>}
        </div>

        {accessOpen && <div id="workspace-access" className="scroll-mt-6">
        <h2
          id="workspace-signin"
          className="mt-10 scroll-mt-6 text-center font-hand text-2xl font-semibold leading-snug tracking-normal sm:text-4xl sm:tracking-tight"
        >
          Sign in to your workspace
          <span aria-hidden className="mx-auto mt-2 block h-0.5 w-12 bg-gold" />
        </h2>
        <div className="mt-5 grid gap-3 sm:mt-8 sm:grid-cols-2 sm:gap-4">
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

        <HomeSignupForm />
        </div>}

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
  selected,
}: {
  illustration: React.ReactNode;
  title: string;
  subtitle: string;
  onClick: () => void;
  selected: boolean;
}) {
  return (
    <Button
      type="button"
      variant="outline"
      aria-pressed={selected}
      onClick={onClick}
      className={`group h-auto min-w-0 flex-col items-center gap-2 rounded-xl bg-card p-3 text-center shadow-none whitespace-normal transition-colors sm:min-h-44 sm:gap-4 sm:p-7 hover:border-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold ${selected ? "border-gold ring-1 ring-gold" : "border-border"}`}
    >
      <span className="text-foreground">
        {illustration}
      </span>
      <span>
        <span className="block text-sm font-semibold tracking-tight sm:text-lg">{title}</span>
        <span className="mt-0.5 block text-[11px] leading-tight text-muted-foreground sm:mt-1 sm:text-sm">{subtitle}</span>
      </span>
      <span className="btn-enter mt-auto inline-flex h-9 items-center gap-1 rounded-full px-3 text-xs font-semibold sm:h-11 sm:px-5 sm:text-sm">
        {selected ? "Selected" : "Select"} <ChevronRight className="size-4" />
      </span>
    </Button>
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



/** Real liveness only: pings the public health probe, never shows invented numbers. */
function SystemStatus() {
  const [state, setState] = useState<"checking" | "ok" | "down">("checking");
  useEffect(() => {
    let alive = true;
    const check = () =>
      fetch("/api/public/health", { cache: "no-store" })
        .then((r) => alive && setState(r.ok ? "ok" : "down"))
        .catch(() => alive && setState("down"));
    void check();
    const id = window.setInterval(check, 60_000);
    return () => {
      alive = false;
      window.clearInterval(id);
    };
  }, []);
  const label = state === "ok" ? "Systems online" : state === "down" ? "Server not reachable" : "Checking…";
  const dot = state === "ok" ? "bg-success" : state === "down" ? "bg-destructive" : "bg-muted-foreground";
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground" role="status">
      <span aria-hidden className={`size-1.5 rounded-full ${dot}`} />
      {label}
    </span>
  );
}
