import { createFileRoute } from "@tanstack/react-router";
import { Activity, Loader2, Printer, RefreshCw, Smartphone } from "lucide-react";

import { AppShell } from "@/components/crm/AppShell";
import { dhaka, useAgentActivity } from "@/components/crm/AgentOnboarding";
import { RoleGate } from "@/components/crm/RoleGate";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/agent-activity")({
  head: () => ({
    meta: [
      { title: "Agent activity — Winstone Pulse" },
      { name: "description", content: "Staff-only view of agent last login, pending backlog and Android sign-in." },
      { property: "og:title", content: "Agent activity — Winstone Pulse" },
      { property: "og:description", content: "Last login, backlog and Android status for each agent." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Page,
});

function Page() {
  return (
    <AppShell>
      <RoleGate
        allow={["authority"]}
        icon={<Activity className="size-7" />}
        title="এজেন্ট অ্যাক্টিভিটি"
        description="শুধু IT / HQ — PIN দিয়ে খুলুন।"
      >
        <Board />
      </RoleGate>
    </AppShell>
  );
}

function status(r: { isActive: boolean; approved: boolean; mustChangePassword: boolean; hasAccount: boolean }) {
  if (!r.hasAccount) return "অ্যাকাউন্ট নেই";
  if (r.mustChangePassword) return "নতুন পাসওয়ার্ড বাকি";
  if (!r.approved) return "অনুমোদন বাকি";
  return r.isActive ? "সক্রিয়" : "নিষ্ক্রিয়";
}

function Board() {
  const { data, isLoading, refetch, isFetching } = useAgentActivity();
  const rows = (data?.rows ?? []).filter((r) => r.role === "agent" || r.role === "team_leader");
  return (
    <div className="space-y-4 p-4 print:p-0">
      <div className="flex flex-wrap items-center gap-2 print:hidden">
        <h1 className="flex-1 text-lg font-semibold">এজেন্ট অ্যাক্টিভিটি ও লগইন তালিকা</h1>
        <Button size="sm" variant="secondary" onClick={() => void refetch()} disabled={isFetching}>
          <RefreshCw className="size-3.5" /> রিফ্রেশ
        </Button>
        <Button size="sm" onClick={() => window.print()}>
          <Printer className="size-3.5" /> প্রিন্ট (IT-only)
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        IT-only · পাসওয়ার্ড এখানে নেই, কখনো দেখানো হয় না · তৈরি: {dhaka(data?.generatedAt ?? null)} (ঢাকা)
      </p>
      {isLoading ? (
        <Loader2 className="size-5 animate-spin" />
      ) : (
        <div className="table-scroll rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
              <tr>
                <th className="p-2">ID</th>
                <th className="p-2">নাম</th>
                <th className="p-2">ইমেইল</th>
                <th className="p-2">ফোন</th>
                <th className="p-2">স্ট্যাটাস</th>
                <th className="p-2">শেষ লগইন</th>
                <th className="p-2">পেন্ডিং রিপোর্ট</th>
                <th className="p-2">ওভারডিউ ফলো-আপ</th>
                <th className="p-2">Android</th>
                <th className="hidden p-2 print:table-cell">পাসওয়ার্ড (হাতে লিখুন)</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.profileId} className="border-t border-border">
                  <td className="tabular p-2">{r.employeeId ?? "—"}</td>
                  <td className="p-2">{r.name}</td>
                  <td className="p-2 text-xs">{r.email ?? "—"}</td>
                  <td className="tabular p-2">{r.phone ?? "—"}</td>
                  <td className="p-2">{status(r)}</td>
                  <td className="tabular p-2 text-xs">{dhaka(r.lastLoginAt)}</td>
                  <td className="tabular p-2">{r.pendingReports}</td>
                  <td className={`tabular p-2 ${r.overdueFollowUps > 0 ? "text-destructive" : ""}`}>
                    {r.overdueFollowUps}
                  </td>
                  <td className="p-2 text-xs">
                    {r.androidSignedIn ? (
                      <span className="inline-flex items-center gap-1 text-primary">
                        <Smartphone className="size-3.5" /> সাইন ইন · {r.androidVersion ?? "?"} ·{" "}
                        {dhaka(r.androidLastSeenAt)}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">সাইন ইন নেই</span>
                    )}
                  </td>
                  <td className="hidden p-2 print:table-cell">______________</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
