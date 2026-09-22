import { Clock, PhoneCall, Trophy } from "lucide-react";

import type { AgentStats } from "@/lib/crm-data";

const MEDAL = ["var(--exec-gold)", "var(--exec-blue)", "var(--exec-emerald)"];

function minutes(seconds: number) {
  return `${Math.round(seconds / 60).toLocaleString("bn-BD")} মি`;
}

/** Investor-style "Top Performer" hero plus the ranked agent leaderboard table. */
export function TopPerformerBoard({
  stats,
  onSelectAgent,
}: {
  stats: AgentStats[];
  onSelectAgent?: (agentId: string) => void;
}) {
  const top = stats[0];
  const rows = stats.slice(0, 8);

  return (
    <section className="grid gap-3 xl:grid-cols-3">
      <div
        className="card-elevated relative overflow-hidden p-5 xl:col-span-1"
        style={{
          borderColor: "color-mix(in oklab, var(--exec-gold) 42%, transparent)",
          background:
            "linear-gradient(155deg, color-mix(in oklab, var(--exec-gold) 16%, var(--card)) 0%, var(--card) 65%)",
        }}
      >
        <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">
          <Trophy className="size-4" /> Top Performer
        </p>
        {top ? (
          <button
            type="button"
            onClick={() => onSelectAgent?.(top.profile.id)}
            className="mt-2 w-full text-left"
          >
            <p className="truncate text-2xl font-bold">{top.profile.name}</p>
            <p className="text-[11px] text-muted-foreground">
              {top.profile.employee_id ?? "এজেন্ট"} · সর্বোচ্চ কথা বলা এজেন্ট
            </p>
            <dl className="mt-4 grid grid-cols-2 gap-3">
              <HeroStat label="কল" value={top.dials.toLocaleString("bn-BD")} />
              <HeroStat label="কথা হয়েছে" value={top.connected.toLocaleString("bn-BD")} />
              <HeroStat label="টক টাইম" value={minutes(top.talkSeconds)} />
              <HeroStat
                label="রূপান্তর"
                value={`${(Math.round(top.conversionRate * 10) / 10).toLocaleString("bn-BD")}%`}
              />
            </dl>
          </button>
        ) : (
          <p className="mt-3 text-[12px] text-muted-foreground">এখনো কোনো এজেন্ট ডেটা নেই।</p>
        )}
      </div>

      <div className="card-elevated p-4 xl:col-span-2">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold">লিডারবোর্ড</h3>
          <span className="text-[11px] text-muted-foreground">কথা বলার ভিত্তিতে র‍্যাঙ্ক</span>
        </div>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[430px] text-left text-[12px]">
            <thead>
              <tr className="text-[10px] uppercase tracking-wide text-muted-foreground">
                <th className="pb-2 pr-2 font-medium">র‍্যাঙ্ক</th>
                <th className="pb-2 pr-2 font-medium">এজেন্ট</th>
                <th className="pb-2 pr-2 text-right font-medium">কল</th>
                <th className="pb-2 pr-2 text-right font-medium">কথা</th>
                <th className="pb-2 text-right font-medium">মিনিট</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr
                  key={row.profile.id}
                  className="border-t border-border/60 transition-colors hover:bg-surface"
                >
                  <td className="py-2 pr-2">
                    <span
                      className="tabular grid size-6 place-items-center rounded-full text-[11px] font-bold"
                      style={{
                        background: `color-mix(in oklab, ${MEDAL[i] ?? "var(--muted-foreground)"} 20%, transparent)`,
                        color: MEDAL[i] ?? "var(--muted-foreground)",
                      }}
                    >
                      {i + 1}
                    </span>
                  </td>
                  <td className="max-w-[170px] truncate py-2 pr-2">
                    <button
                      type="button"
                      onClick={() => onSelectAgent?.(row.profile.id)}
                      className="truncate font-semibold hover:text-primary"
                    >
                      {row.profile.name}
                    </button>
                  </td>
                  <td className="tabular py-2 pr-2 text-right">
                    <span className="inline-flex items-center gap-1">
                      <PhoneCall className="size-3 text-muted-foreground" />
                      {row.dials.toLocaleString("bn-BD")}
                    </span>
                  </td>
                  <td
                    className="tabular py-2 pr-2 text-right font-semibold"
                    style={{ color: "var(--exec-emerald)" }}
                  >
                    {row.connected.toLocaleString("bn-BD")}
                  </td>
                  <td className="tabular py-2 text-right">
                    <span className="inline-flex items-center gap-1">
                      <Clock className="size-3 text-muted-foreground" />
                      {minutes(row.talkSeconds)}
                    </span>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-3 text-[11px] text-muted-foreground">
                    এখনো কোনো এজেন্ট নেই।
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

function HeroStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="tabular text-lg font-bold">{value}</dd>
    </div>
  );
}
