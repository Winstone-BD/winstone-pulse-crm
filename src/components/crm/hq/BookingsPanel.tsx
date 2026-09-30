import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import type { Lead } from "@/lib/crm-data";
import { useAdminToken } from "@/lib/local-session";
import { BOOKING_STATUSES, createBooking, listBookings, setBookingStatus } from "@/lib/bookings.functions";

const LABEL: Record<string, string> = { booked: "বুকড", completed: "সম্পন্ন", cancelled: "বাতিল" };
const TONE: Record<string, string> = { booked: "text-primary", completed: "text-foreground", cancelled: "text-muted-foreground" };
const when = (iso: string) => new Date(iso).toLocaleString("bn-BD", { timeZone: "Asia/Dhaka", day: "numeric", month: "short", year: "numeric" });
const dhakaDay = (iso: string) => new Date(new Date(iso).getTime() + 6 * 3600_000).toISOString().slice(0, 10);
const usd = (n: number) => `$${n.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;

export function useBookings() {
  const adminToken = useAdminToken();
  const list = useServerFn(listBookings);
  return useQuery({ queryKey: ["bookings", adminToken], queryFn: () => list({ data: { adminToken } }), refetchInterval: 60_000 });
}

export function BookingsPanel({ leads, fromDay, toDay, agentId = null }: { leads: Lead[]; fromDay?: string; toDay?: string; agentId?: string | null }) {
  const adminToken = useAdminToken();
  const qc = useQueryClient();
  const create = useServerFn(createBooking);
  const setStatus = useServerFn(setBookingStatus);
  const bookings = useBookings();
  const refresh = () => qc.invalidateQueries({ queryKey: ["bookings"] });

  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [leadId, setLeadId] = useState("");
  const [at, setAt] = useState("");
  const [project, setProject] = useState("");
  const [area, setArea] = useState("");
  const [amount, setAmount] = useState("");

  const leadById = useMemo(() => new Map(leads.map((l) => [l.id, l])), [leads]);
  const matches = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (s.length < 2) return [];
    return leads.filter((l) => l.name?.toLowerCase().includes(s) || l.phone_number?.includes(s)).slice(0, 8);
  }, [leads, search]);

  const rows = (bookings.data ?? []).filter((b) => {
    const d = dhakaDay(b.booked_at);
    return (!fromDay || d >= fromDay) && (!toDay || d <= toDay) && (!agentId || b.agent_id === agentId);
  });
  const active = rows.filter((r) => r.status !== "cancelled");
  const revenue = active.reduce((s, r) => s + (r.amount_usd ?? 0), 0);
  const withAmount = active.filter((r) => r.amount_usd != null).length;
  const counts = Object.fromEntries(BOOKING_STATUSES.map((s) => [s, rows.filter((r) => r.status === s).length]));

  const add = useMutation({
    mutationFn: () =>
      create({
        data: {
          adminToken,
          leadId,
          bookedAt: at ? new Date(`${at}:00+06:00`).toISOString() : undefined,
          project: project || null,
          area: area || null,
          amountUsd: amount ? Number(amount) : null,
        },
      }),
    onSuccess: () => { toast.success("বুকিং যোগ হয়েছে"); setOpen(false); setLeadId(""); setSearch(""); setAt(""); setProject(""); setArea(""); setAmount(""); refresh(); },
    onError: (e) => toast.error((e as Error).message),
  });
  const change = useMutation({
    mutationFn: (v: { id: string; status: (typeof BOOKING_STATUSES)[number] }) => setStatus({ data: { adminToken, ...v } }),
    onSuccess: refresh,
    onError: (e) => toast.error((e as Error).message),
  });

  const field = "h-9 w-full min-w-0 rounded-lg border border-border bg-background px-2.5 text-xs";

  return (
    <section className="card-elevated min-w-0 p-4 sm:p-5">
      <header className="mb-3 flex items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold tracking-tight">বুকিং ও রেভেনিউ</h3>
          <p className="text-[11px] text-muted-foreground">লিডের সাথে যুক্ত আসল বুকিং — পরিমাণ শুধু USD-তে, কোনো অনুমান নয়</p>
        </div>
        <button type="button" onClick={() => setOpen((o) => !o)} className="shrink-0 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground">
          {open ? "বন্ধ" : "+ বুকিং"}
        </button>
      </header>

      {open && (
        <form className="mb-4 grid gap-2 rounded-xl border border-border p-3 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); if (leadId) add.mutate(); }}>
          <div className="sm:col-span-2">
            <input aria-label="লিড খুঁজুন" className={field} placeholder="লিডের নাম বা ফোন লিখুন" value={leadId ? (leadById.get(leadId)?.name ?? "") : search}
              onChange={(e) => { setLeadId(""); setSearch(e.target.value); }} />
            {!leadId && matches.length > 0 && (
              <ul className="mt-1 max-h-40 overflow-y-auto rounded-lg border border-border">
                {matches.map((l) => (
                  <li key={l.id}><button type="button" className="w-full px-2.5 py-1.5 text-left text-xs hover:bg-muted" onClick={() => setLeadId(l.id)}>{l.name} · {l.phone_number}</button></li>
                ))}
              </ul>
            )}
          </div>
          <input aria-label="বুকিংয়ের তারিখ" type="datetime-local" className={field} value={at} onChange={(e) => setAt(e.target.value)} />
          <input aria-label="প্রজেক্ট" className={field} placeholder="প্রজেক্ট (ঐচ্ছিক)" value={project} onChange={(e) => setProject(e.target.value)} />
          <input aria-label="এলাকা" className={field} placeholder="এলাকা (যেমন উত্তরা)" value={area} onChange={(e) => setArea(e.target.value)} />
          <input aria-label="পরিমাণ (USD)" type="number" min="0" step="0.01" className={field} placeholder="পরিমাণ USD (ঐচ্ছিক)" value={amount} onChange={(e) => setAmount(e.target.value)} />
          <button type="submit" disabled={!leadId || add.isPending} className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-50 sm:col-span-2">
            {add.isPending ? "সংরক্ষণ হচ্ছে…" : "বুকিং সংরক্ষণ"}
          </button>
        </form>
      )}

      <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div className="rounded-xl border border-border p-2.5">
          <p className="text-[10px] text-muted-foreground">মোট বুকিং</p>
          <p className="text-lg font-bold tabular-nums">{active.length}</p>
        </div>
        <div className="rounded-xl border border-border p-2.5">
          <p className="text-[10px] text-muted-foreground">রেভেনিউ (USD)</p>
          <p className="text-lg font-bold tabular-nums">{withAmount ? usd(revenue) : "—"}</p>
          {withAmount > 0 && withAmount < active.length && <p className="text-[10px] text-muted-foreground">{withAmount}/{active.length} বুকিংয়ে পরিমাণ আছে</p>}
        </div>
        {BOOKING_STATUSES.map((s) => (
          <div key={s} className="rounded-xl border border-border p-2.5">
            <p className="text-[10px] text-muted-foreground">{LABEL[s]}</p>
            <p className={`text-lg font-bold tabular-nums ${TONE[s]}`}>{counts[s] ?? 0}</p>
          </div>
        ))}
      </div>

      {rows.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border p-4 text-center text-xs text-muted-foreground">এই সময়ে কোনো বুকিং রেকর্ড নেই</p>
      ) : (
        <ul className="divide-y divide-border">
          {rows.slice(0, 20).map((b) => (
            <li key={b.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-xs">
              <div className="min-w-0">
                <p className="truncate font-medium">{leadById.get(b.lead_id)?.name ?? "লিড"}{b.project ? ` · ${b.project}` : ""}{b.area ? ` · ${b.area}` : ""}</p>
                <p className="text-[10px] text-muted-foreground">{when(b.booked_at)}{b.amount_usd != null ? ` · ${usd(b.amount_usd)}` : ""}</p>
              </div>
              <select aria-label="বুকিং অবস্থা" className="h-8 rounded-lg border border-border bg-background px-2 text-xs" value={b.status}
                onChange={(e) => change.mutate({ id: b.id, status: e.target.value as (typeof BOOKING_STATUSES)[number] })}>
                {BOOKING_STATUSES.map((s) => <option key={s} value={s}>{LABEL[s]}</option>)}
              </select>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
