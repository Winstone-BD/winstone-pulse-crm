import { RefreshCw, RotateCcw, ServerCrash, Wifi, WifiOff } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n";

const LAST_OK_KEY = "pulse:lastHealthOk";

type Result = { ok: boolean; ms: number; at: number; error?: string | undefined };

export function recordHealthOk() {
  try {
    localStorage.setItem(LAST_OK_KEY, String(Date.now()));
  } catch {
    /* storage unavailable */
  }
}

async function runProbe(): Promise<Result> {
  const start = performance.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch("/api/public/health", { cache: "no-store", signal: controller.signal });
    const ms = Math.round(performance.now() - start);
    if (res.ok) recordHealthOk();
    return { ok: res.ok, ms, at: Date.now(), error: res.ok ? undefined : `HTTP ${res.status}` };
  } catch (e) {
    return {
      ok: false,
      ms: Math.round(performance.now() - start),
      at: Date.now(),
      error: controller.signal.aborted ? "Timed out" : e instanceof Error ? e.message : "Failed",
    };
  } finally {
    clearTimeout(timer);
  }
}

function fmt(ts: number | null) {
  if (!ts) return "—";
  const d = new Date(ts);
  const mins = Math.round((Date.now() - ts) / 60000);
  const rel = mins < 1 ? "just now" : mins < 60 ? `${mins} min ago` : `${Math.round(mins / 60)} h ago`;
  return `${d.toLocaleString()} (${rel})`;
}

export function ConnectionDiagnostics() {
  const t = useT();
  const [online, setOnline] = useState(true);
  const [lastOk, setLastOk] = useState<number | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [busy, setBusy] = useState(false);

  const check = useCallback(async () => {
    setBusy(true);
    setOnline(navigator.onLine);
    const r = await runProbe();
    setResult(r);
    const stored = Number(localStorage.getItem(LAST_OK_KEY));
    setLastOk(stored || null);
    setBusy(false);
  }, []);

  useEffect(() => {
    void check();
    const on = () => {
      setOnline(true);
      void check();
    };
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, [check]);

  const hardReload = async () => {
    try {
      const regs = (await navigator.serviceWorker?.getRegistrations?.()) ?? [];
      await Promise.all(regs.map((r) => r.unregister()));
      const keys = (await caches?.keys?.()) ?? [];
      await Promise.all(keys.map((k) => caches.delete(k)));
    } catch {
      /* ignore */
    }
    window.location.reload();
  };

  const serverOk = result?.ok;
  const rows = [
    {
      icon: online ? Wifi : WifiOff,
      label: t({ bn: "ইন্টারনেট", en: "Internet" }),
      value: online ? t({ bn: "সংযুক্ত", en: "Connected" }) : t({ bn: "সংযোগ নেই", en: "Offline" }),
      tone: online ? "text-live" : "text-warning",
    },
    {
      icon: ServerCrash,
      label: t({ bn: "সার্ভার", en: "Server" }),
      value: !result
        ? t({ bn: "যাচাই হচ্ছে…", en: "Checking…" })
        : serverOk
          ? `${t({ bn: "সাড়া দিচ্ছে", en: "Responding" })} · ${result.ms} ms`
          : `${t({ bn: "সাড়া নেই", en: "Not responding" })} · ${result.error ?? ""}`,
      tone: !result ? "text-muted-foreground" : serverOk ? "text-live" : "text-destructive",
    },
    {
      icon: RefreshCw,
      label: t({ bn: "শেষ সফল সংযোগ", en: "Last successful sync" }),
      value: fmt(lastOk),
      tone: "text-foreground",
    },
    {
      icon: RefreshCw,
      label: t({ bn: "শেষ যাচাই", en: "Last checked" }),
      value: fmt(result?.at ?? null),
      tone: "text-foreground",
    },
  ];

  return (
    <section className="rounded-2xl border border-border bg-card p-5">
      <h2 className="text-lg font-semibold">
        {t({ bn: "সংযোগ ডায়াগনস্টিকস", en: "Connection diagnostics" })}
      </h2>
      <dl className="mt-4 grid gap-3 sm:grid-cols-2">
        {rows.map(({ icon: Icon, label, value, tone }) => (
          <div key={label} className="flex items-start gap-3 rounded-xl border border-border p-3">
            <Icon className={`mt-0.5 size-4 shrink-0 ${tone}`} />
            <div className="min-w-0">
              <dt className="text-xs text-muted-foreground">{label}</dt>
              <dd className={`text-sm font-medium break-words ${tone}`}>{value}</dd>
            </div>
          </div>
        ))}
      </dl>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button onClick={() => void check()} disabled={busy}>
          <RefreshCw className={`size-4 ${busy ? "animate-spin" : ""}`} />
          {t({ bn: "আবার যাচাই করুন", en: "Check again" })}
        </Button>
        <Button variant="outline" onClick={() => window.location.reload()}>
          {t({ bn: "পেজ রিলোড", en: "Reload page" })}
        </Button>
        <Button variant="outline" onClick={() => void hardReload()}>
          <RotateCcw className="size-4" />
          {t({ bn: "পুরোনো কপি মুছে রিলোড", en: "Clear saved copy & reload" })}
        </Button>
      </div>
    </section>
  );
}
