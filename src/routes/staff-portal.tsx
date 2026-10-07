import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Loader2, RefreshCw, Users } from "lucide-react";

import { AppShell } from "@/components/crm/AppShell";
import { dhaka } from "@/components/crm/AgentOnboarding";
import { RoleGate } from "@/components/crm/RoleGate";
import { Button } from "@/components/ui/button";
import { getAdminToken } from "@/lib/local-session";
import { staffPortal } from "@/lib/staff-portal.functions";

export const Route = createFileRoute("/staff-portal")({
  head: () => ({
    meta: [
      { title: "HQ Staff Portal — Winstone CRM" },
      { name: "description", content: "HQ-only read-only view of each agent's reports, score and assigned leads." },
      { property: "og:title", content: "HQ Staff Portal — Winstone CRM" },
      { property: "og:description", content: "See any agent's reports, performance and leads without the Agent Desk." },
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
        icon={<Users className="size-7" />}
        title="HQ স্টাফ পোর্টাল"
        description="শুধু HQ — PIN দিয়ে খুলুন।"
      >
        <Portal />
      </RoleGate>
    </AppShell>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="tabular text-lg font-semibold">{value}</div>
    </div>
  );
}

function Portal() {
  const fn = useServerFn(staffPortal);
  const [agentId, setAgentId] = useState<string | null>(null);
  const q = useQuery({
    queryKey: ["staff-portal", agentId],
    queryFn: () => fn({ data: { adminToken: getAdminToken(), agentId } }),
  });
  const d = q.data;
  const agent = d?.agents.find((a) => a.profileId === agentId);

  return (
    <div className="space-y-4 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="flex-1 text-lg font-semibold">HQ স্টাফ পোর্টাল</h1>
        <select
          aria-label="এজেন্ট বাছাই"
          className="h-9 rounded-md border border-input bg-background px-2 text-sm"
          value={agentId ?? ""}
          onChange={(e) => setAgentId(e.target.value || null)}
        >
          <option value="">এজেন্ট বাছাই করুন…</option>
          {(d?.agents ?? []).map((a) => (
            <option key={a.profileId} value={a.profileId}>
              {a.employeeId ?? "—"} · {a.name}
              {a.isActive ? "" : " (নিষ্ক্রিয়)"}
            </option>
          ))}
        </select>
        <Button size="sm" variant="secondary" onClick={() => void q.refetch()} disabled={q.isFetching}>
          <RefreshCw className="size-3.5" /> রিফ্রেশ
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">শুধু দেখার জন্য — এখান থেকে কিছু বদলানো যায় না।</p>

      {q.isLoading ? (
        <Loader2 className="size-5 animate-spin" />
      ) : q.error ? (
        <p className="text-sm text-destructive">লোড হয়নি: {(q.error as Error).message}</p>
      ) : !agent ? (
        d && "overview" in d && d.overview ? (
          <OverviewBoard o={d.overview} onPick={setAgentId} />
        ) : (
          <p className="text-sm text-muted-foreground">উপরে থেকে একজন এজেন্ট বাছাই করুন।</p>
        )
      ) : (
        <>
          <section className="space-y-2">
            <h2 className="font-semibold">আজকের পারফরম্যান্স — {agent.name}</h2>
            {d?.score ? (
              <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
                <Stat label="স্কোর" value={d.score.score} />
                <Stat label="কল" value={d.score.called} />
                <Stat label="কানেক্টেড" value={d.score.connected} />
                <Stat label="রিপোর্ট" value={d.score.reports} />
                <Stat label="ফলো-আপ" value={d.score.followUps} />
                <Stat label="কথা (মিনিট)" value={d.score.talkMinutes} />
                <Stat label="আজ পাওয়া লিড" value={d.score.assigned} />
                <Stat label="শেষ করা" value={d.score.completed} />
                <Stat label="সম্পন্ন %" value={`${d.score.completionPercent}%`} />
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">আজ এই এজেন্টের কোনো স্কোর নেই।</p>
            )}
          </section>

          <section className="space-y-2">
            <h2 className="font-semibold">বরাদ্দ লিড ({d?.leads.length ?? 0})</h2>
            <div className="table-scroll rounded-lg border border-border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
                  <tr>
                    <th className="p-2">নাম</th>
                    <th className="p-2">এলাকা</th>
                    <th className="p-2">স্ট্যাটাস</th>
                    <th className="p-2">কাজের দিন</th>
                    <th className="p-2">শেষ কল</th>
                  </tr>
                </thead>
                <tbody>
                  {d?.leads.length ? (
                    d.leads.map((l) => (
                      <tr key={l.id} className="border-t border-border">
                        <td className="p-2">{l.name ?? "—"}</td>
                        <td className="p-2">{l.area ?? "—"}</td>
                        <td className="p-2">{l.workState ?? l.status ?? "—"}</td>
                        <td className="tabular p-2">{l.workDate ?? "—"}</td>
                        <td className="tabular p-2 text-xs">{dhaka(l.lastCallAt)}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="p-3 text-muted-foreground">কোনো লিড বরাদ্দ নেই।</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className="space-y-2">
            <h2 className="font-semibold">সাম্প্রতিক রিপোর্ট (সর্বশেষ ৫০)</h2>
            <div className="table-scroll rounded-lg border border-border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
                  <tr>
                    <th className="p-2">সময়</th>
                    <th className="p-2">লিড</th>
                    <th className="p-2">স্ট্যাটাস</th>
                    <th className="p-2">কানেক্ট</th>
                    <th className="p-2">সময়কাল</th>
                    <th className="p-2">আগ্রহ</th>
                    <th className="p-2">সারাংশ</th>
                  </tr>
                </thead>
                <tbody>
                  {d?.reports.length ? (
                    d.reports.map((r) => (
                      <tr key={r.id} className="border-t border-border align-top">
                        <td className="tabular p-2 text-xs">{dhaka(r.createdAt)}</td>
                        <td className="p-2">{r.leadName ?? "—"}</td>
                        <td className="p-2">{r.status ?? "—"}</td>
                        <td className="p-2">{r.connected ? "হ্যাঁ" : "না"}</td>
                        <td className="tabular p-2">
                          {r.durationSeconds != null ? `${Math.round(r.durationSeconds / 60)} মি` : "—"}
                        </td>
                        <td className="p-2">{r.temperature ?? r.category ?? "—"}</td>
                        <td className="max-w-xs p-2 text-xs">{r.summary ?? "—"}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={7} className="p-3 text-muted-foreground">কোনো রিপোর্ট নেই।</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
