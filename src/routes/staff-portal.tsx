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
import { staffPortal, type Overview } from "@/lib/staff-portal.functions";

export const Route = createFileRoute("/staff-portal")({
  head: () => ({
    meta: [
      { title: "HQ Staff Portal — Winstone Pulse" },
      { name: "description", content: "HQ-only read-only view of each agent's reports, score and assigned leads." },
      { property: "og:title", content: "HQ Staff Portal — Winstone Pulse" },
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
            <h2 className="font-semibold">
              বরাদ্দ লিড ({d && "leadTotal" in d ? d.leadTotal : (d?.leads.length ?? 0)})
              {d && "leadTotal" in d && d.leadTotal > d.leads.length ? (
                <span className="ml-2 text-xs font-normal text-muted-foreground">সাম্প্রতিক {d.leads.length}টি দেখানো হচ্ছে</span>
              ) : null}
            </h2>
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

function Spark({ values }: { values: number[] }) {
  const max = Math.max(1, ...values);
  return (
    <div className="flex h-8 items-end gap-0.5" aria-label={`৭ দিনের রিপোর্ট: ${values.join(", ")}`}>
      {values.map((v, i) => (
        <div key={i} className="w-2 rounded-sm bg-primary/70" style={{ height: `${Math.max(6, (v / max) * 100)}%` }} title={String(v)} />
      ))}
    </div>
  );
}

function OverviewBoard({ o, onPick }: { o: Overview; onPick: (id: string) => void }) {
  const total = o.rows.reduce((s, r) => s + r.reports, 0);
  const conn = o.rows.reduce((s, r) => s + r.connected, 0);
  const assigned = o.rows.reduce((s, r) => s + r.assignedLeads, 0);
  const called = o.rows.reduce((s, r) => s + r.calledLeads, 0);
  const hourMax = Math.max(1, ...o.hourMix);
  const statusTotal = Math.max(1, o.statusMix.reduce((s, x) => s + x.count, 0));
  return (
    <div className="space-y-4">
      <h2 className="font-semibold">সব এজেন্ট — গত ৭ দিন</h2>
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        <Stat label="মোট রিপোর্ট" value={total} />
        <Stat label="কানেক্ট রেট" value={`${total ? Math.round((conn / total) * 100) : 0}%`} />
        <Stat label="বরাদ্দ লিড" value={assigned} />
        <Stat label="কল হয়েছে এমন লিড" value={`${called} (${assigned ? Math.round((called / assigned) * 100) : 0}%)`} />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-lg border border-border bg-card p-3">
          <h3 className="mb-2 text-sm font-semibold">কোন সময়ে রিপোর্ট জমা হয় (ঢাকা)</h3>
          <div className="flex h-20 items-end gap-0.5">
            {o.hourMix.map((v, h) => (
              <div key={h} className="flex-1 rounded-sm bg-primary/60" style={{ height: `${Math.max(3, (v / hourMax) * 100)}%` }} title={`${h}:00 — ${v}`} />
            ))}
          </div>
          <div className="mt-1 flex justify-between text-[10px] text-muted-foreground"><span>০০</span><span>১২</span><span>২৩</span></div>
        </div>
        <div className="rounded-lg border border-border bg-card p-3">
          <h3 className="mb-2 text-sm font-semibold">রিপোর্ট স্ট্যাটাস</h3>
          {o.statusMix.length ? (
            <ul className="space-y-1.5 text-sm">
              {o.statusMix.map((s) => (
                <li key={s.label} className="flex items-center gap-2">
                  <span className="w-20 truncate">{s.label}</span>
                  <div className="h-2 flex-1 rounded bg-muted">
                    <div className="h-2 rounded bg-primary" style={{ width: `${(s.count / statusTotal) * 100}%` }} />
                  </div>
                  <span className="tabular w-10 text-right">{s.count}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">গত ৭ দিনে কোনো রিপোর্ট নেই।</p>
          )}
        </div>
      </div>

      <div className="table-scroll rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
            <tr>
              <th className="p-2">এজেন্ট</th>
              <th className="p-2">৭ দিনের ট্রেন্ড</th>
              <th className="p-2">রিপোর্ট</th>
              <th className="p-2">কানেক্ট %</th>
              <th className="p-2">পেন্ডিং</th>
              <th className="p-2">Hot</th>
              <th className="p-2">লিড (কল / মোট)</th>
            </tr>
          </thead>
          <tbody>
            {o.rows.map((r) => (
              <tr key={r.profileId} className="cursor-pointer border-t border-border hover:bg-muted/40" onClick={() => onPick(r.profileId)}>
                <td className="p-2">
                  <span className="tabular text-xs text-muted-foreground">{r.employeeId ?? "—"}</span> {r.name}
                </td>
                <td className="p-2"><Spark values={r.daily} /></td>
                <td className="tabular p-2">{r.reports}</td>
                <td className="tabular p-2">{r.reports ? Math.round((r.connected / r.reports) * 100) : 0}%</td>
                <td className={`tabular p-2 ${r.pending > 0 ? "text-destructive" : ""}`}>{r.pending}</td>
                <td className="tabular p-2">{r.hot}</td>
                <td className="tabular p-2">{r.calledLeads} / {r.assignedLeads}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted-foreground">কোনো সারিতে ক্লিক করলে সেই এজেন্টের বিস্তারিত খুলবে।</p>
    </div>
  );
}
