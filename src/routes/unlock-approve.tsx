import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { z } from "zod";
import { confirmUnlockEmail, peekUnlockEmail } from "@/lib/unlock-email.functions";

export const Route = createFileRoute("/unlock-approve")({
  validateSearch: z.object({ t: z.string().optional() }),
  head: () => ({
    meta: [
      { title: "Approve CRM Unlock — Winstone Pulse" },
      { name: "description", content: "Secure one-time approval for a Winstone Pulse CRM unlock request." },
      { name: "robots", content: "noindex, nofollow" },
      { property: "og:title", content: "Approve CRM Unlock — Winstone Pulse" },
      { property: "og:description", content: "Secure one-time approval for a CRM unlock request." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: UnlockApprove,
});

type Peek = Awaited<ReturnType<typeof peekUnlockEmail>>;

function UnlockApprove() {
  const { t } = Route.useSearch();
  const peek = useServerFn(peekUnlockEmail);
  const confirm = useServerFn(confirmUnlockEmail);
  const [info, setInfo] = useState<Peek | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  useEffect(() => {
    if (!t) { setInfo({ ok: false, error: "Missing approval link." }); return; }
    peek({ data: { token: t } }).then(setInfo).catch(() => setInfo({ ok: false, error: "Could not load request." }));
  }, [t]);

  async function decide(approve: boolean) {
    if (!t) return;
    setBusy(true);
    const r = await confirm({ data: { token: t, approve } }).catch(() => ({ ok: false as const, error: "Request failed" }));
    setBusy(false);
    if (!r.ok) setResult(r.error);
    else setResult(r.status === "approved"
      ? `CRM unlocked${r.expiresAt ? ` until ${new Date(r.expiresAt).toLocaleString("en-GB", { timeZone: "Asia/Dhaka" })} (Dhaka)` : ""}.`
      : "Request denied.");
  }

  return (
    <main className="min-h-screen bg-background text-foreground flex items-center justify-center p-6">
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 space-y-4">
        <h1 className="text-3xl">Approve CRM Unlock</h1>
        {!info && <p className="text-muted-foreground">Checking link…</p>}
        {info && !info.ok && <p className="text-destructive">{info.error}</p>}
        {info?.ok && (
          <>
            <dl className="text-sm space-y-1">
              <div><dt className="inline text-muted-foreground">Requested by: </dt><dd className="inline">{info.requestedBy}</dd></div>
              <div><dt className="inline text-muted-foreground">Duration: </dt><dd className="inline">{info.hours} hour(s)</dd></div>
              <div><dt className="inline text-muted-foreground">Period: </dt><dd className="inline">{info.period}</dd></div>
              <div><dt className="inline text-muted-foreground">Payment: </dt><dd className="inline">{info.paymentStatus}</dd></div>
              <div><dt className="inline text-muted-foreground">Reason: </dt><dd className="inline">{info.reason ?? "-"}</dd></div>
            </dl>
            {result ? <p className="font-medium">{result}</p> : info.status !== "requested" ? (
              <p className="text-muted-foreground">This request is already {info.status}.</p>
            ) : (
              <div className="flex gap-3">
                <button disabled={busy} onClick={() => decide(true)} className="flex-1 rounded-md bg-primary text-primary-foreground px-4 py-2 font-medium disabled:opacity-50">Confirm & Unlock</button>
                <button disabled={busy} onClick={() => decide(false)} className="rounded-md border border-border px-4 py-2 disabled:opacity-50">Deny</button>
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}
