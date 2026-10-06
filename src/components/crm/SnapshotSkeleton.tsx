import { useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { RefreshCw, RotateCw, WifiOff } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n";

const SLOW_AFTER_MS = 8000;

/** Shown when loading runs past the limit: reason, what to do, and retry. */
function SlowLoadingCard({ onRetry }: { onRetry: () => void }) {
  const t = useT();
  return (
    <div role="alert" className="card-elevated glass-panel notice-highlight mx-auto max-w-lg space-y-3 border-warning/40 p-5 text-warning">
      <p className="flex items-center gap-2 text-sm font-bold text-foreground">
        <WifiOff className="size-4 text-warning" />
        {t({ bn: "লোড হতে স্বাভাবিকের চেয়ে বেশি সময় লাগছে", en: "Loading is taking longer than usual" })}
      </p>
      <div className="space-y-1 text-xs text-muted-foreground">
        <p><b className="text-foreground">{t({ bn: "সম্ভাব্য কারণ:", en: "Likely cause:" })}</b> {t({ bn: "ইন্টারনেট দুর্বল, নেটওয়ার্ক ধীর, অথবা লগইন সেশনের মেয়াদ শেষ।", en: "Weak internet, slow network, or your sign-in session expired." })}</p>
        <p><b className="text-foreground">{t({ bn: "করণীয়:", en: "What to do:" })}</b> {t({ bn: "আবার চেষ্টা করুন; না হলে পেজ রিফ্রেশ করুন বা আবার সাইন ইন করুন।", en: "Try again; if it persists, refresh the page or sign in again." })}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={onRetry}><RotateCw className="size-4" /> {t({ bn: "আবার চেষ্টা করুন", en: "Try again" })}</Button>
        <Button size="sm" variant="outline" onClick={() => window.location.reload()}><RefreshCw className="size-4" /> {t({ bn: "পেজ রিফ্রেশ", en: "Refresh page" })}</Button>
        <Button size="sm" variant="ghost" asChild><Link to="/auth" search={{ role: "agent", mode: "signin" }}>{t({ bn: "সাইন ইন", en: "Sign in" })}</Link></Button>
      </div>
    </div>
  );
}

/** Shimmering placeholder shown while the live CRM snapshot loads. */
export function SnapshotSkeleton({ tiles = 4, rows = 6 }: { tiles?: number; rows?: number }) {
  const queryClient = useQueryClient();
  const [slow, setSlow] = useState(false);
  const [round, setRound] = useState(0);
  useEffect(() => {
    setSlow(false);
    const id = setTimeout(() => setSlow(true), SLOW_AFTER_MS);
    return () => clearTimeout(id);
  }, [round]);
  const retry = () => {
    void queryClient.refetchQueries({ type: "active" });
    setRound((r) => r + 1);
  };
  return (
    <div className="space-y-8" aria-busy="true" aria-label="Loading live data">
      {slow && <SlowLoadingCard onRetry={retry} />}
      <div className="space-y-2">
        <div className="skeleton h-7 w-56" />
        <div className="skeleton h-4 w-80" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: tiles }).map((_, i) => (
          <div key={i} className="card-elevated space-y-3 p-5">
            <div className="skeleton h-3 w-24" />
            <div className="skeleton h-9 w-20" />
            <div className="skeleton h-3 w-32" />
          </div>
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="card-elevated space-y-4 p-5">
            <div className="flex items-center gap-3">
              <div className="skeleton size-10 rounded-full" />
              <div className="flex-1 space-y-2">
                <div className="skeleton h-4 w-2/3" />
                <div className="skeleton h-3 w-1/2" />
              </div>
            </div>
            <div className="skeleton h-11 w-full rounded-xl" />
          </div>
        ))}
      </div>
    </div>
  );
}
