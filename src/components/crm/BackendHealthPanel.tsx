import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Activity, AlertTriangle, CheckCircle2, Loader2, RefreshCw } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAdminToken } from "@/lib/local-session";
import { backendHealth } from "@/lib/backend-health.functions";

const LABEL: Record<string, string> = {
  database: "ডেটাবেজ",
  auth: "সাইন-ইন (অথেন্টিকেশন)",
  storage: "ফাইল স্টোরেজ",
};

/**
 * IT Console: read-only backend connectivity check (database, sign-in, storage).
 */
export function BackendHealthPanel() {
  const adminToken = useAdminToken();
  const fetchHealth = useServerFn(backendHealth);

  const health = useQuery({
    queryKey: ["backend-health", adminToken ? "pin" : "session"],
    queryFn: () => fetchHealth({ data: { adminToken } }),
    refetchInterval: 120_000,
    retry: false,
  });

  const checks = health.data?.checks ?? [];
  const allOk = checks.length > 0 && checks.every((check) => check.ok);

  return (
    <section className="rounded-2xl border border-border bg-card p-4 sm:p-5">
      <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Activity className="size-5 text-primary" />
          <div>
            <h2 className="text-sm font-semibold">ব্যাকএন্ড সংযোগ পরীক্ষা</h2>
            <p className="text-xs text-muted-foreground">
              ডেটাবেজ, সাইন-ইন ও ফাইল স্টোরেজ — শুধু পড়ে দেখা হয়, কিছু বদলায় না।
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {checks.length > 0 ? (
            <Badge variant={allOk ? "secondary" : "destructive"}>
              {allOk ? "সব ঠিক আছে" : "সমস্যা আছে"}
            </Badge>
          ) : null}
          <Button
            size="sm"
            variant="outline"
            onClick={() => health.refetch()}
            disabled={health.isFetching}
          >
            {health.isFetching ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <RefreshCw className="size-4" />
            )}
            আবার দেখুন
          </Button>
        </div>
      </header>

      {health.data === null ? (
        <p className="text-xs text-muted-foreground">
          দেখতে আইটি পিন দিয়ে আনলক করুন।
        </p>
      ) : checks.length === 0 ? (
        <p className="text-xs text-muted-foreground">পরীক্ষা চলছে…</p>
      ) : (
        <ul className="space-y-2">
          {checks.map((check) => (
            <li
              key={check.key}
              className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border/70 bg-background/60 px-3 py-2"
            >
              <span className="flex items-center gap-2 text-sm font-medium">
                {check.ok ? (
                  <CheckCircle2 className="size-4 text-primary" />
                ) : (
                  <AlertTriangle className="size-4 text-destructive" />
                )}
                {LABEL[check.key] ?? check.key}
              </span>
              <span className="text-xs text-muted-foreground">{check.detail}</span>
              <span className="text-xs tabular-nums text-muted-foreground">
                {check.latencyMs} ms
              </span>
            </li>
          ))}
        </ul>
      )}

      {health.data?.checkedAt ? (
        <p className="mt-3 text-[11px] text-muted-foreground">
          সর্বশেষ পরীক্ষা:{" "}
          {new Date(health.data.checkedAt).toLocaleString("bn-BD", { timeZone: "Asia/Dhaka" })}
        </p>
      ) : null}
    </section>
  );
}
