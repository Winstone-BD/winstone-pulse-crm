import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, Lock } from "lucide-react";

import { listNeglectDisputes, myNeglect } from "@/lib/lead-neglect.functions";
import { useAdminToken } from "@/lib/local-session";

type Named = { name: string | null } | null;

function fmt(iso: string) {
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeZone: "Asia/Dhaka" }).format(new Date(iso));
}

/** Agent desk: neglect warnings + recalled (locked) leads. Hidden when empty. */
export function MyNeglectNotice() {
  const adminToken = useAdminToken();
  const fn = useServerFn(myNeglect);
  const q = useQuery({ queryKey: ["my-neglect"], queryFn: () => fn({ data: { adminToken } }) });
  const notices = q.data?.notices ?? [];
  const disputes = q.data?.disputes ?? [];
  if (!notices.length && !disputes.length) return null;
  return (
    <section className="card-elevated space-y-3 border-destructive/40 p-4">
      {notices.length > 0 && (
        <div className="space-y-2">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-destructive">
            <AlertTriangle className="size-4" /> অবহেলা সতর্কবার্তা — এই লিডগুলোতে এখনো কল হয়নি
          </h3>
          <p className="text-xs text-muted-foreground">৩ কার্যদিবস সতর্কবার্তার পরও কল না হলে লিড LeadHub-এ ফেরত যাবে এবং আপনার অ্যাকাউন্টে ডিসপুট লেখা হবে।</p>
          <ul className="space-y-1 text-sm">
            {notices.map((n) => (
              <li key={n.id} className="flex justify-between gap-2">
                <span>{(n.lead as Named)?.name ?? "লিড"}</span>
                <span className="text-destructive">সতর্কবার্তা {n.notice_day}/৩</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {disputes.length > 0 && (
        <div className="space-y-2">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-destructive">
            <Lock className="size-4" /> ফেরত নেওয়া লিড (কল লক) ও ডিসপুট
          </h3>
          <ul className="space-y-1 text-sm">
            {disputes.map((d) => (
              <li key={d.id} className="rounded-md border border-destructive/40 bg-destructive/10 p-2">
                <div className="font-medium">{(d.lead as Named)?.name ?? "লিড"} · {fmt(d.recalled_at)}</div>
                <div className="text-xs text-muted-foreground">{d.reason}</div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

/** Executive HQ / IT: every neglect recall with agent and reason. */
export function NeglectDisputePanel() {
  const adminToken = useAdminToken();
  const fn = useServerFn(listNeglectDisputes);
  const q = useQuery({
    queryKey: ["neglect-disputes", adminToken],
    queryFn: () => fn({ data: { adminToken } }),
    enabled: Boolean(adminToken),
  });
  const rows = q.data?.disputes ?? [];
  return (
    <section className="card-elevated space-y-3 p-4">
      <h3 className="text-sm font-semibold">লিড অবহেলা ডিসপুট ({rows.length})</h3>
      {q.isLoading ? (
        <p className="text-xs text-muted-foreground">লোড হচ্ছে…</p>
      ) : rows.length === 0 ? (
        <p className="text-xs text-muted-foreground">এখনো কোনো লিড অবহেলার কারণে ফেরত আসেনি।</p>
      ) : (
        <ul className="table-scroll max-h-96 space-y-2 overflow-y-auto text-sm">
          {rows.map((r) => {
            const agent = r.agent as { name: string | null; employee_id: string | null } | null;
            return (
              <li key={r.id} className="rounded-md border border-destructive/30 p-2">
                <div className="flex flex-wrap justify-between gap-2">
                  <span className="font-medium">{agent?.name ?? "এজেন্ট"} {agent?.employee_id ? `(${agent.employee_id})` : ""}</span>
                  <span className="text-xs text-muted-foreground">{fmt(r.recalled_at)}</span>
                </div>
                <div className="text-xs">লিড: {(r.lead as Named)?.name ?? "—"} · দেওয়া হয়েছিল {fmt(r.assigned_at)}</div>
                <div className="text-xs text-muted-foreground">{r.reason}</div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
