import { createFileRoute } from "@tanstack/react-router";
import { CheckCircle2, Circle, ClipboardCheck, Copy, Loader2, ShieldAlert } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/crm/AppShell";
import { RoleGate } from "@/components/crm/RoleGate";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { checkStagingUrl } from "@/lib/staging-check";
import { checkStagingIsolation } from "@/lib/staging-check.functions";

export const Route = createFileRoute("/staging-checklist")({
  head: () => ({
    meta: [
      { title: "Staging setup checklist — Winstone Pulse" },
      { name: "description", content: "Track staging database isolation, connector approval and readiness before running connector tests." },
      { property: "og:title", content: "Staging setup checklist — Winstone Pulse" },
      { property: "og:description", content: "Readiness checklist for isolated connector testing." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: StagingChecklistPage,
});

const KEY = "winstone-staging-checklist-v1";
type State = {
  url: string;
  isolation: "separate" | "live" | "unknown" | "invalid" | null;
  isolationDetail: string;
  checkedAt: string | null;
  allowListed: boolean;
  approved: boolean;
};
const EMPTY: State = { url: "", isolation: null, isolationDetail: "", checkedAt: null, allowListed: false, approved: false };

function StagingChecklistPage() {
  return (
    <AppShell>
      <RoleGate allow={["authority"]} icon={<ClipboardCheck className="size-7" />} title="Staging setup checklist" description="Executive HQ / IT only — sign in.">
        <Checklist />
      </RoleGate>
    </AppShell>
  );
}

function Step({ done, title, children }: { done: boolean; title: string; children: React.ReactNode }) {
  return (
    <li className="flex gap-3 rounded-lg border border-border bg-card p-4">
      {done ? <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-primary" /> : <Circle className="mt-0.5 size-5 shrink-0 text-muted-foreground" />}
      <div className="min-w-0 flex-1 space-y-2">
        <p className="font-medium">{title}</p>
        {children}
      </div>
    </li>
  );
}

function Checklist() {
  const [s, setS] = useState<State>(EMPTY);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) setS({ ...EMPTY, ...(JSON.parse(raw) as Partial<State>) });
    } catch {
      /* ignore corrupt local state */
    }
  }, []);
  const save = (next: Partial<State>) =>
    setS((prev) => {
      const merged = { ...prev, ...next };
      localStorage.setItem(KEY, JSON.stringify(merged));
      return merged;
    });

  const urlCheck = s.url ? checkStagingUrl(s.url) : null;
  const urlOk = urlCheck?.ok === true;
  const isolated = urlOk && s.isolation === "separate";
  const ready = isolated && s.allowListed && s.approved;
  const host = urlCheck?.ok ? urlCheck.host : "<staging-host>";
  const command = [
    "STAGING_E2E=1 SUPABASE_URL=https://<staging-ref>.supabase.co STAGING_CONFIRM=<staging-ref> \\",
    "SUPABASE_SERVICE_ROLE_KEY=<staging key> STAGING_MCP_TOKEN=<oauth token> \\",
    `STAGING_APP_URL=${urlCheck?.ok ? urlCheck.origin : "https://<staging-host>"} STAGING_APP_ALLOWLIST=${host} \\`,
    "STAGING_MCP_TIMEOUT_MS=15000 \\",
    "bunx vitest run --config vitest.staging.config.ts tests/staging/mcp-tools.staging.ts",
  ].join("\n");

  async function runCheck() {
    setBusy(true);
    try {
      const r = await checkStagingIsolation({ data: { url: s.url } });
      save({ isolation: r.verdict, isolationDetail: r.detail, checkedAt: new Date().toISOString() });
    } catch {
      toast.error("Check failed — sign in again and retry.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4 p-4">
      <header className="space-y-1">
        <h1 className="text-xl font-semibold">Staging setup checklist</h1>
        <p className="text-sm text-muted-foreground">
          Complete every step before running connector tests. Progress is saved on this device only; nothing is written to the CRM.
        </p>
      </header>
      <ol className="space-y-3">
        <Step done={urlOk} title="1. Staging app address">
          <Input
            value={s.url}
            placeholder="https://your-staging-copy.lovable.app"
            onChange={(e) => save({ url: e.target.value, isolation: null, isolationDetail: "", checkedAt: null })}
          />
          {urlCheck && !urlCheck.ok && <p className="text-sm text-destructive">{urlCheck.reason}</p>}
        </Step>
        <Step done={isolated} title="2. Database isolation">
          <p className="text-sm text-muted-foreground">Reads the staging app's public sign-in details and confirms it uses a different database from the live CRM.</p>
          <Button size="sm" variant="outline" disabled={!urlOk || busy} onClick={runCheck}>
            {busy && <Loader2 className="size-4 animate-spin" />} Check isolation
          </Button>
          {s.isolation && (
            <p className={`flex items-start gap-1.5 text-sm ${s.isolation === "separate" ? "text-primary" : "text-destructive"}`}>
              {s.isolation !== "separate" && <ShieldAlert className="mt-0.5 size-4 shrink-0" />}
              {s.isolationDetail}
              {s.checkedAt && <span className="text-muted-foreground"> ({new Date(s.checkedAt).toLocaleString()})</span>}
            </p>
          )}
        </Step>
        <Step done={s.allowListed} title="3. Test account on the staging approved list">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={s.allowListed} onChange={(e) => save({ allowListed: e.target.checked })} />
            In the staging copy's IT Console, the test account's email is on the Agent integrations approved list.
          </label>
        </Step>
        <Step done={s.approved} title="4. Connector sign-in approved in staging">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={s.approved} onChange={(e) => save({ approved: e.target.checked })} />
            The test account signed in and approved the connector on the staging approval screen.
          </label>
        </Step>
        <Step done={ready} title="5. Ready to run connector tests">
          {ready ? (
            <>
              <pre className="overflow-x-auto rounded-md bg-muted p-3 text-xs">{command}</pre>
              <Button size="sm" variant="outline" onClick={() => void navigator.clipboard.writeText(command).then(() => toast.success("Copied"))}>
                <Copy className="size-4" /> Copy command
              </Button>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Finish steps 1–4. Step 2 must show a separate database.</p>
          )}
        </Step>
      </ol>
      <Button variant="ghost" size="sm" onClick={() => { localStorage.removeItem(KEY); setS(EMPTY); }}>
        Reset checklist
      </Button>
    </div>
  );
}
