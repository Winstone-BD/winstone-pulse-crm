import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo } from "react";

import { useBookings } from "@/components/crm/hq/BookingsPanel";
import { useSiteVisits } from "@/components/crm/hq/SiteVisitsPanel";
import { listPitchLeads } from "@/lib/bookings.functions";
import type { CcReport } from "@/lib/command-center";
import type { Lead } from "@/lib/crm-data";
import { useAdminToken } from "@/lib/local-session";

const dhakaDay = (iso: string) => new Date(new Date(iso).getTime() + 6 * 3600_000).toISOString().slice(0, 10);
const usd = (n: number) => `$${n.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;

type F = { fromDay: string; toDay: string; agentId: string | null };

/**
 * Read-only. Market Pulse = saved lead areas + saved booking amounts (USD) per area.
 * Pitch → Booking funnel = distinct leads at each step from real records only.
 */
export function MarketPulseFunnel({ leads, reports, filters, onDrill }: { leads: Lead[]; reports: CcReport[]; filters: F; onDrill: (title: string, leadIds: string[]) => void }) {
  const adminToken = useAdminToken();
  const listPitches = useServerFn(listPitchLeads);
  const pitches = useQuery({ queryKey: ["pitch-leads", adminToken], queryFn: () => listPitches({ data: { adminToken } }), refetchInterval: 120_000 });
  const bookings = useBookings();
  const visits = useSiteVisits();

  const inF = (iso: string, agent: string | null) => {
    const d = dhakaDay(iso);
    return d >= filters.fromDay && d <= filters.toDay && (!filters.agentId || agent === filters.agentId);
  };

  const pulse = useMemo(() => {
    const m = new Map<string, { leads: string[]; bookings: number; amount: number; priced: number }>();
    const get = (a: string) => m.get(a) ?? (m.set(a, { leads: [], bookings: 0, amount: 0, priced: 0 }), m.get(a)!);
    for (const l of leads) {
      const a = l.area?.trim();
      if (a && (!filters.agentId || l.assigned_agent_id === filters.agentId)) get(a).leads.push(l.id);
    }
    for (const b of bookings.data ?? []) {
      const a = b.area?.trim();
      if (!a || b.status === "cancelled" || !inF(b.booked_at, b.agent_id)) continue;
      const r = get(a);
      r.bookings += 1;
      if (b.amount_usd != null) { r.amount += b.amount_usd; r.priced += 1; }
    }
    return [...m.entries()].map(([area, v]) => ({ area, ...v })).sort((x, y) => y.leads.length + y.bookings * 10 - (x.leads.length + x.bookings * 10)).slice(0, 8);
  }, [leads, bookings.data, filters.fromDay, filters.toDay, filters.agentId]);

  const funnel = useMemo(() => {
    const set = (ids: Iterable<string | null>) => new Set([...ids].filter(Boolean) as string[]);
    const rep = reports.filter((r) => r.lead_id && inF(r.submitted_at ?? r.created_at, r.agent_id));
    const called = set(rep.map((r) => r.lead_id));
    const pitched = set((pitches.data ?? []).filter((p) => inF(p.created_at, p.agent_id)).map((p) => p.lead_id));
    const responded = set(rep.filter((r) => r.customer_response).map((r) => r.lead_id));
    const follow = set(rep.filter((r) => r.next_action === "follow_up" || r.category === "follow_up").map((r) => r.lead_id));
    const visited = set((visits.data ?? []).filter((v) => v.status !== "cancelled" && inF(v.visit_at, v.agent_id)).map((v) => v.lead_id));
    const booked = set((bookings.data ?? []).filter((b) => b.status !== "cancelled" && inF(b.booked_at, b.agent_id)).map((b) => b.lead_id));
    return [
      { label: "কল হয়েছে (রিপোর্ট)", ids: [...called] },
      { label: "পিচ ব্যবহার", ids: [...pitched] },
      { label: "গ্রাহক উত্তর দিয়েছেন", ids: [...responded] },
      { label: "ফলো-আপ", ids: [...follow] },
      { label: "সাইট ভিজিট", ids: [...visited] },
      { label: "বুকিং", ids: [...booked] },
    ];
  }, [reports, pitches.data, visits.data, bookings.data, filters.fromDay, filters.toDay, filters.agentId]);

  const loading = pitches.isLoading || bookings.isLoading || visits.isLoading;
  const top = Math.max(1, ...funnel.map((s) => s.ids.length));

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <section className="rounded-xl border border-border bg-card p-4">
        <h3 className="text-sm font-semibold">মার্কেট পালস — এলাকা অনুযায়ী</h3>
        <p className="mb-3 text-[11px] text-muted-foreground">শুধু সংরক্ষিত এলাকা ও বুকিংয়ের আসল USD পরিমাণ থেকে · কোনো অনুমান নয়</p>
        {loading ? (
          <p className="text-xs text-muted-foreground">লোড হচ্ছে…</p>
        ) : pulse.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
            এখনো কোনো এলাকার তথ্য সংরক্ষিত হয়নি। বুকিং যোগ করার সময় এলাকা লিখলে এখানে চাহিদা ও দাম দেখা যাবে।
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="text-muted-foreground">
                <tr className="text-left"><th className="py-1 pr-2">এলাকা</th><th className="py-1 pr-2 text-right">লিড</th><th className="py-1 pr-2 text-right">বুকিং</th><th className="py-1 text-right">গড় বুকিং মূল্য</th></tr>
              </thead>
              <tbody>
                {pulse.map((p) => (
                  <tr key={p.area} className="border-t border-border">
                    <td className="py-1.5 pr-2">
                      <button type="button" className="text-left font-medium hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" onClick={() => onDrill(`এলাকা: ${p.area}`, p.leads)} disabled={!p.leads.length}>{p.area}</button>
                    </td>
                    <td className="py-1.5 pr-2 text-right tabular-nums">{p.leads.length}</td>
                    <td className="py-1.5 pr-2 text-right tabular-nums">{p.bookings}</td>
                    <td className="py-1.5 text-right tabular-nums">{p.priced ? usd(p.amount / p.priced) : <span className="text-muted-foreground">তথ্য নেই</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="rounded-xl border border-border bg-card p-4">
        <h3 className="text-sm font-semibold">পিচ → বুকিং ফানেল</h3>
        <p className="mb-3 text-[11px] text-muted-foreground">প্রতিটি ধাপে আলাদা লিড সংখ্যা · রিপোর্ট, পিচ, সাইট ভিজিট ও বুকিং রেকর্ড থেকে (বাতিল বাদে)</p>
        {loading ? (
          <p className="text-xs text-muted-foreground">লোড হচ্ছে…</p>
        ) : funnel.every((s) => s.ids.length === 0) ? (
          <div className="rounded-lg border border-dashed border-border p-4 text-center text-xs text-muted-foreground">এই সময়ে কোনো রেকর্ড নেই।</div>
        ) : (
          <ul className="space-y-2">
            {funnel.map((s, i) => {
              const prev = i > 0 ? funnel[i - 1]!.ids.length : 0;
              const conv = i > 0 && prev > 0 ? Math.round((s.ids.length / prev) * 100) : null;
              return (
                <li key={s.label}>
                  <button type="button" disabled={!s.ids.length} onClick={() => onDrill(s.label, s.ids)} className="w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded">
                    <div className="flex justify-between text-xs"><span>{s.label}</span><span className="tabular-nums">{s.ids.length}{conv != null && <span className="ml-2 text-muted-foreground">{conv}%</span>}</span></div>
                    <div className="mt-1 h-2 rounded bg-muted"><div className="h-2 rounded bg-primary" style={{ width: `${(s.ids.length / top) * 100}%` }} /></div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        {!loading && funnel[1]!.ids.length === 0 && <p className="mt-2 text-[11px] text-muted-foreground">এখনো কোনো পিচ রেকর্ড হয়নি — Sales Intelligence থেকে পিচ ব্যবহার করলে এই ধাপ পূরণ হবে।</p>}
      </section>
    </div>
  );
}
