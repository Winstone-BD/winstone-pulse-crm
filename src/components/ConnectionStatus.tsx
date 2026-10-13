import { RefreshCw, ServerCrash, Wifi, WifiOff } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { recordHealthOk } from "@/components/ConnectionDiagnostics";
import { useT } from "@/lib/i18n";

type Status = "online" | "offline" | "server-down" | "checking";

const PROBE_URL = "/api/public/health";
const PROBE_TIMEOUT_MS = 5000;
const HEALTHY_INTERVAL_MS = 60_000;
const PROBLEM_INTERVAL_MS = 15_000;

async function probeServer(): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
  try {
    const res = await fetch(PROBE_URL, {
      method: "GET",
      cache: "no-store",
      signal: controller.signal,
    });
    if (res.ok) recordHealthOk();
    return res.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Site-wide connection indicator. Hidden while everything is healthy; appears
 * as a small pill at the top when the device loses internet (amber) or when
 * the internet is fine but the server does not answer (red). Re-checks on its
 * own and disappears once the connection is back.
 */
export function ConnectionStatus() {
  const t = useT();
  const [status, setStatus] = useState<Status>("online");
  const [justBack, setJustBack] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const backFlashRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const statusRef = useRef<Status>("online");
  statusRef.current = status;

  const check = useCallback(async () => {
    if (!navigator.onLine) {
      setStatus("offline");
      return;
    }
    // Background probes stay silent: never flip a healthy status to
    // "checking", or the pill would flash on every page once a minute.
    const ok = await probeServer();
    setStatus((prev) => {
      const next: Status = !navigator.onLine ? "offline" : ok ? "online" : "server-down";
      if (next === "online" && prev !== "online" && prev !== "checking") {
        setJustBack(true);
        if (backFlashRef.current) clearTimeout(backFlashRef.current);
        backFlashRef.current = setTimeout(() => setJustBack(false), 5000);
      }
      return next;
    });
  }, []);

  useEffect(() => {
    const schedule = () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      const delay = statusRef.current === "online" ? HEALTHY_INTERVAL_MS : PROBLEM_INTERVAL_MS;
      timerRef.current = setTimeout(() => void check().finally(schedule), delay);
    };
    void check().finally(schedule);
    const onOnline = () => void check();
    const onOffline = () => setStatus("offline");
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (backFlashRef.current) clearTimeout(backFlashRef.current);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, [check]);

  if (status === "online" && !justBack) return null;

  const config: Record<Status, { className: string; icon: typeof Wifi; text: string }> = {
    online: {
      className: "border-live/40 bg-live/10 text-live",
      icon: Wifi,
      text: t({ bn: "সংযোগ ফিরে এসেছে", en: "Connection restored" }),
    },
    checking: {
      className: "border-border bg-muted text-muted-foreground",
      icon: RefreshCw,
      text: t({ bn: "সংযোগ যাচাই হচ্ছে…", en: "Checking connection…" }),
    },
    offline: {
      className: "border-warning/50 bg-warning/10 text-warning",
      icon: WifiOff,
      text: t({
        bn: "ইন্টারনেট সংযোগ নেই — আপনার ডিভাইসের নেট বন্ধ",
        en: "No internet — your device is offline",
      }),
    },
    "server-down": {
      className: "border-destructive/50 bg-destructive/10 text-destructive",
      icon: ServerCrash,
      text: t({
        bn: "ইন্টারনেট ঠিক আছে, কিন্তু সার্ভার সাড়া দিচ্ছে না",
        en: "Internet is fine, but the server is not responding",
      }),
    },
  };

  const { className, icon: Icon, text } = config[status];

  return (
    <div className="pointer-events-none fixed inset-x-0 top-3 z-[9990] flex justify-center px-3">
      <div
        role="status"
        aria-live="polite"
        className={`pointer-events-auto flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-xs font-semibold shadow-lg backdrop-blur ${className}`}
      >
        <Icon className={`size-3.5 ${status === "checking" ? "animate-spin" : ""}`} />
        <span>{text}</span>
        {status === "server-down" ? (
          <button
            type="button"
            onClick={() => void check()}
            className="ml-1 rounded-full border border-current/30 px-2 py-0.5 text-[10px] font-bold hover:opacity-80"
          >
            {t({ bn: "আবার চেষ্টা", en: "Retry" })}
          </button>
        ) : null}
      </div>
    </div>
  );
}
