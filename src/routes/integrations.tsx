import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, Circle, Loader2, PlugZap, XCircle, AlertTriangle } from "lucide-react";
import { useState } from "react";

import { AppShell } from "@/components/crm/AppShell";
import { RoleGate } from "@/components/crm/RoleGate";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
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

const GUIDE: Record<string, string[]> = {
  sheets: ["Linked through the Google Sheets connector.", "Daily report syncs at 6:30 PM Dhaka; delivery is logged in sync health."],
  drive: ["Share a normal Drive folder (drive.google.com/drive/folders/…) with the connected account.", "Recording files should contain the customer phone number."],
  push: ["Agents must allow notifications in the Android app."],
  email: ["Sender domain notify.crm.winstonebd.com needs the TXT and NS records verified at your DNS host."],
  os: ["CRM_BRIDGE_SECRET must match the value saved in Winstone OS.", "Inbound events arrive signed at /api/public/os/events."],
  cron: ["Jobs must point at crm.winstonebd.com (two older jobs used crm1.winstonebd.com)."],
  ai: ["Uses the built-in AI service; no outside key needed."],
};

function stage(status: string, optional: boolean | undefined, r?: { outcome: string }) {
  if (r?.outcome === "failed") return { text: "Error", cls: "bg-destructive/15 text-destructive", Icon: XCircle };
  if (status === "ready" && r?.outcome === "verified") return { text: "Verified", cls: "bg-success/15 text-success", Icon: CheckCircle2 };
  if (status === "not_used" || (optional && status === "missing")) return { text: "Not required", cls: "bg-muted text-muted-foreground", Icon: Circle };
  if (status === "ready") return { text: "Configured", cls: "bg-success/15 text-success", Icon: CheckCircle2 };
  return { text: "Pending setup", cls: "bg-warning/15 text-warning", Icon: AlertTriangle };
}

function Readiness() {
  const [open, setOpen] = useState<string | null>(null);
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
              const r = results[it.id];
              const b = stage(it.status, it.optional, r);
              return (
                <div key={it.id} className="cursor-pointer rounded-lg border bg-card p-4 hover:border-primary/50" onClick={() => setOpen(it.id)}>
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
                      <Button size="sm" variant="outline" disabled={m.isPending && m.variables === it.id} onClick={(e) => { e.stopPropagation(); m.mutate(it.id); }}>
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
      <section className="space-y-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Identity & access</h2>
        <div className="rounded-lg border bg-card p-4 text-sm">
          <div className="flex items-start justify-between gap-2"><div className="font-medium">Microsoft Entra ID (SAML)</div>
            <span className="inline-flex items-center gap-1 rounded-full bg-warning/15 px-2 py-0.5 text-xs text-warning"><AlertTriangle className="size-3" />Pending setup</span></div>
          <p className="mt-1 text-xs text-muted-foreground">Waiting for the Entra Tenant ID (GUID). The domain-based metadata link returned "not found". Existing sign-in keeps working.</p>
        </div>
      </section>
      <Sheet open={!!open} onOpenChange={(v) => !v && setOpen(null)}>
        <SheetContent>
          {(() => { const it = all.find((i) => i.id === open); if (!it) return null; const r = results[it.id]; return (
            <div className="space-y-4">
              <SheetHeader><SheetTitle>{it.label}</SheetTitle></SheetHeader>
              <p className="text-sm text-muted-foreground">{it.purpose}</p>
              <div><div className="text-xs font-semibold">Needed keys</div>
                <ul className="mt-1 space-y-1 font-mono text-xs">{it.keys.map((k) => <li key={k.name}>{k.saved ? "✓" : "✗"} {k.name}</li>)}</ul></div>
              {(GUIDE[it.id] ?? []).length > 0 && <ul className="list-disc space-y-1 pl-5 text-sm">{GUIDE[it.id]!.map((g) => <li key={g}>{g}</li>)}</ul>}
              {it.verifiable ? (
                <div className="space-y-2">
                  <Button onClick={() => m.mutate(it.id)} disabled={m.isPending}>{m.isPending ? <Loader2 className="size-4 animate-spin" /> : "Test connection now"}</Button>
                  {r && <div className="rounded-md border p-2 text-xs">{r.outcome}: {r.detail} · {r.at}</div>}
                </div>
              ) : <p className="text-xs text-muted-foreground">This service can't be test-called safely; only key presence is shown.</p>}
            </div>
          ); })()}
        </SheetContent>
      </Sheet>
    </div>
  );
}
