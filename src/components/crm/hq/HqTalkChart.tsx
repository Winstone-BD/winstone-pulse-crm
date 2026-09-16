import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export type TalkChartRow = { name: string; connected: number; talkMinutes: number };

/** Per-agent bar chart: connected calls vs total talk minutes. */
export function HqTalkChart({ chartData }: { chartData: TalkChartRow[] }) {
  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold">কথা হওয়া কল ও কথার মিনিট</h2>
          <p className="text-sm text-muted-foreground">প্রতি এজেন্টের সব রেকর্ড করা কাজ</p>
        </div>
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-sm bg-chart-1" /> কথা হওয়া কল
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-sm bg-chart-2" /> কথার মিনিট
          </span>
        </div>
      </div>
      <div className="card-elevated h-64 p-2 sm:h-72 sm:p-4">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData}>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="var(--border)"
              strokeOpacity={0.6}
              vertical={false}
            />
            <XAxis
              dataKey="name"
              stroke="var(--border)"
              tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
              tickLine={false}
            />
            <YAxis
              stroke="var(--border)"
              tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
              tickLine={false}
            />
            <Tooltip
              cursor={{ fill: "var(--surface-2)", fillOpacity: 0.6 }}
              contentStyle={{
                background: "var(--card)",
                border: "1px solid var(--border)",
                borderRadius: 12,
                fontSize: 12,
                color: "var(--foreground)",
                boxShadow: "var(--shadow-card-hover)",
              }}
              labelStyle={{ color: "var(--foreground)", fontWeight: 600 }}
              itemStyle={{ color: "var(--muted-foreground)" }}
            />
            <Bar dataKey="connected" name="কথা হওয়া কল" fill="var(--chart-1)" radius={[6, 6, 0, 0]} />
            <Bar dataKey="talkMinutes" name="কথার মিনিট" fill="var(--chart-2)" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
