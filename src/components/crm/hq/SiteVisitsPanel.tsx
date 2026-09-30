import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import type { Lead } from "@/lib/crm-data";
import { useAdminToken } from "@/lib/local-session";
import { createSiteVisit, listSiteVisits, setSiteVisitStatus, SITE_VISIT_STATUSES } from "@/lib/site-visits.functions";

const LABEL: Record<string, string> = { scheduled: "নির্ধারিত", completed: "সম্পন্ন", cancelled: "বাতিল", no_show: "আসেননি" };
const TONE: Record<string, string> = { scheduled: "text-primary", completed: "text-foreground", cancelled: "text-muted-foreground", no_show: "text-destructive" };
const when = (iso: string) => new Date(iso).toLocaleString("bn-BD", { timeZone: "Asia/Dhaka", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
const dhakaDay = (iso: string) => new Date(new Date(iso).getTime() + 6 * 3600_000).toISOString().slice(0, 10);

export function SiteVisitsPanel({ leads, fromDay, toDay, agentId }: { leads: Lead[]; fromDay: string; toDay: string; agentId: string | null }) {
  const adminToken = useAdminToken();
  const qc = useQueryClient();
  const list = useServerFn(listSiteVisits);
  const create = useServerFn(createSiteVisit);
  const setStatus = useServerFn(setSiteVisitStatus);
  const visits = useQuery({ queryKey: ["site-visits", adminToken], queryFn: () => list({ data: { adminToken } }), refetchInterval: 60_000 });
  const refresh = () => qc.invalidateQueries({ queryKey: ["site-visits"] });

  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [leadId, setLeadId] = useState("");
  const [at, setAt] = useState("");
  const [project, setProject] = useState("");

  const leadById = useMemo(() => new Map(leads.map((l) => [l.id, l])), [leads]);
  const matches = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (s.length < 2) return [];
    return leads.filter((l) => l.name?.toLowerCase().includes(s) || l.phone_number?.includes(s)).slice(0, 8);
  }, [leads, search]);

  const rows = (visits.data ?? []).filter((v) => {
    const d = dhakaDay(v.visit_at);
    return d >= fromDay && d <= toDay && (!agentId || v.agent_id === agentId);
  });
  const counts = Object.fromEntries(SITE_VISIT_STATUSES.map((s) => [s, rows.filter((r) => r.status === s).length]));
  const done = counts["completed"] ?? 0;
  const closed = done + (counts["no_show"] ?? 0);

  const add = useMutation({
    mutationFn: () => create({ data: { adminToken, leadId, visitAt: new Date(`${at}:00+06:00`).toISOString(), project: project || null } }),
    onSuccess: () => { toast.success("সাইট ভিজিট যোগ হয়েছে"); setOpen(false); setLeadId(""); setSearch(""); setAt(""); setProject(""); refresh(); },
    onError: (e) => toast.error((e as Error).message),
  });
  const change = useMutation({
    mutationFn: (v: { id: string; status: (typeof SITE_VISIT_STATUSES)[number] }) => setStatus({ data: { adminToken, ...v } }),
    onSuccess: refresh,
    onError: (e) => toast.error((e as Error).message),
  });

  const field = "h-9 w-full min-w-0 rounded-lg border border-border bg-background px-2.5 text-xs";

  return (
    <section className="card-elevated min-w-0 p-4 sm:p-5">
      <header className="mb-3 flex items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold tracking-tight">সাইট ভিজিট রেকর্ড</h3>
          <p className="text-[11px] text-muted-foreground">লিডের সাথে যুক্ত আসল ভিজিট — তারিখ ও অবস্থাসহ (নির্বাচিত সময়, ঢাকা)</p>
        </div>
        <button type="button" onClick={() => setOpen((o) => !o)} className="shrink-0 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground">
          {open ? "বন্ধ" : "+ ভিজিট"}
        </button>
      </header>

      {open && (
        <form className="mb-4 grid gap-2 rounded-xl border border-border p-3 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); if (leadId && at) add.mutate(); }}>
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
          <input aria-label="ভিজিটের সময়" type="datetime-local" className={field} value={at} onChange={(e) => setAt(e.target.value)} required />
          <input aria-label="প্রজেক্ট" className={field} placeholder="প্রজেক্ট (ঐচ্ছিক)" value={project} onChange={(e) => setProject(e.target.value)} />
          <button type="submit" disabled={!leadId || !at || add.isPending} className="rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-50 sm:col-span-2">
            {add.isPending ? "সংরক্ষণ হচ্ছে…" : "সংরক্ষণ করুন"}
          </button>
        </form>
      )}

      <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {SITE_VISIT_STATUSES.map((s) => (
          <div key={s} className="rounded-xl border border-border p-2.5">
            <span className="block text-[11px] text-muted-foreground">{LABEL[s]}</span>
            <span className={`tabular block text-lg font-bold ${TONE[s]}`}>{counts[s] ?? 0}</span>
          </div>
        ))}
      </div>
      <p className="mb-3 text-[11px] text-muted-foreground">উপস্থিতির হার: {closed ? `${Math.round((done / closed) * 100)}%` : "—"} (সম্পন্ন ÷ সম্পন্ন + আসেননি)</p>

      {visits.isPending ? <p className="text-xs text-muted-foreground">লোড হচ্ছে…</p>
        : visits.error ? <p className="text-xs text-destructive">সাইট ভিজিট লোড হয়নি।</p>
        : rows.length === 0 ? <p className="rounded-xl border border-dashed border-border p-6 text-center text-xs text-muted-foreground">এই সময়ে কোনো সাইট ভিজিট রেকর্ড নেই।</p>
        : (
          <ul className="max-h-80 space-y-2 overflow-y-auto pr-1">
            {rows.map((v) => (
              <li key={v.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border p-2.5 text-xs">
                <span className="min-w-0">
                  <span className="block truncate font-semibold">{leadById.get(v.lead_id)?.name ?? "লিড"}</span>
                  <span className="text-muted-foreground">{when(v.visit_at)}{v.project ? ` · ${v.project}` : ""}</span>
                </span>
                <select aria-label="অবস্থা" className="h-8 rounded-lg border border-border bg-background px-2 text-xs" value={v.status}
                  disabled={change.isPending} onChange={(e) => change.mutate({ id: v.id, status: e.target.value as (typeof SITE_VISIT_STATUSES)[number] })}>
                  {SITE_VISIT_STATUSES.map((s) => <option key={s} value={s}>{LABEL[s]}</option>)}
                </select>
              </li>
            ))}
          </ul>
        )}
    </section>
  );
}
