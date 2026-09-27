import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { deckKpis } from "@/lib/lead-pool.functions";
import { useDeckToken as useAdminToken } from "@/lib/local-session";

/** Live Coordinator Deck KPIs — every number comes from the Lead Store. */
export function DeckKpis() {
  const adminToken = useAdminToken();
  const fetchKpis = useServerFn(deckKpis);
  const q = useQuery({
    queryKey: ["deck-kpis", adminToken ? "pin" : "session"],
    queryFn: () => fetchKpis({ data: { adminToken } }),
    refetchInterval: 60_000,
  });
  const k = q.data;
  const tiles: { label: string; value: number | undefined; tone?: "ok" | "warn" | "bad" | undefined; hint?: string | undefined }[] = [
    { label: "Total Head Leads", value: k?.totalStore },
    { label: "Unassigned", value: k?.unassigned, tone: "warn" },
    { label: "Assigned", value: k?.assigned },
    {
      label: "Available to distribute",
      value: k?.readyToday,
      tone: k && k.readyToday < k.neededToday ? "bad" : "ok",
      hint: k ? `আজ পুরো কোটায় দরকার ${k.neededToday}` : undefined,
    },
    { label: "Duplicate", value: k?.duplicate },
    { label: "Invalid", value: k?.invalid, tone: k?.invalid ? "bad" : undefined, hint: "অবণ্টিত সারি" },
    { label: "Today's assigned", value: k?.assignedToday, tone: "ok" },
    { label: "Available Agents", value: k?.availableAgents },
  ];
  const toneClass = { ok: "text-success", warn: "text-warning", bad: "text-destructive" } as const;
  return (
    <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {tiles.map((t) => (
        <div key={t.label} className="card-elevated p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{t.label}</p>
          <p className={`tabular mt-1 text-2xl font-bold ${t.tone ? toneClass[t.tone] : ""}`}>
            {q.isError ? "—" : t.value === undefined ? "…" : t.value.toLocaleString("en-US")}
          </p>
          {t.hint && <p className="mt-0.5 text-[11px] text-muted-foreground">{t.hint}</p>}
        </div>
      ))}
      {q.isError && (
        <p className="col-span-full text-xs text-destructive">সংখ্যা লোড হয়নি: {(q.error as Error).message}</p>
      )}
    </section>
  );
}
