import { CheckCircle2, Trophy } from "lucide-react";

import type { AgentStats } from "@/lib/crm-data";
import { formatDuration, formatTalkTime } from "@/lib/crm-format";

export function Leaderboard({
  stats,
  onSelectAgent,
}: {
  stats: AgentStats[];
  onSelectAgent?: (agentId: string) => void;
}) {
  const maxConnected = Math.max(1, ...stats.map((s) => s.connected));

  return (
    <section className="space-y-3">
      <div className="flex items-end justify-between">
        <div>
          <h2 className="text-lg font-semibold">দৈনিক পারফরম্যান্স লিডারবোর্ড</h2>
          <p className="text-sm text-muted-foreground">১০ সেকেন্ডের বেশি কথা হলে কলটি গণনা হয়</p>
        </div>
        <Trophy className="size-5 text-idle" />
      </div>

      <ol className="space-y-2 md:hidden">
        {stats.map((row, index) => (
          <li key={row.profile.id}>
            <button type="button" disabled={!onSelectAgent} onClick={() => onSelectAgent?.(row.profile.id)} className="card-elevated w-full p-3 text-left disabled:cursor-default">
              <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2"><span className="tabular text-muted-foreground">#{index + 1}</span><span className="truncate font-semibold">{row.profile.name}</span><span className="tabular font-bold">{row.conversionRate.toFixed(0)}%</span></div>
              <dl className="mt-3 grid grid-cols-3 gap-2 text-center text-xs"><div><dt className="text-muted-foreground">মোট কল</dt><dd className="tabular font-semibold">{row.dials}</dd></div><div><dt className="text-muted-foreground">কথা হয়েছে</dt><dd className="tabular font-semibold">{row.connected}</dd></div><div><dt className="text-muted-foreground">কথার সময়</dt><dd className="tabular font-semibold">{formatTalkTime(row.talkSeconds)}</dd></div></dl>
            </button>
          </li>
        ))}
      </ol>

      <div className="hidden overflow-hidden card-elevated md:block">
        <div className="table-scroll">
          <table className="w-full min-w-[860px] text-sm">
            <thead className="bg-surface-2 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">#</th>
                <th className="px-4 py-3 font-medium">এজেন্ট</th>
                <th className="px-4 py-3 text-right font-medium">মোট কল</th>
                <th className="px-4 py-3 text-right font-medium">কথা হয়েছে</th>
                <th className="px-4 py-3 text-right font-medium">কথার সময়</th>
                <th className="px-4 py-3 text-right font-medium">গড় কল</th>
                <th className="px-4 py-3 text-right font-medium">হোয়াটসঅ্যাপ</th>
                <th className="px-4 py-3 text-right font-medium">রূপান্তর</th>
                <th className="px-4 py-3 text-right font-medium">সিঙ্ক হওয়া অডিও</th>
              </tr>
            </thead>
            <tbody className="zebra">
              {stats.map((row, index) => (
                <tr
                  key={row.profile.id}
                  onClick={() => onSelectAgent?.(row.profile.id)}
                  className={
                    onSelectAgent
                      ? "cursor-pointer border-t border-border transition-colors"
                      : "border-t border-border"
                  }
                >
                  <td className="tabular px-4 py-3 text-muted-foreground">{index + 1}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span
                        className="size-2 rounded-full"
                        style={{ backgroundColor: `oklch(0.75 0.14 ${row.profile.avatar_hue})` }}
                      />
                      <span className="font-medium">{row.profile.name}</span>
                    </div>
                  </td>
                  <td className="tabular px-4 py-3 text-right">{row.dials}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <span className="hidden h-1.5 w-20 overflow-hidden rounded-full bg-surface-2 sm:block">
                        <span
                          className="block h-full rounded-full bg-chart-1"
                          style={{ width: `${(row.connected / maxConnected) * 100}%` }}
                        />
                      </span>
                      <span className="tabular font-semibold">{row.connected}</span>
                    </div>
                  </td>
                  <td className="tabular px-4 py-3 text-right">
                    {formatTalkTime(row.talkSeconds)}
                  </td>
                  <td className="tabular px-4 py-3 text-right">
                    {row.avgCallSeconds ? formatDuration(row.avgCallSeconds) : "--:--"}
                  </td>
                  <td className="tabular px-4 py-3 text-right">{row.whatsappTouches}</td>
                  <td className="tabular px-4 py-3 text-right">
                    <span className={row.conversionRate >= 25 ? "text-live" : undefined}>
                      {row.conversionRate.toFixed(0)}%
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="tabular inline-flex items-center gap-1.5">
                      <CheckCircle2 className="size-3.5 text-verified" />
                      {row.syncedAudio}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
