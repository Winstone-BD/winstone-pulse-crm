import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { importHistory } from "@/lib/lead-pool.functions";
import { useDeckToken as useAdminToken } from "@/lib/local-session";

export function ImportHistoryPanel() {
  const adminToken = useAdminToken();
  const fetchHistory = useServerFn(importHistory);
  const q = useQuery({
    queryKey: ["import-history", adminToken ? "pin" : "session"],
    queryFn: () => fetchHistory({ data: { adminToken } }),
  });
  return (
    <section className="card-elevated p-4">
      <h2 className="text-sm font-semibold">Import history</h2>
      <p className="text-xs text-muted-foreground">প্রতিটি ব্যাচ হেড লিড স্টোরে UNASSIGNED হিসেবে ঢোকে।</p>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[560px] text-sm">
          <thead className="text-xs uppercase text-muted-foreground">
            <tr>
              <th className="py-2 text-left">তারিখ</th>
              <th className="py-2 text-left">কে</th>
              <th className="py-2 text-right">আসা সারি</th>
              <th className="py-2 text-right">Imported</th>
              <th className="py-2 text-right">Duplicate/Invalid</th>
              <th className="py-2 text-right">আগে কাজ হয়েছে</th>
            </tr>
          </thead>
          <tbody>
            {(q.data ?? []).map((r) => (
              <tr key={r.id} className="border-t border-border/70">
                <td className="py-2">{new Date(r.createdAt).toLocaleString("en-GB", { timeZone: "Asia/Dhaka" })}</td>
                <td className="py-2">{r.actor ?? "—"}</td>
                <td className="tabular py-2 text-right">{r.incoming}</td>
                <td className="tabular py-2 text-right text-success">{r.imported}</td>
                <td className="tabular py-2 text-right text-destructive">{r.duplicates}</td>
                <td className="tabular py-2 text-right">{r.alreadyWorked}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {q.isPending && <p className="py-3 text-xs text-muted-foreground">লোড হচ্ছে…</p>}
        {q.data?.length === 0 && <p className="py-3 text-xs text-muted-foreground">এখনো কোনো ইমপোর্ট নেই।</p>}
      </div>
    </section>
  );
}
