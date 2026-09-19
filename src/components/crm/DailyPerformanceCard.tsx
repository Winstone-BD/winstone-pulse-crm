import { useQuery } from "@tanstack/react-query";

import { floorDailyPerformance, myDailyPerformance } from "@/lib/allocation.functions";
import { useAdminToken } from "@/lib/local-session";
import { useMyAccount } from "@/lib/session";

/**
 * Today's real work, counted once on the server.
 *
 * Target and workload are shown apart from actual activity, so a full lead list
 * is never mistaken for a day's calling. Nothing here is counted in the browser,
 * so the phone, this page and Executive HQ always agree.
 */
function Metric({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-border bg-surface px-3 py-2">
      <p className="truncate text-[11px] font-medium text-muted-foreground">{label}</p>
      <p className="tabular text-lg font-semibold">{value}</p>
      {hint ? <p className="truncate text-[11px] text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export function MyPerformanceCard() {
  const adminToken = useAdminToken();
  const { scope } = useMyAccount();
  const query = useQuery({
    queryKey: ["my-daily-performance", adminToken ? "pin" : "session"],
    queryFn: () => myDailyPerformance({ data: { adminToken } }),
    enabled: scope !== "none",
    retry: false,
  });

  const me = query.data?.me;
  if (!me) return null;

  return (
    <section className="card-elevated card-pad section-stack">
      <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 sm:flex sm:justify-between">
        <h2 className="section-title truncate">আজকের আসল কাজ</h2>
        <span className="shrink-0 text-xs text-muted-foreground">ঢাকার সময় অনুযায়ী</span>
      </header>

      <p className="text-xs text-muted-foreground">
        লিড হাতে থাকা আর কাজ করা আলাদা — নিচের সংখ্যাগুলো কেবল বাস্তবে জমা দেওয়া কল রিপোর্ট,
        শেষ হওয়া ফলো-আপ ও নিশ্চিত হওয়া বুকিং থেকে গোনা হয়েছে।
      </p>

      <div className="stat-grid">
        <Metric
          label="কল করা হয়েছে"
          value={`${me.callsAttempted}টি`}
          hint={`লক্ষ্যের ${me.activityPercent}% (লক্ষ্য ${me.target}টি লিড)`}
        />
        <Metric
          label="কথা হয়েছে"
          value={`${me.connectedCalls}টি`}
          hint={`${me.connectRate}% সংযোগ · ${me.talkMinutes} মিনিট`}
        />
        <Metric label="সম্ভাবনাময় লিড" value={`${me.qualifiedLeads}টি`} hint="একই লিড একবারই" />
        <Metric
          label="বুকিং"
          value={`${me.bookings}টি`}
          hint={`${me.conversionRate}% রূপান্তর`}
        />
        <Metric
          label="ফলো-আপ"
          value={`${me.followUpsCompleted}টি শেষ`}
          hint={`${me.followUpsDue}টি আজ বাকি`}
        />
        <Metric
          label="সাইট ভিজিট"
          value={`${me.siteVisitsCompleted}টি সম্পন্ন`}
          hint={`${me.siteVisitsScheduled}টি নির্ধারিত`}
        />
      </div>
    </section>
  );
}

/** The floor's day for coordinators, Executive HQ and the IT Console. */
export function FloorPerformancePanel() {
  const adminToken = useAdminToken();
  const { scope } = useMyAccount();
  const mayRead = scope !== "none" && scope !== "agent";
  const query = useQuery({
    queryKey: ["floor-daily-performance", adminToken ? "pin" : "session"],
    queryFn: () => floorDailyPerformance({ data: { adminToken } }),
    enabled: mayRead,
    retry: false,
  });

  const data = query.data;
  if (!mayRead || !data) return null;
  const t = data.totals;

  return (
    <section className="card-elevated card-pad section-stack">
      <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 sm:flex sm:justify-between">
        <h2 className="section-title truncate">আজকের আসল কাজ — সব ডেস্ক</h2>
        <span className="shrink-0 text-xs text-muted-foreground">
          {t.callsAttempted}টি কল · {t.bookings}টি বুকিং
        </span>
      </header>

      <p className="text-xs text-muted-foreground">
        প্রতিটি সংখ্যা জমা দেওয়া রেকর্ড থেকে, ঢাকার দিনের হিসাবে। লিড হাতবদল হলেও কাজ দুইবার গোনা
        হয় না। হিসাবের ভিত্তি: {data.sources.submittedReports}টি জমা রিপোর্ট
        {data.sources.unsubmittedReports > 0
          ? ` (${data.sources.unsubmittedReports}টি অসম্পূর্ণ বাদ)`
          : ""}
        , {data.sources.followUpRows}টি ফলো-আপ রেকর্ড।
      </p>

      <div className="table-scroll">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="text-xs text-muted-foreground">
            <tr className="border-b border-border">
              <th className="px-2 py-2 text-left font-medium">ডেস্ক</th>
              <th className="px-2 py-2 text-right font-medium">লক্ষ্য</th>
              <th className="px-2 py-2 text-right font-medium">কল</th>
              <th className="px-2 py-2 text-right font-medium">কথা</th>
              <th className="px-2 py-2 text-right font-medium">সম্ভাবনাময়</th>
              <th className="px-2 py-2 text-right font-medium">ফলো-আপ</th>
              <th className="px-2 py-2 text-right font-medium">ভিজিট</th>
              <th className="px-2 py-2 text-right font-medium">বুকিং</th>
              <th className="px-2 py-2 text-right font-medium">অতিরিক্ত</th>
            </tr>
          </thead>
          <tbody>
            {data.rows.map((row) => (
              <tr key={row.agentId} className="border-b border-border/60 last:border-0">
                <td className="max-w-[170px] truncate px-2 py-2 font-medium">{row.name}</td>
                <td className="tabular px-2 py-2 text-right">{row.target}</td>
                <td className="tabular px-2 py-2 text-right font-semibold">{row.callsAttempted}</td>
                <td className="tabular px-2 py-2 text-right">{row.connectedCalls}</td>
                <td className="tabular px-2 py-2 text-right">{row.qualifiedLeads}</td>
                <td className="tabular px-2 py-2 text-right">{row.followUpsCompleted}</td>
                <td className="tabular px-2 py-2 text-right">{row.siteVisitsCompleted}</td>
                <td className="tabular px-2 py-2 text-right">{row.bookings}</td>
                <td className="tabular px-2 py-2 text-right">
                  {row.excessPending > 0 ? (
                    <span className="font-semibold text-warning">{row.excessPending}</span>
                  ) : (
                    "0"
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-muted-foreground">
        মোট: লক্ষ্য {t.target}টি · কল {t.callsAttempted}টি · কথা {t.connectedCalls}টি (
        {t.connectRate}%) · সম্ভাবনাময় {t.qualifiedLeads}টি · বুকিং {t.bookings}টি (
        {t.conversionRate}%) · অতিরিক্ত পেন্ডিং {t.excessPending}টি
      </p>
    </section>
  );
}
