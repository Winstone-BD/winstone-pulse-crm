import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { BellRing } from "lucide-react";

import { useSnapshot, type Lead } from "@/lib/crm-data";
import { useAdminToken } from "@/lib/local-session";
import { addSiteVisitToTeamCalendar, createSiteVisit, listSiteVisits, setSiteVisitStatus, SITE_VISIT_STATUSES } from "@/lib/site-visits.functions";

export const VISIT_LABEL: Record<string, string> = { scheduled: "নির্ধারিত", confirmed: "কনফার্মড", completed: "সম্পন্ন", offer_made: "অফার দেওয়া", cancelled: "বাতিল", no_show: "আসেননি" };
const TONE: Record<string, string> = { scheduled: "text-primary", confirmed: "text-primary", offer_made: "text-success", completed: "text-foreground", cancelled: "text-muted-foreground", no_show: "text-destructive" };
const when = (iso: string) => new Date(iso).toLocaleString("bn-BD", { timeZone: "Asia/Dhaka", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
const dhakaDay = (iso: string) => new Date(new Date(iso).getTime() + 6 * 3600_000).toISOString().slice(0, 10);

export function useSiteVisits() {
  const adminToken = useAdminToken();
  const list = useServerFn(listSiteVisits);
  return useQuery({ queryKey: ["site-visits", adminToken], queryFn: () => list({ data: { adminToken } }), refetchInterval: 60_000 });
}

/** Reminder for scheduled visits in the next 24h or already past their time but not updated. */
export function SiteVisitReminder({ leads: given }: { leads?: Lead[] }) {
  const snap = useSnapshot();
  const leads = given ?? snap.leads;
  const visits = useSiteVisits();
  const now = Date.now();
  const leadName = new Map(leads.map((l) => [l.id, l.name]));
  const due = (visits.data ?? [])
    .filter((v) => ((v.status === "scheduled" || v.status === "confirmed") && new Date(v.visit_at).getTime() <= now + 24 * 3600_000)
      || (v.status === "completed" && !v.outcome_at))
    .sort((a, b) => a.visit_at.localeCompare(b.visit_at));
  if (!due.length) return null;
  return (
    <div role="status" className="rounded-2xl border border-primary/40 bg-primary/5 p-3 text-xs">
      <p className="mb-1.5 flex items-center gap-1.5 font-semibold text-primary"><BellRing className="size-3.5" />সাইট ভিজিট অনুস্মারক — {due.length}টি</p>
      <ul className="space-y-1">
        {due.slice(0, 5).map((v) => {
          const late = new Date(v.visit_at).getTime() < now;
          return (
            <li key={v.id} className="flex flex-wrap justify-between gap-2">
              <span className="min-w-0 truncate font-medium">{leadName.get(v.lead_id) ?? "লিড"}{v.project ? ` · ${v.project}` : ""}</span>
              <span className={late ? "text-destructive" : "text-muted-foreground"}>{when(v.visit_at)}{v.status === "completed" ? " · ফলাফল লিখুন" : late ? " · সময় পেরিয়েছে, অবস্থা আপডেট করুন" : ""}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function SiteVisitsPanel({ leads, fromDay, toDay, agentId = null }: { leads: Lead[]; fromDay?: string; toDay?: string; agentId?: string | null }) {
  const adminToken = useAdminToken();
  const qc = useQueryClient();
  const create = useServerFn(createSiteVisit);
  const setStatus = useServerFn(setSiteVisitStatus);
  const visits = useSiteVisits();
  const addCal = useServerFn(addSiteVisitToTeamCalendar);
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
    return (!fromDay || d >= fromDay) && (!toDay || d <= toDay) && (!agentId || v.agent_id === agentId);
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

  const toCalendar = useMutation({
    mutationFn: (id: string) => addCal({ data: { adminToken, id } }),
    onSuccess: (r) => { toast.success(r.already ? "আগেই টিম ক্যালেন্ডারে আছে" : "টিম ক্যালেন্ডারে যোগ হয়েছে"); refresh(); },
    onError: (e) => toast.error((e as Error).message),
  });

  const field = "h-9 w-full min-w-0 rounded-lg border border-border bg-background px-2.5 text-xs";

  return (
    <section className="card-elevated min-w-0 p-4 sm:p-5">
      <header className="mb-3 flex items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold tracking-tight">সাইট ভিজিট রেকর্ড</h3>
          <p className="text-[11px] text-muted-foreground">লিডের সাথে যুক্ত আসল ভিজিট — তারিখ ও অবস্থাসহ (ঢাকা সময়)</p>
        </div>
        <button type="button" onClick={() => setOpen((o) => !o)} className="shrink-0 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground">
          {open ? "বন্ধ" : "+ ভিজিট"}
        </button>
      </header>

      <div className="mb-3"><SiteVisitReminder leads={leads} /></div>

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
            <span className="block text-[11px] text-muted-foreground">{VISIT_LABEL[s]}</span>
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
                <span className="flex items-center gap-2">
                {v.team_calendar_event_id ? (
                  <span className="rounded-md border border-success/30 bg-success/10 px-2 py-1 text-[11px] font-semibold text-success">✓ টিম ক্যালেন্ডারে</span>
                ) : (v.status === "scheduled" || v.status === "confirmed") ? (
                  <button type="button" disabled={toCalendar.isPending} onClick={() => toCalendar.mutate(v.id)}
                    className="h-8 rounded-lg border border-border px-2 text-[11px] font-semibold hover:bg-muted disabled:opacity-50">
                    {toCalendar.isPending && toCalendar.variables === v.id ? "যোগ হচ্ছে…" : "টিম ক্যালেন্ডারে যোগ"}
                  </button>
                ) : null}
                <select aria-label="অবস্থা" className="h-8 rounded-lg border border-border bg-background px-2 text-xs" value={v.status}
                  disabled={change.isPending} onChange={(e) => change.mutate({ id: v.id, status: e.target.value as (typeof SITE_VISIT_STATUSES)[number] })}>
                  {SITE_VISIT_STATUSES.map((s) => <option key={s} value={s}>{VISIT_LABEL[s]}</option>)}
                </select>
                </span>
              </li>
            ))}
          </ul>
        )}
    </section>
  );
}
