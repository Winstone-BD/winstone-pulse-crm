import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { History } from "lucide-react";
import { useState } from "react";

import { Input } from "@/components/ui/input";
import { getAdminToken } from "@/lib/local-session";
import { bulkExtraHistory } from "@/lib/lead-pool.functions";

/** IT Console: every bulk extra-lead batch with reason, admin and per-agent results. */
export function BulkExtraHistoryPanel() {
  const load = useServerFn(bulkExtraHistory);
  const [q, setQ] = useState("");
  const query = useQuery({
    queryKey: ["bulk-extra-history", q],
    queryFn: () => load({ data: { adminToken: getAdminToken(), q } }),
  });
  const batches = query.data?.batches ?? [];

  return (
    <section className="card-elevated space-y-3 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <History className="size-4 text-primary" />
        <h2 className="text-sm font-semibold">অতিরিক্ত লিড — একসাথে দেওয়ার ইতিহাস</h2>
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="কারণ, এজেন্ট, Employee ID বা তারিখ খুঁজুন"
          className="ml-auto h-9 w-full sm:w-72"
        />
      </div>
      {query.isError && <p className="text-xs text-destructive">{(query.error as Error).message}</p>}
      {query.isPending ? (
        <p className="text-xs text-muted-foreground">লোড হচ্ছে…</p>
      ) : batches.length === 0 ? (
        <p className="text-xs text-muted-foreground">এখনো কোনো রেকর্ড নেই।</p>
      ) : (
        <ul className="space-y-2">
          {batches.map((b) => (
            <li key={b.requestId} className="rounded-lg border border-border p-3 text-xs">
              <div className="flex flex-wrap gap-x-4 gap-y-1">
                <span className="font-semibold">{new Date(b.createdAt).toLocaleString("en-GB", { timeZone: "Asia/Dhaka" })}</span>
                <span>অ্যাডমিন: {b.admin}</span>
                <span>মোট: {b.total}টি · {b.agents.length} জন</span>
              </div>
              <p className="mt-1">কারণ: {b.reason || "—"}</p>
              <ul className="mt-2 grid gap-0.5 sm:grid-cols-2">
                {b.agents.map((a) => (
                  <li key={`${b.requestId}-${a.name}-${a.employeeId}`} className="text-muted-foreground">
                    {a.employeeId ?? ""} {a.name}: {a.moved}টি
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
