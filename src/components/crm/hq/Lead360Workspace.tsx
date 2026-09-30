import { useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, CalendarClock, Phone, PhoneMissed, Search, UserRound } from "lucide-react";
import { useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { followUpReasonLabel } from "@/lib/follow-up-reasons";
import { buildLeadTimeline, lead360Csv, summarize, type TimelineItem } from "@/lib/lead360";
import { exportLead360Search, getLead360, searchLead360 } from "@/lib/lead360.functions";
import { CONTACT_CLOSE_REASONS, SYSTEM_CLOSE_REASONS } from "@/lib/contact-close-reasons";
import { useAdminToken } from "@/lib/local-session";
import { SalesBriefCard } from "@/components/crm/sales-intel/SalesIntelPanels";

const fmt = (iso: string | null, withTime = true) =>
  iso
    ? new Date(iso).toLocaleString("en-GB", {
        timeZone: "Asia/Dhaka",
        day: "numeric",
        month: "short",
        year: withTime ? undefined : "numeric",
        ...(withTime ? { hour: "numeric", minute: "2-digit" } : {}),
      })
    : "—";

export function Lead360Workspace() {
  const fromUrl = useRouterState({ select: (st) => String((st.location.search as Record<string, unknown>)["lead"] ?? "") });
  const [openId, setOpenId] = useState<string | null>(fromUrl || null);
  return openId ? <Lead360Detail leadId={openId} onBack={() => setOpenId(null)} /> : <Lead360Search onOpen={setOpenId} />;
}

function Lead360Search({ onOpen }: { onOpen: (id: string) => void }) {
  const adminToken = useAdminToken();
  const search = useServerFn(searchLead360);
  const [draft, setDraft] = useState("");
  const [q, setQ] = useState("");
  const [fu, setFu] = useState<"any" | "upcoming" | "overdue" | "none">("any");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [source, setSource] = useState("");
  const [requirement, setRequirement] = useState("");
  const [reason, setReason] = useState("");
  const [eventKind, setEventKind] = useState("");
  const [cursor, setCursor] = useState(0);
  const filters = { q, followUpStatus: fu, from: from || null, to: to || null, source: source || null, requirement: requirement || null, reason: reason || null, eventKind: eventKind || null };
  const res = useQuery({
    queryKey: ["lead360-search", filters, cursor, adminToken],
    queryFn: () => search({ data: { adminToken, ...filters, cursor } }),
  });
  const exportFn = useServerFn(exportLead360Search);
  const [exporting, setExporting] = useState(false);
  const runExport = async (kind: "csv" | "print") => {
    setExporting(true);
    try {
      const out = await exportFn({ data: { adminToken, ...filters } });
      if (out.locked) return;
      if (kind === "csv") {
        const url = URL.createObjectURL(new Blob(["\ufeff" + out.csv], { type: "text/csv" }));
        const a = document.createElement("a"); a.href = url; a.download = "lead360-filtered.csv"; a.click(); URL.revokeObjectURL(url);
      } else {
        const url = URL.createObjectURL(new Blob([out.html], { type: "text/html" }));
        window.open(url, "_blank");
      }
    } finally {
      setExporting(false);
    }
  };
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-bold">Lead 360</h2>
        <p className="text-sm text-muted-foreground">নাম, ফোন, Lead ID, Reference বা Source দিয়ে খুঁজুন — একটি লিডের পুরো যোগাযোগের ইতিহাস এক জায়গায়।</p>
      </div>
      <form
        className="flex flex-col gap-2 sm:flex-row sm:flex-wrap"
        onSubmit={(e) => {
          e.preventDefault();
          setQ(draft);
          setCursor(0);
        }}
      >
        <div className="relative min-w-0 flex-1">
          <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
          <Input className="pl-8" value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="+8801712… / নাম / Lead ID" />
        </div>
        <select className="h-9 rounded-md border border-input bg-background px-2 text-sm" value={fu} onChange={(e) => setFu(e.target.value as typeof fu)} aria-label="ফলো-আপ অবস্থা">
          <option value="any">সব ফলো-আপ</option>
          <option value="upcoming">Upcoming</option>
          <option value="overdue">Overdue</option>
          <option value="none">ফলো-আপ নেই</option>
        </select>
        <Input type="date" className="sm:w-40" value={from} onChange={(e) => setFrom(e.target.value)} aria-label="শুরুর তারিখ" />
        <Input type="date" className="sm:w-40" value={to} onChange={(e) => setTo(e.target.value)} aria-label="শেষ তারিখ" />
        <Input className="sm:w-36" value={source} onChange={(e) => setSource(e.target.value)} placeholder="Source" aria-label="Source" />
        <Input className="sm:w-40" value={requirement} onChange={(e) => setRequirement(e.target.value)} placeholder="Requirement / প্রকল্প" aria-label="Requirement" />
        <select className="h-9 rounded-md border border-input bg-background px-2 text-sm" value={reason} onChange={(e) => setReason(e.target.value)} aria-label="কারণ">
          <option value="">সব কারণ</option>
          {[...CONTACT_CLOSE_REASONS, ...SYSTEM_CLOSE_REASONS].map((r) => <option key={r.code} value={r.code}>{r.label}</option>)}
        </select>
        <select className="h-9 rounded-md border border-input bg-background px-2 text-sm" value={eventKind} onChange={(e) => setEventKind(e.target.value)} aria-label="ইভেন্টের ধরন">
          <option value="">সব ইভেন্ট</option>
          <option value="contact_closed">Contact closed</option>
          <option value="outcome_logged">Outcome logged</option>
          <option value="call_connected">Call connected</option>
          <option value="self_claimed">Self claimed</option>
        </select>
        <Button type="submit">খুঁজুন</Button>
        <Button type="button" variant="outline" disabled={exporting} onClick={() => runExport("csv")}>CSV</Button>
        <Button type="button" variant="outline" disabled={exporting} onClick={() => runExport("print")}>Print / PDF</Button>
      </form>
      {!res.data?.locked && res.data ? (
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>মোট {res.data.total} লিড · {cursor + 1}–{cursor + res.data.rows.length}</span>
          <span className="flex gap-2">
            <Button size="sm" variant="outline" disabled={cursor === 0} onClick={() => setCursor(Math.max(0, cursor - 40))}>আগে</Button>
            <Button size="sm" variant="outline" disabled={res.data.nextCursor === null} onClick={() => setCursor(res.data!.nextCursor ?? cursor)}>পরে</Button>
          </span>
        </div>
      ) : null}
      {res.data?.locked ? (
        <p className="rounded-lg border border-border p-4 text-sm text-muted-foreground">HQ/IT পিন দিয়ে আনলক করুন।</p>
      ) : res.isPending ? (
        <p className="text-sm text-muted-foreground">লোড হচ্ছে…</p>
      ) : !res.data?.rows.length ? (
        <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">কোনো লিড মেলেনি।</p>
      ) : (
        <ul className="divide-y divide-border rounded-xl border border-border">
          {res.data.rows.map((r) => (
            <li key={r.id}>
              <button type="button" onClick={() => onOpen(r.id)} className="flex w-full flex-col gap-1 px-4 py-3 text-left hover:bg-accent sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="truncate font-semibold">{r.name || "নাম নেই"}</p>
                  <p className="text-xs text-muted-foreground">{r.phone} · {r.source ?? "—"}{r.referenceBy ? ` · Ref: ${r.referenceBy}` : ""}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span>{r.calls} Calls · {r.followUps} Follow-ups · {r.connected} Connected</span>
                  {r.nextFollowUpAt && (
                    <Badge variant={r.fuState === "overdue" ? "destructive" : "secondary"}>Next: {fmt(r.nextFollowUpAt, false)}</Badge>
                  )}
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

const KIND_STYLE: Record<TimelineItem["kind"], string> = {
  lead_created: "bg-muted text-foreground",
  call_connected: "bg-success/15 text-success",
  call_not_connected: "bg-destructive/10 text-destructive",
  follow_up_created: "bg-primary/10 text-primary",
  follow_up_rescheduled: "bg-warning/15 text-warning",
  follow_up_completed: "bg-success/15 text-success",
  follow_up_updated: "bg-primary/10 text-primary",
  status_changed: "bg-accent text-foreground",
  pitch_used: "bg-primary/15 text-primary",
};

function Lead360Detail({ leadId, onBack }: { leadId: string; onBack: () => void }) {
  const adminToken = useAdminToken();
  const get = useServerFn(getLead360);
  const res = useQuery({ queryKey: ["lead360", leadId, adminToken], queryFn: () => get({ data: { adminToken, leadId } }) });
  const view = useMemo(() => {
    if (!res.data) return null;
    const d = res.data;
    const name = (id: string | null) => (id ? (d.agents[id] ?? "অজানা") : "—");
    return {
      d,
      name,
      sum: summarize(d.calls, d.followUps),
      timeline: buildLeadTimeline({
        lead: { id: d.lead.id, createdAt: d.lead.createdAt, source: d.lead.source, assignedTo: d.lead.assignedTo },
        calls: d.calls,
        followUps: d.followUps,
        changes: d.changes,
        events: d.events,
        stateChanges: d.stateChanges,
        pitches: d.pitches,
        agentName: name,
      }),
    };
  }, [res.data]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button variant="ghost" size="sm" onClick={onBack}><ArrowLeft className="size-4" /> খোঁজে ফিরুন</Button>
        {view && (
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const csv = lead360Csv({ lead: view.d.lead.name ?? view.d.lead.id, phone: view.d.lead.phone, generatedAt: new Date() }, view.timeline);
                const url = URL.createObjectURL(new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" }));
                const a = document.createElement("a");
                a.href = url;
                a.download = `lead360-${view.d.lead.id}.csv`;
                a.click();
                URL.revokeObjectURL(url);
              }}
            >
              CSV
            </Button>
            <Button variant="outline" size="sm" onClick={() => window.print()}>Print / PDF</Button>
          </div>
        )}
      </div>
      {res.isError && <p className="text-sm text-destructive">{(res.error as Error).message}</p>}
      {!view ? (
        <p className="text-sm text-muted-foreground">লোড হচ্ছে…</p>
      ) : (
        <>
          <header className="rounded-xl border border-border p-4">
            <div className="flex items-start gap-3">
              <span className="grid size-10 place-items-center rounded-full bg-primary/10 text-primary"><UserRound className="size-5" /></span>
              <div className="min-w-0 space-y-0.5">
                <h2 className="text-lg font-bold">{view.d.lead.name || "নাম নেই"}</h2>
                <p className="text-sm">{view.d.lead.phone}</p>
                <p className="text-xs text-muted-foreground">
                  {[view.d.lead.address, view.d.lead.requirement, `Source: ${view.d.lead.source ?? "—"}`, view.d.lead.referenceBy ? `Ref: ${view.d.lead.referenceBy}` : null, `Assigned: ${view.name(view.d.lead.assignedTo)}`]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </div>
            </div>
          </header>

          {view.d.linkedLeads.length > 0 && (
            <div className="rounded-lg border border-warning/40 bg-warning/10 p-3 text-xs">
              একই নম্বরে আরও {view.d.linkedLeads.length}টি লিড আছে (আলাদা ব্যক্তি হতে পারে, একত্র করা হয়নি):{" "}
              {view.d.linkedLeads.map((l) => `${l.name ?? "নাম নেই"} (${l.phone})`).join(", ")}
            </div>
          )}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
            {[
              ["মোট Call", view.sum.totalCalls],
              ["Connected", view.sum.connected],
              ["Not Connected", view.sum.notConnected],
              ["মোট Follow-up", view.sum.totalFollowUps],
              ["Completed", view.sum.completed],
              ["Upcoming", view.sum.upcoming],
              ["Overdue", view.sum.overdue],
            ].map(([k, v]) => (
              <div key={k} className="rounded-lg border border-border p-3">
                <p className="text-[11px] text-muted-foreground">{k}</p>
                <p className="text-xl font-bold">{v}</p>
              </div>
            ))}
          </div>

          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
            <section className="space-y-3">
              <h3 className="font-semibold">সম্পূর্ণ Activity Timeline <span className="text-xs font-normal text-muted-foreground">— মোট {view.timeline.length}টি ঘটনা</span></h3>
              <ol className="relative space-y-3 border-l border-border pl-5">
                {view.timeline.map((t) => (
                  <li key={t.id} className="relative">
                    <span className="absolute -left-[25px] top-1.5 size-2.5 rounded-full bg-primary" />
                    <p className="text-xs text-muted-foreground">{fmt(t.at)}</p>
                    <span className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-bold ${KIND_STYLE[t.kind]}`}>
                      {t.kind === "call_not_connected" ? <PhoneMissed className="size-3" /> : t.kind.startsWith("call") ? <Phone className="size-3" /> : <CalendarClock className="size-3" />}
                      {t.title}
                    </span>
                    <ul className="mt-1 space-y-0.5 text-sm">
                      {t.lines.map((l, i) => <li key={i}>{l}</li>)}
                    </ul>
                  </li>
                ))}
              </ol>
            </section>

            <aside className="space-y-3">
              <div className="rounded-xl border border-primary/30 bg-primary/5 p-3">
                <p className="text-xs font-semibold text-primary">Current Follow-up</p>
                {view.sum.current ? (
                  <>
                    <p className="mt-1 font-bold">{fmt(view.sum.current.scheduledAt)}</p>
                    <p className="text-xs">Status: {new Date(view.sum.current.scheduledAt) < new Date() ? "Overdue" : "Upcoming"}</p>
                    <p className="mt-1 text-sm">কারণ: {followUpReasonLabel(view.sum.current.reasonCode, view.sum.current.note)}</p>
                    <p className="text-xs text-muted-foreground">Created By: {view.name(view.sum.current.agentId)}</p>
                  </>
                ) : (
                  <p className="mt-1 text-sm text-muted-foreground">কোনো সক্রিয় ফলো-আপ নেই</p>
                )}
              </div>
              <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 rounded-xl border border-border p-3 text-sm">
                {[
                  ["First Follow-up", fmt(view.sum.firstFollowUpAt, false)],
                  ["Last Follow-up", fmt(view.sum.lastFollowUpAt, false)],
                  ["Next Follow-up", fmt(view.sum.nextFollowUpAt, false)],
                  ["Total Follow-ups", view.sum.totalFollowUps],
                  ["Completed", view.sum.completed],
                  ["Upcoming", view.sum.upcoming],
                  ["Overdue", view.sum.overdue],
                  ["Rescheduled", view.sum.rescheduled],
                  ["Days Since Contact", view.sum.daysSinceContact ?? "—"],
                ].map(([k, v]) => (
                  <div key={k} className="contents">
                    <dt className="text-muted-foreground">{k}</dt>
                    <dd className="text-right font-semibold">{v}</dd>
                  </div>
                ))}
              </dl>
            </aside>
          </div>
        </>
      )}
    </div>
  );
}
