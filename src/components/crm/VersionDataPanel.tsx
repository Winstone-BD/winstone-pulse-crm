import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { History, Loader2, RefreshCw, RotateCcw, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmAction } from "@/components/crm/ConfirmAction";
import { useAdminToken } from "@/lib/local-session";
import { replayVersionDataFn, versionDataCoverage } from "@/lib/version-ledger.functions";

function dhakaTime(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("bn-BD", { timeZone: "Asia/Dhaka" });
}

/**
 * IT Console: প্রতিটি অ্যাপ সংস্করণের ডেটা নিশ্চয়তা — কোন সংস্করণ কত লিড ও
 * রিপোর্ট পাঠিয়েছে, কতটা এখনও নতুন সংস্করণে বুঝিয়ে দেওয়া বাকি, এবং কোনো
 * সংস্করণ ফেলে দিলে সেই ডেটা আবার বুঝিয়ে দেওয়ার ব্যবস্থা।
 */
export function VersionDataPanel() {
  const adminToken = useAdminToken();
  const fetchCoverage = useServerFn(versionDataCoverage);
  const replay = useServerFn(replayVersionDataFn);
  const [busy, setBusy] = useState<string | null>(null);

  const coverage = useQuery({
    queryKey: ["version-data-coverage", adminToken ? "pin" : "session"],
    queryFn: () => fetchCoverage({ data: { adminToken, windowDays: 90 } }),
    refetchInterval: 120_000,
    retry: false,
  });

  const versions = coverage.data?.versions ?? [];
  const totals = coverage.data?.totals;
  const pendingByAgent = coverage.data?.pendingByAgent ?? [];

  async function handleReplay(versionCode: number | null, label: string) {
    if (versionCode == null) {
      toast.error("সংস্করণ নম্বর ছাড়া আবার বোঝানো যাবে না");
      return;
    }
    setBusy(label);
    try {
      const result = await replay({ data: { adminToken, versionCode } });
      toast.success(`${label} সংস্করণের ${result.count}টি এন্ট্রি আবার বোঝানোর জন্য প্রস্তুত`);
      await coverage.refetch();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "আবার বোঝানো যায়নি");
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="rounded-2xl border border-border bg-card p-4 sm:p-5">
      <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <ShieldCheck className="size-5 text-primary" />
          <div>
            <h2 className="text-base font-semibold">সংস্করণভিত্তিক ডেটা নিশ্চয়তা</h2>
            <p className="text-xs text-muted-foreground">
              প্রতিটি অ্যাপ সংস্করণের লিড ও রিপোর্ট সংরক্ষিত; সংস্করণ বদলালে বা ফেলে দিলে সেই ডেটা নতুন সংস্করণে আবার বুঝিয়ে দেওয়া যায়
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => void coverage.refetch()} disabled={coverage.isFetching}>
          {coverage.isFetching ? (
            <Loader2 className="mr-2 size-4 animate-spin" />
          ) : (
            <RefreshCw className="mr-2 size-4" />
          )}
          রিফ্রেশ
        </Button>
      </header>

      {coverage.isError ? (
        <p className="text-sm text-destructive">ডেটা পড়া যায়নি — অনুমোদিত অ্যাকাউন্ট বা PIN দিয়ে দেখুন।</p>
      ) : null}

      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "মোট লিড", value: totals?.leads ?? 0 },
          { label: "মোট রিপোর্ট", value: totals?.reports ?? 0 },
          { label: "অফলাইনে তোলা", value: totals?.offlineCaptured ?? 0 },
          { label: "বোঝানো বাকি", value: totals?.pendingHandoff ?? 0 },
        ].map((card) => (
          <div key={card.label} className="rounded-xl border border-border/70 bg-background/60 p-3">
            <p className="text-xs text-muted-foreground">{card.label}</p>
            <p className="text-xl font-semibold">{card.value.toLocaleString("bn-BD")}</p>
          </div>
        ))}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="text-xs text-muted-foreground">
            <tr className="border-b border-border/70 text-left">
              <th className="py-2 pr-3">সংস্করণ</th>
              <th className="py-2 pr-3">লিড</th>
              <th className="py-2 pr-3">রিপোর্ট</th>
              <th className="py-2 pr-3">অফলাইন</th>
              <th className="py-2 pr-3">বাকি</th>
              <th className="py-2 pr-3">সর্বশেষ সিঙ্ক</th>
              <th className="py-2">পুনরায় বোঝানো</th>
            </tr>
          </thead>
          <tbody>
            {versions.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-4 text-center text-muted-foreground">
                  এখনও কোনো সংস্করণের ডেটা রেকর্ড হয়নি।
                </td>
              </tr>
            ) : (
              versions.map((row) => {
                const label = row.appVersion ?? (row.versionCode != null ? `কোড ${row.versionCode}` : "অজানা");
                return (
                  <tr key={`${row.versionCode ?? "unknown"}`} className="border-b border-border/40">
                    <td className="py-2 pr-3 font-medium">
                      {label}
                      {row.versionCode != null ? (
                        <span className="ml-2 text-xs text-muted-foreground">({row.versionCode})</span>
                      ) : null}
                    </td>
                    <td className="py-2 pr-3">{row.leads}</td>
                    <td className="py-2 pr-3">{row.reports}</td>
                    <td className="py-2 pr-3">{row.offlineCaptured}</td>
                    <td className="py-2 pr-3">
                      {row.pendingHandoff > 0 ? (
                        <Badge variant="outline" className="border-warning/60 text-warning">
                          {row.pendingHandoff}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">০</span>
                      )}
                    </td>
                    <td className="py-2 pr-3 text-xs text-muted-foreground">{dhakaTime(row.lastSyncAt)}</td>
                    <td className="py-2">
                      <ConfirmAction
                        title={`${label} সংস্করণের ডেটা আবার বোঝাবেন?`}
                        description="এই সংস্করণের সব লিড ও রিপোর্ট এজেন্টদের ফোনে চালু সংস্করণে আবার পাঠানো হবে। নতুন কিছু তৈরি হবে না।"
                        confirmLabel="হ্যাঁ, আবার বোঝান"
                        onConfirm={() => handleReplay(row.versionCode, label)}
                      >
                        <Button variant="outline" size="sm" disabled={busy === label || row.versionCode == null}>
                          {busy === label ? (
                            <Loader2 className="mr-2 size-4 animate-spin" />
                          ) : (
                            <RotateCcw className="mr-2 size-4" />
                          )}
                          আবার বোঝান
                        </Button>
                      </ConfirmAction>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {pendingByAgent.length > 0 ? (
        <div className="mt-4 rounded-xl border border-border/70 bg-background/60 p-3">
          <p className="mb-2 flex items-center gap-2 text-xs font-medium text-muted-foreground">
            <History className="size-4" /> যাদের ফোনে বোঝানো বাকি
          </p>
          <ul className="space-y-1 text-sm">
            {pendingByAgent.slice(0, 10).map((agent) => (
              <li key={agent.agentId} className="flex items-center justify-between gap-3">
                <span>{agent.agentName ?? agent.agentId.slice(0, 8)}</span>
                <span className="text-xs text-muted-foreground">
                  {agent.pending}টি · সংস্করণ {agent.versions.join(", ") || "—"}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
