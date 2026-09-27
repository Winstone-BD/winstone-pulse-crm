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
  RefreshCw,
  Server,
  ShieldCheck,
  Smartphone,
  Users,
  Zap,
} from "lucide-react";
import { useState } from "react";

import logoAsset from "@/assets/winstone-logo.png.asset.json";
import androidImg from "@/assets/mode-android.jpg";
import webImg from "@/assets/mode-web.jpg";
import desktopImg from "@/assets/mode-desktop.jpg";
import buildingImg from "@/assets/home-building.jpg";
import { AdminPinDialog } from "@/components/crm/AdminPinDialog";
import { Button } from "@/components/ui/button";
import { useMyAccount } from "@/lib/session";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Winstone Connect — Tele-Sales Entry Hall" },
      {
        name: "description",
        content:
          "Enter Winstone Connect as a sales agent, coordinator, executive or IT administrator. Accounts for agents and coordinators, master PIN for HQ and IT.",
      },
      { property: "og:title", content: "Winstone Connect — Tele-Sales Entry Hall" },
      {
        property: "og:description",
        content: "Four ways in: Sales Agent desk, Coordinator Deck, Executive HQ and IT Console.",
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
  const [pinTarget, setPinTarget] = useState<"/hq" | "/system">("/hq");

  const openPin = (target: "/hq" | "/system") => {
    setPinTarget(target);
    setPinOpen(true);
  };

  // One CRM, three layouts: the choice is only a remembered preference.
  const chooseMode = (mode: "android" | "web" | "desktop") => {
    try {
      localStorage.setItem("winstone.view-mode", mode);
    } catch {
      // storage blocked: layout still adapts to the screen
    }
    if (mode === "desktop") {
      if (scope === "authority" || scope === "coordinator") void navigate({ to: "/hq" });
      else openPin("/hq");
      return;
    }
    if (scope !== "none") void navigate({ to: "/desk" });
    else void navigate({ to: "/auth", search: { role: "agent", mode: "signin" } });
  };

  return (
    <div className="theme-light min-h-screen bg-background">
      <main className="mx-auto w-full max-w-6xl animate-rise px-4 py-10 sm:px-6 sm:py-14">
        <header className="flex flex-col items-center text-center">
          <img
            src={logoAsset.url}
            alt="Winstone Properties Ltd."
            className="size-20 rounded-full object-cover shadow-sm ring-2 ring-primary/30"
          />
          <h1 className="mt-5 text-4xl font-black tracking-tight text-foreground sm:text-6xl">
            Winstone Connect
          </h1>
          <p className="mt-2 text-xs font-semibold uppercase tracking-[0.35em] text-foreground/80 sm:text-sm">
            Tele-Sales Operating System
          </p>
          <div className="mt-4 flex w-full max-w-2xl items-center gap-3 text-sm text-muted-foreground">
            <span className="h-px flex-1 bg-primary/50" />
            <span className="flex flex-wrap justify-center gap-x-2">
              <span>Calls</span>·<span>Leads</span>·<span>Follow-ups</span>·<span>Team Performance</span>·<span>Growth</span>
            </span>
            <span className="h-px flex-1 bg-primary/50" />
          </div>
          <h2 className="mt-10 text-2xl font-bold tracking-tight sm:text-3xl">Choose Your Working Mode</h2>
          <p className="mt-2 max-w-xl text-sm text-muted-foreground">
            Access Winstone Connect the way you prefer. Same powerful system, on any device.
          </p>
        </header>

        <div className="mt-8 grid gap-5 md:grid-cols-3">
          <ModeCard
            img={androidImg}
            icon={<Smartphone className="size-6" />}
            title="Android Mode"
            description="Optimized for mobile use. Access leads, make calls and update reports on the go."
            cta="Continue on Android"
            strong
            onClick={() => chooseMode("android")}
          />
          <ModeCard
            img={webImg}
            icon={<Globe className="size-6" />}
            title="Web Mode"
            description="Full-featured experience in your browser. Perfect for daily operations."
            cta="Open in Browser"
            onClick={() => chooseMode("web")}
          />
          <ModeCard
            img={desktopImg}
            icon={<Monitor className="size-6" />}
            title="Desktop Mode"
            description="Best for large screens and advanced analysis. Ideal for HQ and management."
            cta="Open Desktop View"
            onClick={() => chooseMode("desktop")}
          />
        </div>

        <ul className="card-elevated mt-6 grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { icon: <Zap className="size-7" />, a: "Same Data", b: "Across All Devices" },
            { icon: <RefreshCw className="size-7" />, a: "Real-time Sync", b: "Always Updated" },
            { icon: <ShieldCheck className="size-7" />, a: "Secure Access", b: "Role-based Control" },
            { icon: <BarChart3 className="size-7" />, a: "Full Features", b: "Complete CRM Access" },
          ].map((f) => (
            <li key={f.a} className="flex items-center gap-3">
              <span className="shrink-0 text-primary">{f.icon}</span>
              <span className="min-w-0 text-sm">
                <span className="block font-medium text-foreground">{f.a}</span>
                <span className="block text-muted-foreground">{f.b}</span>
              </span>
            </li>
          ))}
        </ul>

        <h2 className="mt-12 text-center text-xl font-bold tracking-tight">Sign in to your workspace</h2>
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
            icon={<Users className="size-6" />}
            title="Coordinator Deck"
            description="Assign and balance leads, import lists and watch the whole floor queue."
            primary={
              <Button asChild className="flex-1">
                <Link to="/auth" search={{ role: "coordinator", mode: "signin" }}>
                  Sign in
                </Link>
              </Button>
            }
            secondary={
              <Button asChild variant="secondary" className="flex-1">
                <Link to="/auth" search={{ role: "coordinator", mode: "signup" }}>
                  Create account
                </Link>
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

        <section className="mt-10 grid gap-5 md:grid-cols-2">
          <div className="card-elevated grid overflow-hidden sm:grid-cols-2">
            <img
              src={buildingImg}
              alt="Winstone residential project"
              loading="lazy"
              width={944}
              height={704}
              className="h-48 w-full object-cover sm:h-full"
            />
            <div className="p-5">
              <h3 className="text-2xl font-bold leading-tight">Real Estate Sales Simplified</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Empowering teams with AI-driven tools to sell smarter, faster and better.
              </p>
              <span className="mt-4 block h-0.5 w-12 bg-primary" />
            </div>
          </div>
          <div className="card-elevated flex items-center gap-4 p-5">
            <span className="grid size-16 shrink-0 place-items-center rounded-full bg-primary/15 text-foreground">
              <LifeBuoy className="size-7" />
            </span>
            <div className="min-w-0">
              <h3 className="text-lg font-bold">Need Help?</h3>
              <p className="text-sm text-muted-foreground">
                Contact IT HQ for access, PIN reset or account support.
              </p>
              <Button asChild variant="outline" className="mt-3">
                <Link to="/support">Contact Support</Link>
              </Button>
            </div>
          </div>
        </section>

        {scope !== "none" && (
          <p className="mt-8 text-center text-sm text-muted-foreground">
            Already signed in —{" "}
            <Link to="/desk" className="font-semibold text-primary hover:underline">
              go to my desk
            </Link>
          </p>
        )}

        <footer className="mt-14 text-center text-xs text-muted-foreground">
          <p>© 2026 TrendFlux Digital. All Rights Reserved.</p>
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
        surface={pinTarget === "/hq" ? "hq" : "system"}
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
  img,
  icon,
  title,
  description,
  cta,
  strong,
  onClick,
}: {
  img: string;
  icon: React.ReactNode;
  title: string;
  description: string;
  cta: string;
  strong?: boolean;
  onClick: () => void;
}) {
  return (
    <section className="card-elevated flex flex-col overflow-hidden transition-all hover:-translate-y-0.5 hover:ring-1 hover:ring-primary/40">
      <img src={img} alt={`${title} preview`} width={896} height={752} className="aspect-[6/5] w-full object-contain bg-background" />
      <div className="flex flex-1 flex-col gap-3 p-5 pt-0">
        <span className="-mt-7 grid size-14 place-items-center rounded-full border-2 border-primary/60 bg-background text-primary shadow-sm">
          {icon}
        </span>
        <h3 className="text-2xl font-bold tracking-tight">{title}</h3>
        <p className="text-sm text-muted-foreground">{description}</p>
        <Button
          onClick={onClick}
          variant={strong ? "default" : "secondary"}
          className="mt-auto h-12 justify-center gap-1 text-base"
        >
          {cta} <ChevronRight className="size-4" />
        </Button>
      </div>
    </section>
  );
}
