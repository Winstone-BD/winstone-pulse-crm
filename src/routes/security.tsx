import { createFileRoute } from "@tanstack/react-router";
import { Check, Lock, ShieldCheck, X } from "lucide-react";
import { useState } from "react";

import { AppShell } from "@/components/crm/AppShell";
import { PinVaultPanel } from "@/components/crm/PinVaultPanel";
import { RoleGate } from "@/components/crm/RoleGate";
import { SnapshotSkeleton } from "@/components/crm/SnapshotSkeleton";
import { Button } from "@/components/ui/button";
import { PIN_ROLE_VIEWS, type PinRoleKey } from "@/lib/pin-guide";
import { useMyAccount } from "@/lib/session";

export const Route = createFileRoute("/security")({
  head: () => ({
    meta: [
      { title: "PIN ও অ্যাক্সেস — Winstone Connect" },
      {
        name: "description",
        content:
          "Role-by-role access guide for Executive HQ, IT Console and Sales Agent, plus the encrypted PIN vault with rotation history.",
      },
      { property: "og:title", content: "PIN ও অ্যাক্সেস — Winstone Connect" },
      {
        property: "og:description",
        content: "Who unlocks what, how PINs are stored, and every rotation on record.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  pendingComponent: () => (
    <AppShell>
      <SnapshotSkeleton />
    </AppShell>
  ),
  component: SecurityPage,
});

function SecurityPage() {
  return (
    <AppShell>
      <RoleGate
        allow={["authority", "coordinator", "agent"]}
        icon={<ShieldCheck className="size-7" />}
        title="পিন ও অ্যাক্সেস"
        description="কে কোন বোর্ড খুলতে পারে আর পিন কীভাবে রক্ষণাবেক্ষণ হয় — নিজের অংশটুকু দেখতে সাইন ইন করুন।"
      >
        <SecurityBoard />
      </RoleGate>
    </AppShell>
  );
}

function SecurityBoard() {
  const { scope } = useMyAccount();
  // Everyone sees their own part only; authority sees all three boards.
  const allowed: PinRoleKey[] =
    scope === "authority" ? ["hq", "it", "agent"] : scope === "coordinator" ? ["agent"] : ["agent"];
  const views = PIN_ROLE_VIEWS.filter((view) => allowed.includes(view.key));
  const [active, setActive] = useState<PinRoleKey>(views[0]?.key ?? "agent");
  const view = views.find((item) => item.key === active) ?? views[0];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold tracking-tight sm:text-2xl">পিন ও অ্যাক্সেস</h1>
        <p className="text-xs text-muted-foreground sm:text-sm">
          রোল অনুযায়ী আলাদা ভিউ — আপনি যা ব্যবহার করেন শুধু সেটাই দেখানো হচ্ছে।
        </p>
      </div>

      {views.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {views.map((item) => (
            <Button
              key={item.key}
              size="sm"
              variant={item.key === active ? "default" : "outline"}
              onClick={() => setActive(item.key)}
            >
              {item.label}
            </Button>
          ))}
        </div>
      )}

      {view && (
        <section className="card-elevated space-y-4 p-4">
          <div>
            <h2 className="text-lg font-semibold">{view.label}</h2>
            <p className="text-xs text-muted-foreground">{view.subtitle}</p>
          </div>
          <div className="rounded-xl bg-surface-2 px-3 py-2 text-sm">
            <span className="inline-flex items-center gap-1.5 font-semibold">
              <Lock className="size-3.5 text-primary" /> ঢোকার পথ
            </span>
            <p className="mt-1 text-muted-foreground">{view.howIn}</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <List title="যা করা যায়" items={view.canDo} tone="ok" />
            <List title="যা করা যায় না" items={view.cannotDo} tone="no" />
          </div>
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              রক্ষণাবেক্ষণের নিয়ম
            </h3>
            <ul className="mt-2 space-y-1.5 text-sm text-muted-foreground">
              {view.maintenance.map((line) => (
                <li key={line}>• {line}</li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {scope === "authority" && <PinVaultPanel />}
    </div>
  );
}

function List({ title, items, tone }: { title: string; items: string[]; tone: "ok" | "no" }) {
  const Icon = tone === "ok" ? Check : X;
  return (
    <div>
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </h3>
      <ul className="mt-2 space-y-1.5 text-sm">
        {items.map((line) => (
          <li key={line} className="flex items-start gap-2">
            <Icon
              className={`mt-0.5 size-3.5 shrink-0 ${tone === "ok" ? "text-live" : "text-destructive"}`}
            />
            <span>{line}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
