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

import logoAsset from "@/assets/winstone-logo.png.asset.json";
import { AdminPinDialog } from "@/components/crm/AdminPinDialog";
import { Button } from "@/components/ui/button";
import { useMyAccount } from "@/lib/session";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Winstone CRM & Sales Operating System" },
      {
        name: "description",
        content:
          "Choose your workspace: Android, Web / iOS or Desktop. One Winstone CRM and Sales Operating System, the same data on every device.",
      },
      { property: "og:title", content: "Winstone CRM & Sales Operating System" },
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
    <div className="theme-light min-h-screen bg-background">
      <main className="mx-auto flex min-h-screen w-full max-w-6xl animate-rise flex-col px-4 py-12 sm:px-6 sm:py-16">
        <header className="flex flex-col items-center text-center">
          <img
            src={logoAsset.url}
            alt="Winstone Properties Ltd."
            className="size-24 rounded-full object-cover shadow-md ring-2 ring-primary/40 sm:size-28"
          />
          <h1 className="mt-6 text-4xl font-black tracking-tight text-foreground sm:text-6xl">
            Winstone CRM
          </h1>
          <p className="mt-3 text-[11px] font-semibold uppercase tracking-[0.4em] text-primary sm:text-xs">
            Sales Operating System
          </p>
          <span aria-hidden className="mt-6 h-px w-24 bg-primary/60" />
          <h2 className="mt-8 text-2xl font-bold tracking-tight sm:text-3xl">Choose Your Workspace</h2>
          <p className="mt-2 max-w-md text-sm text-muted-foreground">
            Select the mode you are using — the same Winstone CRM opens on every device.
          </p>
        </header>

        <div className="mt-10 grid gap-5 sm:grid-cols-3 sm:gap-6">
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

        <p className="mt-10 text-center text-xs font-medium uppercase tracking-[0.25em] text-muted-foreground">
          One CRM. One data layer. Every device.
        </p>

        <h2
          id="workspace-signin"
          className="mt-16 scroll-mt-6 text-center text-xl font-bold tracking-tight"
        >
          Sign in to your workspace
        </h2>
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <EntryCard
            icon={<Headphones className="size-6" />}
            title="Sales Agent"
            description="Your own lead queue, call log, WhatsApp threads and AI coaching."
            primary={
              <Button asChild className="flex-1">
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
              <Button className="flex-1" onClick={() => openPin("/leadhub")}>
                <Lock className="size-4" /> Unlock PIN
              </Button>
            }
          />

          <EntryCard
            icon={<BarChart3 className="size-6" />}
            title="Executive HQ"
            description="Live floor performance, leaderboards and ask-anything reports and charts."
            primary={
              <Button className="flex-1" onClick={() => openPin("/hq")}>
                <Lock className="size-4" /> Unlock PIN
              </Button>
            }
          />

          <EntryCard
            icon={<Server className="size-6" />}
            title="IT Console"
            description="System configuration, integrations, data health and account approvals."
            primary={
              <Button className="flex-1" onClick={() => openPin("/system")}>
                <Lock className="size-4" /> Unlock PIN
              </Button>
            }
          />
        </div>

        {scope !== "none" && (
          <p className="mt-8 text-center text-sm text-muted-foreground">
            Already signed in —{" "}
            <Link to="/desk" className="font-semibold text-primary hover:underline">
              go to my desk
            </Link>
          </p>
        )}

        <footer className="mt-auto pt-14 text-center text-xs text-muted-foreground">
          <p className="inline-flex items-center gap-1.5">
            <LifeBuoy className="size-3.5" /> Need help?{" "}
            <Link to="/support" className="font-semibold text-primary hover:underline">
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
    <section className="card-elevated group relative flex flex-col gap-3 overflow-hidden p-5 transition-all hover:-translate-y-0.5 hover:ring-1 hover:ring-primary/30">
      <span
        aria-hidden
        className="pointer-events-none absolute -right-10 -top-10 size-28 rounded-full bg-primary/10 blur-2xl transition-opacity group-hover:opacity-80"
      />
      <span className="grid size-12 place-items-center rounded-full bg-primary/15 text-primary ring-1 ring-primary/25 transition-transform group-hover:scale-105">
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
      className="card-elevated group flex min-h-44 flex-col items-center gap-4 p-7 text-center transition-all duration-200 hover:-translate-y-1 hover:shadow-lg hover:ring-1 hover:ring-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary active:translate-y-0 active:shadow-sm"
    >
      <span className="text-foreground transition-transform duration-200 group-hover:scale-105">
        {illustration}
      </span>
      <span>
        <span className="block text-xl font-bold tracking-tight">{title}</span>
        <span className="mt-1 block text-sm text-muted-foreground">{subtitle}</span>
      </span>
      <span className="mt-auto inline-flex h-11 items-center gap-1 rounded-full border border-primary/40 px-5 text-sm font-semibold text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
        Select <ChevronRight className="size-4" />
      </span>
    </button>
  );
}

function SmartphoneIllustration() {
  return (
    <span className="relative grid size-20 place-items-center">
      <span className="absolute inset-0 rounded-3xl border border-primary/30 bg-primary/5" />
      <Smartphone className="size-9" strokeWidth={1.5} />
    </span>
  );
}

function WebIllustration() {
  return (
    <span className="relative grid size-20 place-items-center">
      <span className="absolute inset-0 rounded-3xl border border-primary/30 bg-primary/5" />
      <Globe className="size-9" strokeWidth={1.5} />
    </span>
  );
}

function DesktopIllustration() {
  return (
    <span className="relative grid size-20 place-items-center">
      <span className="absolute inset-0 rounded-3xl border border-primary/30 bg-primary/5" />
      <Monitor className="size-9" strokeWidth={1.5} />
    </span>
  );
}
