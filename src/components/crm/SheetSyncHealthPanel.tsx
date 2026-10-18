import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, CheckCircle2, Gauge, Loader2, RefreshCw, RotateCcw } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAdminToken } from "@/lib/local-session";
import { sheetSyncHealth } from "@/lib/sheet-metrics.functions";

const SURFACE_LABEL: Record<string, string> = {
  lead_import: "লিড ইমপোর্ট",
  shift_summary: "শিফট সামারি",
  report_sheet: "রিপোর্ট শিট",
};

const OUTCOME_LABEL: Record<string, string> = {
  success: "সফল",
  retry: "রিট্রাই",
  failure: "ব্যর্থ",
};

function dhakaTime(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("bn-BD", { timeZone: "Asia/Dhaka" });
}

/**
 * IT Console: Google Sheets সিঙ্ক মনিটরিং — কোটা (429) ত্রুটি, রিট্রাই সংখ্যা
 * এবং প্রতিটি সিঙ্ক পথের সর্বশেষ সফল সময়।
 */
export function SheetSyncHealthPanel() {
  const adminToken = useAdminToken();
  const fetchHealth = useServerFn(sheetSyncHealth);

  const health = useQuery({
    queryKey: ["sheet-sync-health", adminToken ? "pin" : "session"],
    queryFn: () => fetchHealth({ data: { adminToken, windowHours: 24 } }),
    refetchInterval: 60_000,
    retry: false,
  });

  const totals = health.data?.totals;
  const surfaces = health.data?.surfaces ?? [];
  const recent = health.data?.recent ?? [];

  return (
    <section className="rounded-2xl border border-border bg-card p-4 sm:p-5">
      <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Gauge className="size-5 text-primary" />
          <div>
            <h2 className="text-base font-semibold">Google Sheets সিঙ্ক মনিটর</h2>
            <p className="text-xs text-muted-foreground">গত ২৪ ঘণ্টার কোটা ত্রুটি, রিট্রাই ও সর্বশেষ সফল সিঙ্ক</p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => void health.refetch()}
          disabled={health.isFetching}
        >
          {health.isFetching ? (
            <Loader2 className="mr-2 size-4 animate-spin" />
          ) : (
            <RefreshCw className="mr-2 size-4" />
          )}
          রিফ্রেশ
        </Button>
      </header>

      {health.isError ? (
        <p className="text-sm text-destructive">{(health.error as Error).message}</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-xl border border-border/60 bg-background/50 p-3">
              <p className="text-xs text-muted-foreground">মোট কল</p>
              <p className="text-xl font-semibold">{totals?.calls ?? 0}</p>
            </div>
            <div className="rounded-xl border border-border/60 bg-background/50 p-3">
              <p className="text-xs text-muted-foreground">সফল</p>
              <p className="text-xl font-semibold text-success">{totals?.successes ?? 0}</p>
            </div>
            <div className="rounded-xl border border-border/60 bg-background/50 p-3">
              <p className="text-xs text-muted-foreground">রিট্রাই</p>
              <p className="text-xl font-semibold text-warning">{totals?.retries ?? 0}</p>
            </div>
            <div className="rounded-xl border border-border/60 bg-background/50 p-3">
              <p className="text-xs text-muted-foreground">কোটা ত্রুটি (429)</p>
              <p className="text-xl font-semibold text-destructive">{totals?.quotaHits ?? 0}</p>
            </div>
          </div>

          <div className="mt-4 grid gap-3 lg:grid-cols-3">
            {surfaces.map((surface) => (
              <div key={surface.surface} className="rounded-xl border border-border/60 p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium">{SURFACE_LABEL[surface.surface] ?? surface.surface}</p>
                  {surface.failures > 0 ? (
                    <Badge variant="destructive" className="gap-1">
                      <AlertTriangle className="size-3" /> সমস্যা
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="gap-1">
                      <CheckCircle2 className="size-3" /> ঠিক আছে
                    </Badge>
                  )}
                </div>
                <dl className="mt-2 space-y-1 text-xs text-muted-foreground">
                  <div className="flex justify-between gap-2">
                    <dt>সর্বশেষ সফল সিঙ্ক</dt>
                    <dd className="text-foreground">{dhakaTime(surface.lastSuccessAt)}</dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="flex items-center gap-1">
                      <RotateCcw className="size-3" /> রিট্রাই
                    </dt>
                    <dd className="text-foreground">{surface.retries}</dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt>কোটা ত্রুটি (429)</dt>
                    <dd className="text-foreground">{surface.quotaHits}</dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt>ব্যর্থ</dt>
                    <dd className="text-foreground">{surface.failures}</dd>
                  </div>
                </dl>
                {surface.lastError ? (
                  <p className="mt-2 break-words rounded-lg bg-destructive/10 p-2 text-[11px] text-destructive">
                    {surface.lastError.slice(0, 200)}
                  </p>
                ) : null}
              </div>
            ))}
          </div>

          <div className="mt-4">
            <h3 className="mb-2 text-sm font-medium">সাম্প্রতিক ঘটনা</h3>
            {recent.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                গত ২৪ ঘণ্টায় কোনো Google Sheets সিঙ্ক হয়নি — লিড ইমপোর্ট বা রিপোর্ট পুশ চালালে এখানে দেখা যাবে।
              </p>
            ) : (
              <div className="max-h-72 overflow-auto rounded-xl border border-border/60">
                <table className="w-full min-w-[520px] text-xs">
                  <thead className="bg-muted/50 text-muted-foreground">
                    <tr>
                      <th className="p-2 text-left">সময়</th>
                      <th className="p-2 text-left">পথ</th>
                      <th className="p-2 text-left">ফল</th>
                      <th className="p-2 text-left">স্ট্যাটাস</th>
                      <th className="p-2 text-left">চেষ্টা</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recent.map((event, index) => (
                      <tr key={`${event.at}-${index}`} className="border-t border-border/50">
                        <td className="p-2 whitespace-nowrap">{dhakaTime(event.at)}</td>
                        <td className="p-2">{SURFACE_LABEL[event.surface] ?? event.surface}</td>
                        <td className="p-2">
                          <span
                            className={
                              event.outcome === "failure"
                                ? "text-destructive"
                                : event.outcome === "retry"
                                  ? "text-warning"
                                  : "text-success"
                            }
                          >
                            {OUTCOME_LABEL[event.outcome] ?? event.outcome}
                          </span>
                        </td>
                        <td className="p-2">{event.httpStatus ?? "—"}</td>
                        <td className="p-2">{event.attempt + 1}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </section>
  );
}
