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
import heroImage from "@/assets/winstone-banner-v2.png.asset.json";
import { AdminPinDialog } from "@/components/crm/AdminPinDialog";
import { Button } from "@/components/ui/button";
import { useMyAccount } from "@/lib/session";
import { useSnapshot } from "@/lib/crm-data";

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
              Close more deals, <span className="text-gold">less chaos.</span>
            </p>
            <p className="mx-auto mt-5 max-w-md text-sm leading-relaxed text-muted-foreground sm:text-base lg:mx-0">
              The visual CRM that your sales team will actually love using. Drag, drop, and close —
              live sales monitoring, lead management, call activity, follow-up deadlines and team
              performance, all in one place.
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
            <img
              src={heroImage.url}
              alt="Winstone — Find. Build. Invest."
              width={1920}
              height={740}
              className="w-full rounded-xl border border-border"
            />
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
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

        <CommandCenterShowcase />

        <h2
          id="workspace-signin"
          className="mt-10 scroll-mt-6 text-center text-xl font-bold tracking-tight"
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
      <span className="origin-center scale-75 text-foreground sm:scale-100">
        {illustration}
      </span>
      <span>
        <span className="block text-sm font-bold tracking-tight sm:text-xl">{title}</span>
        <span className="mt-0.5 block text-[11px] leading-tight text-muted-foreground sm:mt-1 sm:text-sm">{subtitle}</span>
      </span>
      <span className="btn-enter mt-auto inline-flex h-9 items-center gap-1 rounded-full px-3 text-xs font-semibold sm:h-11 sm:px-5 sm:text-sm">
        Select <ChevronRight className="size-4" />
      </span>
    </button>
  );
}

function SmartphoneIllustration() {
  return (
    <span className="relative grid size-20 place-items-center">
      <span className="absolute inset-0 rounded-2xl border border-border bg-surface" />
      <Smartphone className="size-9 text-gold" strokeWidth={1.5} />
    </span>
  );
}

function WebIllustration() {
  return (
    <span className="relative grid size-20 place-items-center">
      <span className="absolute inset-0 rounded-2xl border border-border bg-surface" />
      <Globe className="size-9 text-gold" strokeWidth={1.5} />
    </span>
  );
}

function DesktopIllustration() {
  return (
    <span className="relative grid size-20 place-items-center">
      <span className="absolute inset-0 rounded-2xl border border-border bg-surface" />
      <Monitor className="size-9 text-gold" strokeWidth={1.5} />
    </span>
  );
}

const SHOWCASE = [
  { icon: Headphones, tag: "Lead & Call Management", title: "প্রতিটি কল, এক জায়গায়", to: "/desk", body: "নিজের SIM থেকে কল, তারপর রিপোর্ট — লিডের পুরো ইতিহাস কখনো হারায় না।" },
  { icon: BarChart3, tag: "Live Sales Monitoring", title: "ফ্লোর লাইভ দেখুন", to: "/live-leads", body: "নতুন লিড, কল আর ফলো-আপ কয়েক সেকেন্ডের মধ্যে HQ বোর্ডে আপডেট হয়।" },
  { icon: Globe, tag: "Strategy & Forecasts", title: "তথ্য থেকে সিদ্ধান্ত", to: "/reports", body: "সোশ্যাল পেজ, সাইট ভিজিট ও বুকিং — বাস্তব রিপোর্ট থেকে লক্ষ্য ও প্রবণতা।" },
] as const;

const RANGES = [
  { key: "today", label: "আজ", days: 1 },
  { key: "7", label: "৭ দিন", days: 7 },
  { key: "30", label: "৩০ দিন", days: 30 },
  { key: "all", label: "সব", days: 0 },
] as const;
type RangeKey = (typeof RANGES)[number]["key"];

function LiveTiles() {
  const snap = useSnapshot();
  const [range, setRange] = useState<RangeKey>("today");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const inRange = (iso: string | null | undefined) => {
    if (!iso) return false;
    const t = Date.parse(iso);
    if (from || to) {
      const f = from ? Date.parse(`${from}T00:00:00+06:00`) : -Infinity;
      const e = to ? Date.parse(`${to}T23:59:59+06:00`) : Infinity;
      return t >= f && t <= e;
    }
    const days = RANGES.find((r) => r.key === range)!.days;
    if (!days) return true;
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - (days - 1));
    return t >= start.getTime();
  };
  // Dhaka YYYY-MM-DD bounds handed to the desk lists.
  const rangeDates = (): { from?: string; to?: string } => {
    if (from || to) return { ...(from ? { from } : {}), ...(to ? { to } : {}) };
    const days = RANGES.find((r) => r.key === range)!.days;
    if (!days) return {};
    const d = (ms: number) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dhaka" }).format(new Date(ms));
    return { from: d(Date.now() - (days - 1) * 86_400_000), to: d(Date.now()) };
  };
  const values = {
    Leads: snap.leads.filter((l) => inRange(l.created_at)).length,
    Calls: snap.calls.filter((c) => inRange(c.created_at)).length,
    "Follow-ups": snap.leads.filter((l) => l.status === "follow_up" && inRange(l.updated_at)).length,
  };
  return (
    <>
      <div className="mt-6 flex flex-wrap items-center gap-1.5">
        {RANGES.map((r) => (
          <button
            key={r.key}
            type="button"
            onClick={() => { setRange(r.key); setFrom(""); setTo(""); }}
            className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${range === r.key && !from && !to ? "bg-primary text-primary-foreground" : "bg-background/10 hover:bg-background/20"}`}
          >
            {r.label}
          </button>
        ))}
        <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} aria-label="শুরুর তারিখ" className="rounded-md bg-background/10 px-2 py-1 text-xs" />
        <span className="text-xs opacity-60">–</span>
        <input type="date" value={to} onChange={(e) => setTo(e.target.value)} aria-label="শেষ তারিখ" className="rounded-md bg-background/10 px-2 py-1 text-xs" />
      </div>
      <Tiles values={snap.isPending ? null : values} linked range={rangeDates()} />
    </>
  );
}

const TILE_LINKS = { Leads: "leads", Calls: "calls", "Follow-ups": "calendar" } as const;

function Tiles({
  values,
  linked = false,
  range = {},
}: {
  values: Record<string, number> | null;
  linked?: boolean;
  range?: { from?: string; to?: string };
}) {
  const labels = { Leads: "লিড", Calls: "কল", "Follow-ups": "ফলো-আপ" } as const;
  return (
    <div className="mt-3 grid grid-cols-3 gap-3">
      {(Object.keys(labels) as (keyof typeof labels)[]).map((k) => {
        const inner = (
          <>
            <div className="h-1.5 w-8 rounded bg-primary/70" />
            {values ? (
              <p className="mt-2 text-2xl font-black tabular-nums">{(values[k] ?? 0).toLocaleString("bn-BD")}</p>
            ) : (
              <div className="mt-3 h-6 w-12 animate-pulse rounded bg-background/30" />
            )}
            <p className="mt-1 text-[10px] uppercase tracking-widest opacity-60">{labels[k]}{linked && " →"}</p>
          </>
        );
        const cls = "block rounded-xl border border-background/15 bg-background/5 p-3";
        return linked ? (
          <Link key={k} to="/desk" search={{ s: TILE_LINKS[k], ...range }} className={`${cls} transition-colors hover:border-primary/60 hover:bg-background/10`}>
            {inner}
          </Link>
        ) : (
          <div key={k} className={cls}>{inner}</div>
        );
      })}
    </div>
  );
}

function CommandCenterShowcase() {
  const { scope, isPending } = useMyAccount();
  const signedIn = !isPending && scope !== "none";
  return (
    <section aria-labelledby="command-center" className="mt-14 overflow-hidden rounded-3xl border border-border bg-card shadow-lg">
      <div className="grid lg:grid-cols-[1.1fr_1fr]">
        <div className="bg-foreground p-6 text-background sm:p-8">
          <p className="text-[10px] font-semibold uppercase tracking-[0.35em] text-primary">Command Center</p>
          <h2 id="command-center" className="mt-2 text-2xl font-black tracking-tight sm:text-3xl">এক নজরে পুরো সেলস ফ্লোর</h2>
          <p className="mt-2 max-w-sm text-sm opacity-70">লিড থেকে বুকিং পর্যন্ত — প্রতিটি ধাপ যাচাই করা তথ্যে, অনুমানে নয়।</p>
          {signedIn ? <LiveTiles /> : <div className="mt-3"><Tiles values={null} /></div>}
          {!isPending && !signedIn && (
            <p className="mt-2 text-xs opacity-60">লাইভ সংখ্যা দেখতে নিচে সাইন ইন করুন।</p>
          )}
          <svg aria-hidden viewBox="0 0 300 90" className="mt-4 h-24 w-full">
            <defs>
              <linearGradient id="ccFill" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.5" />
                <stop offset="100%" stopColor="var(--primary)" stopOpacity="0" />
              </linearGradient>
            </defs>
            <path d="M0 75 C40 70 60 55 90 58 S140 30 170 40 S230 10 300 18 L300 90 L0 90 Z" fill="url(#ccFill)" />
            <path d="M0 75 C40 70 60 55 90 58 S140 30 170 40 S230 10 300 18" fill="none" stroke="var(--primary)" strokeWidth="2" />
          </svg>
          <p className="mt-2 text-[10px] uppercase tracking-[0.3em] opacity-50">Pulse — Find. Build. Invest.</p>
        </div>
        <ul className="divide-y divide-border">
          {SHOWCASE.map(({ icon: Icon, tag, title, body, to }) => (
            <li key={tag}>
              <Link to={to} className="group flex gap-4 p-5 transition-colors hover:bg-muted/50 sm:p-6">
              <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><Icon className="size-5" /></span>
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-primary">{tag}</p>
                <h3 className="mt-1 font-bold">{title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{body}</p>
                <p className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-primary">
                  খুলুন <ChevronRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
                </p>
              </div>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
