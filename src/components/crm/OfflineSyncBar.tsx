import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Activity, CloudOff, RefreshCw, WifiOff } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { submitMyReport, syncOfflineCallEvent } from "@/lib/call-reports.functions";
import { useT } from "@/lib/i18n";
import { type LoadRecord, readLoads, STEP_LABELS, subscribeLoads } from "@/lib/load-perf";
import { useAdminToken } from "@/lib/local-session";
import { flushQueue, markPending, type OfflineItem, subscribeQueue } from "@/lib/offline-queue";

const DATA_LABELS: Record<string, { bn: string; en: string }> = {
  "my-account": { bn: "অ্যাকাউন্ট", en: "Account" },
  "crm-snapshot": { bn: "লিড/কল/মেসেজ", en: "Leads/calls/messages" },
  "pending-call-report": { bn: "বাকি রিপোর্ট", en: "Pending reports" },
  "my-call-reports": { bn: "আমার রিপোর্ট", en: "My reports" },
};

const fmtTime = (t: number) =>
  t ? new Date(t).toLocaleTimeString("en-GB", { timeZone: "Asia/Dhaka", hour: "2-digit", minute: "2-digit" }) : "—";

type Refresh = { ok: string[]; failed: string[] };

/**
 * Always-visible connection status, last sync time, what refreshed after
 * reconnecting, and a small device-local load-time history. Nothing is shown
 * as synced until the server actually answered.
 */
export function OfflineSyncBar() {
  const t = useT();
  const adminToken = useAdminToken();
  const [items, setItems] = useState<OfflineItem[]>([]);
  const [online, setOnline] = useState(true);
  const [busy, setBusy] = useState(false);
  const [lastSync, setLastSync] = useState(0);
  const [refresh, setRefresh] = useState<Refresh | null>(null);
  const [loads, setLoads] = useState<LoadRecord[]>([]);
  const [showPerf, setShowPerf] = useState(false);
  const queryClient = useQueryClient();
  const sendCall = useServerFn(syncOfflineCallEvent);
  const sendReport = useServerFn(submitMyReport);

  useEffect(() => subscribeQueue(setItems), []);
  useEffect(() => {
    setLoads(readLoads());
    return subscribeLoads(() => setLoads(readLoads()));
  }, []);

  // Last successful sync = newest successful data update in the cache.
  useEffect(() => {
    const calc = () => {
      let max = 0;
      for (const q of queryClient.getQueryCache().getAll()) {
        if (q.state.status === "success" && q.state.dataUpdatedAt > max) max = q.state.dataUpdatedAt;
      }
      setLastSync(max);
    };
    calc();
    return queryClient.getQueryCache().subscribe(calc);
  }, [queryClient]);

  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    const back = async () => {
      toast.success("ইন্টারনেট ফিরে এসেছে — ডেটা আবার লোড হচ্ছে");
      await queryClient.refetchQueries({ type: "active" });
      const ok: string[] = [];
      const failed: string[] = [];
      for (const q of queryClient.getQueryCache().findAll({ type: "active" })) {
        const k = String(q.queryKey[0]);
        const label = DATA_LABELS[k] ? t(DATA_LABELS[k]) : k;
        const list = q.state.status === "error" ? failed : ok;
        if (!list.includes(label)) list.push(label);
      }
      setRefresh({ ok, failed });
    };
    const backFn = () => void back();
    window.addEventListener("online", backFn);
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", backFn);
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, [queryClient, t]);

  const flush = useCallback(async () => {
    if (!navigator.onLine) return;
    setBusy(true);
    const result = await flushQueue({
      call_event: (payload) => sendCall({ data: { ...payload, adminToken } as never }),
      report_submit: (payload) => sendReport({ data: { ...payload, adminToken } as never }),
    });
    setBusy(false);
    if (result.synced) {
      toast.success(`${result.synced}টি অফলাইন কাজ সার্ভারে জমা হয়েছে`);
      void queryClient.invalidateQueries({ queryKey: ["crm-snapshot"] });
      void queryClient.invalidateQueries({ queryKey: ["pending-call-report"] });
      void queryClient.invalidateQueries({ queryKey: ["my-call-reports"] });
    }
  }, [adminToken, queryClient, sendCall, sendReport]);

  useEffect(() => {
    if (online && items.length) void flush();
  }, [online, items.length, flush]);

  const failed = items.filter((item) => item.status === "failed");
  const avg = loads.length ? Math.round(loads.reduce((s, l) => s + l.ms, 0) / loads.length) : 0;
  const slowest = Object.keys(STEP_LABELS)
    .map((key) => ({ key, ms: Math.max(0, ...loads.map((l) => l.steps.find((s) => s.key === key)?.ms ?? 0)) }))
    .sort((a, b) => b.ms - a.ms);

  return (
    <div className="mb-3 space-y-2">
      {/* Persistent status strip */}
      <div className="glass-panel flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-border px-3 py-1.5 text-[11px]">
        <span className={`flex items-center gap-1.5 font-semibold ${online ? "text-live" : "text-warning"}`}>
          <span className={`size-2 rounded-full ${online ? "bg-live" : "animate-pulse bg-warning"}`} />
          {online ? t({ bn: "সংযুক্ত", en: "Connected" }) : t({ bn: "অফলাইন", en: "Offline" })}
        </span>
        <span className="text-muted-foreground">
          {t({ bn: "শেষ সিঙ্ক", en: "Last synced" })}: <b className="tabular text-foreground">{fmtTime(lastSync)}</b>
        </span>
        {items.length ? (
          <span className="text-warning">{items.length} {t({ bn: "টি বাকি", en: "pending" })}</span>
        ) : null}
        <button
          type="button"
          onClick={() => setShowPerf((v) => !v)}
          className="ml-auto flex items-center gap-1 text-muted-foreground hover:text-foreground"
        >
          <Activity className="size-3.5" />
          {t({ bn: "লোড সময়", en: "Load times" })}
          {avg ? <span className="tabular">· {(avg / 1000).toFixed(1)}s</span> : null}
        </button>
      </div>

      {showPerf && (
        <div className="glass-panel space-y-2 rounded-xl border border-border p-3 text-xs">
          {loads.length ? (
            <>
              <p className="font-bold">{t({ bn: "সাম্প্রতিক লোড (এই ডিভাইস)", en: "Recent loads (this device)" })}</p>
              <ul className="space-y-1">
                {loads.slice(0, 5).map((l) => (
                  <li key={l.at} className="flex items-center gap-2">
                    <span className="tabular w-12 text-muted-foreground">{fmtTime(l.at)}</span>
                    <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                      <span
                        className={`block h-full ${l.ms > 8000 ? "bg-destructive" : l.ms > 3000 ? "bg-warning" : "bg-live"}`}
                        style={{ width: `${Math.min(100, (l.ms / 10000) * 100)}%` }}
                      />
                    </span>
                    <span className="tabular w-12 text-right">{(l.ms / 1000).toFixed(1)}s</span>
                  </li>
                ))}
              </ul>
              <p className="font-bold">{t({ bn: "সবচেয়ে ধীর ধাপ", en: "Slowest steps" })}</p>
              {slowest.map((s) => (
                <p key={s.key} className="flex justify-between text-muted-foreground">
                  <span>{t(STEP_LABELS[s.key] ?? { bn: s.key, en: s.key })}</span>
                  <span className="tabular text-foreground">{(s.ms / 1000).toFixed(1)}s</span>
                </p>
              ))}
            </>
          ) : (
            <p className="text-muted-foreground">{t({ bn: "এখনো কোনো লোড রেকর্ড নেই।", en: "No load records yet." })}</p>
          )}
        </div>
      )}

      {refresh && (
        <div className={`notice-highlight rounded-xl border p-3 text-xs ${refresh.failed.length ? "border-destructive/40 bg-destructive/10" : "border-live/30 bg-live/10"}`}>
          <div className="flex items-start gap-2">
            <div className="flex-1 space-y-1">
              {refresh.ok.length ? (
                <p>✓ {t({ bn: "আবার লোড হয়েছে", en: "Refreshed" })}: {refresh.ok.join(", ")}</p>
              ) : null}
              {refresh.failed.length ? (
                <p className="font-semibold text-destructive">
                  ✕ {t({ bn: "সিঙ্ক হয়নি", en: "Still failed" })}: {refresh.failed.join(", ")}
                </p>
              ) : null}
            </div>
            {refresh.failed.length ? (
              <Button size="sm" variant="secondary" className="h-7 px-2 text-[11px]" onClick={() => window.dispatchEvent(new Event("online"))}>
                <RefreshCw className="size-3.5" /> {t({ bn: "আবার", en: "Retry" })}
              </Button>
            ) : null}
            <button type="button" className="text-muted-foreground" onClick={() => setRefresh(null)} aria-label="close">×</button>
          </div>
        </div>
      )}

      {(items.length > 0 || !online) && (
        <div className="space-y-1.5 rounded-xl border border-warning/40 bg-warning/10 p-3 text-xs">
          <p className="flex items-center gap-1.5 font-bold">
            {online ? <CloudOff className="size-3.5" /> : <WifiOff className="size-3.5" />}
            {online
              ? `${items.length}টি কাজ এখনো এই ফোনেই আছে — সার্ভারে পাঠানো হচ্ছে`
              : "ইন্টারনেট সংযোগ বিচ্ছিন্ন — ড্যাশবোর্ডের ডেটা এখন আপডেট হবে না। কাজ এই ফোনে সেভ হচ্ছে; নেট ফিরলে নিজে থেকেই আবার লোড ও সিঙ্ক হবে"}
          </p>
          {items.slice(0, 5).map((item) => (
            <p key={item.id} className={item.status === "failed" ? "text-destructive" : "text-muted-foreground"}>
              • {item.label} —{" "}
              {item.status === "failed" ? `পাঠানো যায়নি (${item.lastError ?? "ত্রুটি"})` : "সিঙ্ক বাকি"}
            </p>
          ))}
          {failed.length ? (
            <Button
              type="button"
              size="sm"
              variant="secondary"
              className="h-7 gap-1 px-2 text-[11px]"
              disabled={busy || !online}
              onClick={() => {
                failed.forEach((item) => markPending(item.id));
                void flush();
              }}
            >
              <RefreshCw className={`size-3.5 ${busy ? "animate-spin" : ""}`} /> আবার চেষ্টা করুন
            </Button>
          ) : null}
        </div>
      )}
    </div>
  );
}
