import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, Circle, Loader2, PlugZap, XCircle, AlertTriangle } from "lucide-react";
import { useState } from "react";

import { AppShell } from "@/components/crm/AppShell";
import { RoleGate } from "@/components/crm/RoleGate";
import { Button } from "@/components/ui/button";
import { useAdminToken } from "@/lib/local-session";
import { getIntegrationReadiness, verifyIntegration } from "@/lib/integration-readiness.functions";

export const Route = createFileRoute("/integrations")({
  head: () => ({
    meta: [
      { title: "Integration readiness — Winstone Pulse" },
      { name: "description", content: "Check every CRM connection and saved key before going live." },
      { property: "og:title", content: "Integration readiness — Winstone Pulse" },
      { property: "og:description", content: "Grouped connection status and safe verification for HQ / IT." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Page,
});

function Page() {
  return (
    <AppShell>
      <RoleGate surface="hq" allow={["authority"]} icon={<PlugZap className="size-7" />}
        title="Integration readiness" description="Only HQ / IT can view connection status.">
        <Readiness />
      </RoleGate>
    </AppShell>
  );
}

const BADGE: Record<string, { text: string; cls: string; Icon: typeof Circle }> = {
  ready: { text: "Saved", cls: "bg-success/15 text-success", Icon: CheckCircle2 },
  partial: { text: "Incomplete", cls: "bg-warning/15 text-warning", Icon: AlertTriangle },
  missing: { text: "Missing", cls: "bg-destructive/15 text-destructive", Icon: XCircle },
  not_used: { text: "Not set up (optional)", cls: "bg-muted text-muted-foreground", Icon: Circle },
};

function Readiness() {
  const adminToken = useAdminToken();
  const get = useServerFn(getIntegrationReadiness);
  const verify = useServerFn(verifyIntegration);
  const q = useQuery({ queryKey: ["integration-readiness"], queryFn: () => get({ data: { adminToken } }) });
  const [results, setResults] = useState<Record<string, { outcome: string; detail: string; at: string }>>({});
  const m = useMutation({
    mutationFn: (id: string) => verify({ data: { adminToken, id } }),
    onSuccess: (r, id) => setResults((s) => ({ ...s, [id]: { ...r, at: new Date().toLocaleTimeString("en-GB", { timeZone: "Asia/Dhaka" }) } })),
  });

  if (q.isLoading) return <div className="flex justify-center p-10"><Loader2 className="size-6 animate-spin" /></div>;
  if (q.error) return <div className="p-6 text-destructive">{(q.error as Error).message}</div>;
  const groups = q.data ?? [];
  const all = groups.flatMap((g) => g.items);
  const required = all.filter((i) => !i.optional);
  const readyReq = required.filter((i) => i.status === "ready").length;

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-semibold">Integration readiness</h1>
        <p className="text-sm text-muted-foreground">Key values are never shown — only whether each one is saved. "Verify" runs a harmless test call.</p>
        <div className="mt-3 rounded-lg border bg-card p-4">
          <div className="text-sm">Required connections ready: <b>{readyReq} / {required.length}</b></div>
          <div className="mt-2 h-2 rounded-full bg-muted"><div className="h-2 rounded-full bg-primary" style={{ width: `${(readyReq / Math.max(1, required.length)) * 100}%` }} /></div>
        </div>
      </div>
      {groups.map((g) => (
        <section key={g.id} className="space-y-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{g.label}</h2>
          <div className="grid gap-3 md:grid-cols-2">
            {g.items.map((it) => {
              const b = BADGE[it.status];
              const r = results[it.id];
              return (
                <div key={it.id} className="rounded-lg border bg-card p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-medium">{it.label}</div>
                      <div className="text-xs text-muted-foreground">{it.purpose}</div>
                    </div>
                    <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs ${b.cls}`}><b.Icon className="size-3" />{b.text}</span>
                  </div>
                  <ul className="mt-3 space-y-1 text-xs">
                    {it.keys.map((k) => (
                      <li key={k.name} className="flex items-center gap-2 font-mono">
                        {k.saved ? <CheckCircle2 className="size-3 text-success" /> : <XCircle className="size-3 text-muted-foreground" />}{k.name}
                      </li>
                    ))}
                  </ul>
                  {it.note && <div className="mt-2 text-xs text-warning">{it.note}</div>}
                  {it.verifiable && (
                    <div className="mt-3 flex items-center gap-2">
                      <Button size="sm" variant="outline" disabled={m.isPending && m.variables === it.id} onClick={() => m.mutate(it.id)}>
                        {m.isPending && m.variables === it.id ? <Loader2 className="size-3 animate-spin" /> : "Verify"}
                      </Button>
                      {r && <span className={`text-xs ${r.outcome === "verified" ? "text-success" : r.outcome === "skipped" ? "text-muted-foreground" : "text-destructive"}`}>{r.detail} · {r.at}</span>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
