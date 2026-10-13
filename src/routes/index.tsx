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
  Check,
  ArrowUpRight,
} from "lucide-react";
import { useEffect, useState } from "react";

import androidAsset from "@/assets/device-android.png.asset.json";
import webAsset from "@/assets/device-web.png.asset.json";
import desktopAsset from "@/assets/device-desktop.png.asset.json";
import { BrandLockup } from "@/components/BrandLockup";
import { MaintenanceFloorNotice, useMaintenance } from "@/components/crm/MaintenanceNotice";
import { AdminPinDialog } from "@/components/crm/AdminPinDialog";
import { Button } from "@/components/ui/button";
import { useMyAccount } from "@/lib/session";
import { useT } from "@/lib/i18n";
import { HomeErrorBoundary } from "@/components/HomeErrorBoundary";

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
  errorComponent: HomeErrorBoundary,
});

function EntryHall() {
  const navigate = useNavigate();
  const { scope, account } = useMyAccount();
  const [pinOpen, setPinOpen] = useState(false);
  const [accessOpen, setAccessOpen] = useState(false);
  const [workspaceChoice, setWorkspaceChoice] = useState<"hq" | "agent" | "leadhub" | "it" | null>(null);
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
  const recommendedWorkspace = account?.itAuthenticated ? "it" : scope === "authority" ? "hq" : scope === "agent" || scope === "coordinator" ? "agent" : null;
  const activeWorkspace = workspaceChoice ?? recommendedWorkspace;

  return (
    <div className="theme-exec min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto grid min-h-16 w-full max-w-6xl grid-cols-1 items-center gap-1 px-4 py-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:gap-3 sm:px-6">
          <Link to="/" className="flex min-w-0 items-center">
            <BrandLockup />
          </Link>
          <div className="flex shrink-0 items-center gap-3">
            <SystemStatus />
            {signedInName && (
              <Link to="/desk" className="hidden max-w-[12rem] truncate rounded-full border border-border bg-card px-3 py-1 text-xs font-medium hover:border-gold sm:inline-block">
                {signedInName}
              </Link>
            )}
          </div>
        </div>
      </header>
      <main className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-6xl animate-rise flex-col px-4 py-8 sm:px-6 sm:py-10">
        <section className="border-b border-border pb-8 sm:pb-10">
          <div className="min-w-0 text-left">
            <p className="text-[10px] font-semibold uppercase text-gold sm:text-[11px]">
              Winstone Properties Ltd. · Find. Build. Invest.
            </p>
            <h1 className="mt-4 font-hand text-5xl font-semibold leading-[1.05] tracking-normal text-foreground sm:text-6xl lg:text-[5.25rem]">
              Winstone <span className="text-gold">Pulse</span>
            </h1>
            <p className="mt-3 text-xl font-medium text-foreground sm:text-2xl">
              The Premium Real Estate CRM.
            </p>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
              {t({ en: "Leads, calls, follow-ups and team performance. One connected workspace for your sales floor.", bn: "লিড, কল, ফলো-আপ ও টিমের পারফরম্যান্স। পুরো সেলস টিমের জন্য এক সংযুক্ত কর্মক্ষেত্র।" })}
            </p>
          </div>

          <dl className="mt-7 grid gap-4 sm:grid-cols-3 sm:gap-6">
            {[
              { icon: Headphones, label: t({ en: "Manage your team", bn: "টিম ব্যবস্থাপনা" }), value: t({ en: "Agents, roles & performance", bn: "এজেন্ট, দায়িত্ব ও পারফরম্যান্স" }) },
              { icon: BarChart3, label: t({ en: "Track your pipeline", bn: "পাইপলাইন পর্যবেক্ষণ" }), value: t({ en: "Leads, follow-ups & bookings", bn: "লিড, ফলো-আপ ও বুকিং" }) },
              { icon: Smartphone, label: t({ en: "Review call activity", bn: "কলের কার্যক্রম পর্যালোচনা" }), value: t({ en: "Call reports & customer history", bn: "কল রিপোর্ট ও গ্রাহকের ইতিহাস" }) },
            ].map(({ icon: Icon, label, value }) => (
              <div key={label} className="flex min-w-0 items-center gap-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-full border border-gold/50 text-gold">
                  <Icon className="size-4" />
                </span>
                <div className="min-w-0">
                  <dt className="text-sm font-semibold">{label}</dt>
                  <dd className="mt-1 text-xs leading-snug text-muted-foreground">{value}</dd>
                </div>
              </div>
            ))}
          </dl>
        </section>

        <OperationalStatus account={account} />

        <h2 className="mt-7 text-center font-hand text-3xl font-semibold leading-snug tracking-normal sm:mt-8 sm:text-4xl">
          Choose Your Workspace
          <span aria-hidden className="mx-auto mt-2 block h-0.5 w-12 bg-gold" />
        </h2>
        <p className="mt-2 text-center text-sm text-muted-foreground">
          Select the mode you are using — the same Winstone Pulse opens on every device.
        </p>

        <div id="device-selection" className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-3 md:gap-4">
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

        <p className="mt-5 text-center text-[10px] font-medium uppercase sm:text-xs text-muted-foreground">
          One CRM. One data layer. Every device.
        </p>

        <div className="mx-auto mt-6 w-full max-w-xl sm:mt-8">
          <fieldset className="mb-5">
            <legend className="mb-3 text-sm font-semibold">{t({ en: "Your role & workspace", bn: "আপনার দায়িত্ব ও কর্মক্ষেত্র" })}</legend>
            <div className="grid grid-cols-2 gap-2" role="group" aria-label="Role workspace selector">
              {([
                { key: "hq", label: "Executive HQ", icon: BarChart3 },
                { key: "agent", label: "Sales Agent", icon: Headphones },
                { key: "leadhub", label: "LeadHub Nexus", icon: Database },
                { key: "it", label: "IT Console", icon: Server },
              ] as const).map(({ key, label, icon: Icon }) => (
                <Button key={key} variant="outline" aria-pressed={activeWorkspace === key} onClick={() => setWorkspaceChoice(key)} className={`h-auto min-h-12 min-w-0 justify-start gap-2 whitespace-normal px-3 text-left text-xs ${activeWorkspace === key ? "border-gold bg-accent text-accent-foreground" : "bg-card"}`}>
                  <Icon className="size-4 shrink-0" />
                  <span className="min-w-0">{label}{recommendedWorkspace === key && <span className="block text-[10px] font-medium text-muted-foreground">{t({ en: "Your workspace", bn: "আপনার কর্মক্ষেত্র" })}</span>}</span>
                </Button>
              ))}
            </div>
          </fieldset>
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
          <div className={activeWorkspace !== null && activeWorkspace !== "hq" ? "hidden" : "contents"}>
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
          </div>
          <div className={activeWorkspace !== null && activeWorkspace !== "agent" ? "hidden" : "contents"}>
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
          />
          </div>

          <div className={activeWorkspace !== null && activeWorkspace !== "leadhub" ? "hidden" : "contents"}>
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
          </div>



          <div className={activeWorkspace !== null && activeWorkspace !== "it" ? "hidden" : "contents"}>
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
        </div>

        <AgentOnboardingNotice />
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

function OperationalStatus({ account }: { account: ReturnType<typeof useMyAccount>["account"] }) {
  const t = useT();
  const maintenance = useMaintenance();
  const [online, setOnline] = useState<boolean | null>(null);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => { window.removeEventListener("online", update); window.removeEventListener("offline", update); };
  }, []);
  const status = maintenance.data;
  const access = account && !account.signedIn ? t({ en: "Shown after sign-in", bn: "সাইন-ইনের পর দেখা যাবে" }) : !status ? t({ en: "Checking…", bn: "যাচাই চলছে…" }) : !status.ok ? t({ en: "Status unavailable", bn: "অবস্থা অনুপলব্ধ" }) : status.locked ? t({ en: "Workspace locked", bn: "কর্মক্ষেত্র লক" }) : status.stage === "unlocked" ? t({ en: "Temporary unlock", bn: "সাময়িক আনলক" }) : t({ en: "Workspace open", bn: "কর্মক্ষেত্র খোলা" });
  const items = [
    { label: t({ en: "Device connection", bn: "ডিভাইসের সংযোগ" }), value: online === null ? t({ en: "Checking…", bn: "যাচাই চলছে…" }) : online ? t({ en: "Network available", bn: "নেটওয়ার্ক উপলব্ধ" }) : t({ en: "Offline", bn: "অফলাইন" }) },
    { label: t({ en: "Account", bn: "অ্যাকাউন্ট" }), value: !account ? t({ en: "Checking…", bn: "যাচাই চলছে…" }) : account.signedIn ? account.approval === "approved" ? t({ en: "Approved account", bn: "অনুমোদিত অ্যাকাউন্ট" }) : t({ en: "Approval required", bn: "অনুমোদন প্রয়োজন" }) : t({ en: "Sign-in required", bn: "সাইন-ইন প্রয়োজন" }) },
    { label: t({ en: "System access", bn: "সিস্টেমে প্রবেশ" }), value: access },
  ];
  return <section aria-label="Operational status" className="mt-5 border-b border-border pb-5"><dl className="grid gap-4 sm:grid-cols-3">{items.map(({ label, value }) => <div key={label} className="min-w-0"><dt className="text-[11px] text-muted-foreground">{label}</dt><dd className="mt-1 text-sm font-semibold">{value}</dd></div>)}</dl></section>;
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
    <section className="group relative flex flex-col gap-3 rounded-lg border border-border bg-card p-5 transition-colors hover:border-gold">
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
  const t = useT();
  return (
    <Button
      type="button"
      variant="outline"
      aria-pressed={selected}
      onClick={onClick}
      className={`group relative grid h-auto min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-4 rounded-lg bg-card p-4 text-left shadow-none whitespace-normal transition-colors md:min-h-64 md:p-5 hover:border-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold ${selected ? "border-gold bg-accent/30 ring-1 ring-gold" : "border-border"}`}
    >
      <span className="min-w-0">
        <span className="mb-4 grid size-9 place-items-center rounded-md border border-border text-gold">
          {title === "Android" ? <Smartphone className="size-4" /> : title === "Desktop" ? <Monitor className="size-4" /> : <Globe className="size-4" />}
        </span>
        <span className="block text-lg font-semibold">{title}</span>
        <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">{subtitle}</span>
      </span>
      <span className="shrink-0 text-foreground">{illustration}</span>
      <span className={`col-span-2 flex min-h-10 items-center justify-between gap-2 rounded-md border px-3 text-xs font-semibold ${selected ? "border-gold bg-accent text-accent-foreground" : "border-border bg-secondary text-secondary-foreground"}`}>
        {selected ? t({ en: "Selected workspace", bn: "নির্বাচিত কর্মক্ষেত্র" }) : t({ en: "Select workspace", bn: "কর্মক্ষেত্র নির্বাচন" })}
        {selected ? <Check className="size-4 shrink-0" /> : <ArrowUpRight className="size-4 shrink-0" />}
      </span>
    </Button>
  );
}

function DevicePhoto({ src, alt }: { src: string; alt: string }) {
  return (
    <span className="block h-28 w-28 overflow-hidden md:h-32 md:w-28 lg:w-36">
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
  const t = useT();
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
  const label = state === "ok" ? t({ en: "Server online", bn: "সার্ভার অনলাইন" }) : state === "down" ? t({ en: "Server unavailable", bn: "সার্ভার অনুপলব্ধ" }) : t({ en: "Checking server…", bn: "সার্ভার যাচাই…" });
  const dot = state === "ok" ? "bg-success" : state === "down" ? "bg-destructive" : "bg-muted-foreground";
  return (
    <span className="inline-flex w-28 shrink-0 items-center gap-1.5 text-[10px] font-medium text-muted-foreground sm:w-32 sm:justify-end sm:text-[11px]" role="status">
      <span aria-hidden className={`size-1.5 rounded-full ${dot}`} />
      {label}
    </span>
  );
}

/** Informational only: agent accounts and devices are provisioned by IT HQ, never self-created. */
function AgentOnboardingNotice() {
  return (
    <aside aria-labelledby="agent-onboarding-title" className="mt-6 border-y border-border py-5 sm:py-6">
      <h2 id="agent-onboarding-title" className="text-base font-semibold tracking-tight">
        Are you a Winstone sales agent?
      </h2>
      <p className="mt-1.5 text-sm text-muted-foreground">
        Your account and company device must be provisioned by IT HQ before you can start working.
      </p>
      <p className="mt-1.5 text-sm text-muted-foreground">
        Already have an account? Sign in using your assigned credentials on the authorized device.
      </p>
      <p className="mt-4 border-t border-border pt-3 text-[11px] font-medium uppercase tracking-[0.16em] text-gold">
        New agent accounts are created and managed by Winstone IT HQ.
      </p>
    </aside>
  );
}
