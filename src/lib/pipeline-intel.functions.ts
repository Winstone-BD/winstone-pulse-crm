import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { PIPELINE_QUESTIONS } from "@/lib/pipeline-intel";

const QIDS = PIPELINE_QUESTIONS.map((q) => q.id) as [string, ...string[]];

/** Whitelisted pipeline questions answered from database counts. Agents: own leads only; HQ/IT: all. */
export const askPipeline = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ token: z.string().nullable().optional(), question: z.enum(QIDS) }).parse(i))
  .handler(async ({ data }) => {
    const { resolveCaller } = await import("@/lib/access.server");
    const c = await resolveCaller(data.token ?? null);
    if (c.scope !== "authority" && (c.scope !== "agent" || !c.profile)) throw new Error("Sign in required");
    const mine = c.scope === "agent" ? c.profile!.id : null;
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
    const P = await import("@/lib/pipeline-intel");
    const now = new Date();
    const scope = mine ? "Your assigned leads" : "All agents";
    const names = async (ids: string[]) => {
      const { data: p } = ids.length ? await db.from("profiles").select("id, name").in("id", ids) : { data: [] };
      return new Map((p ?? []).map((x) => [x.id, x.name as string]));
    };

    if (data.question === "followups_today" || data.question === "overdue_by_agent") {
      let q = db.from("follow_up_events").select("agent_id, scheduled_at, status").eq("status", "upcoming").lte("scheduled_at", new Date(now.getTime() + 86_400_000).toISOString()).limit(5000);
      if (mine) q = q.eq("agent_id", mine);
      const { data: rows, error } = await q;
      if (error) throw new Error(error.message);
      const capped = (rows?.length ?? 0) >= 5000;
      if (data.question === "followups_today") {
        const r = P.followupsToday(rows ?? [], now);
        return { scope, period: `Today ${r.today} (Asia/Dhaka)`, lines: [`Due today: ${r.dueToday}`, `Overdue from earlier days: ${r.overdue}`], limits: capped ? "Capped at 5,000 rows" : "Upcoming follow-ups only" };
      }
      const ranked = P.overdueByAgent(rows ?? [], now).slice(0, 10);
      const n = await names(ranked.map(([id]) => id));
      return { scope, period: `As of ${now.toISOString()}`, lines: ranked.length ? ranked.map(([id, k]) => `${n.get(id) ?? "Unknown agent"}: ${k} overdue`) : ["No overdue follow-ups"], limits: "Counts follow-ups past their scheduled time and still open" };
    }

    if (data.question === "inactive_7d") {
      let q = db.from("leads").select("id, name, status, last_call_at, updated_at, created_at, assigned_to").neq("status", "closed").not("assigned_to", "is", null)
        .lt("updated_at", new Date(now.getTime() - 7 * 86_400_000).toISOString()).order("updated_at", { ascending: true }).limit(2000);
      if (mine) q = q.eq("assigned_to", mine);
      const { data: rows, error } = await q;
      if (error) throw new Error(error.message);
      const hit = (rows ?? []).filter((l) => P.isInactive(l, now));
      return { scope, period: "No call or update for 7+ days", lines: [`Inactive leads: ${hit.length}`, ...hit.slice(0, 10).map((l) => `${l.name} — last call ${l.last_call_at ? l.last_call_at.slice(0, 10) : "never"}`)], limits: "Open, assigned leads; oldest 10 shown; scans up to 2,000" };
    }

    if (data.question === "stage_counts") {
      let lq = db.from("leads").select("status").limit(20000);
      let bq = db.from("bookings").select("approval_status, amount_usd, lead_id, agent_id").limit(5000);
      if (mine) { lq = lq.eq("assigned_to", mine); bq = bq.eq("agent_id", mine); }
      const [l, b] = await Promise.all([lq, bq]);
      if (l.error) throw new Error(l.error.message);
      if (b.error) throw new Error(b.error.message);
      const r = P.stageCounts(l.data ?? [], b.data ?? []);
      const usd = (c: number) => `$${(c / 100).toLocaleString("en-US", { minimumFractionDigits: 2 })}`;
      return { scope, period: "All time", lines: [
        ...Object.entries(r.stages).map(([k, v]) => `Leads ${k.replace("_", " ")}: ${v}`),
        ...Object.entries(r.bookings).map(([k, v]) => `Bookings ${k}: ${v.count} · recorded value ${usd(v.usdCents)}${v.missingAmount ? ` (${v.missingAmount} without amount)` : ""}`),
      ], limits: "Value is the sum of recorded booking amounts, not a forecast" };
    }

    // week_summary — last 7 Dhaka days including today
    const since = new Date(Date.parse(`${(await import("@/lib/handover-due")).dhakaDate(new Date(now.getTime() - 6 * 86_400_000))}T00:00:00+06:00`)).toISOString();
    let lq = db.from("leads").select("id", { count: "exact", head: true }).gte("created_at", since);
    let vq = db.from("site_visits").select("status").gte("visit_at", since).lte("visit_at", now.toISOString());
    let bq = db.from("bookings").select("id", { count: "exact", head: true }).gte("booked_at", since);
    if (mine) { lq = lq.eq("assigned_to", mine); vq = vq.eq("agent_id", mine); bq = bq.eq("agent_id", mine); }
    const [l, v, b] = await Promise.all([lq, vq, bq]);
    const vs = v.data ?? [];
    return { scope, period: `Since ${since.slice(0, 10)} (7 Dhaka days)`, lines: [
      `New leads: ${l.count ?? 0}`, `Site visits held/scheduled: ${vs.length}`, `Visits completed: ${vs.filter((x) => x.status === "completed").length}`, `Bookings: ${b.count ?? 0}`,
    ], limits: mine ? "New leads counted only if currently assigned to you" : "All agents" };
  });

/** HQ/IT daily report sheet: one row per lead with activity on the chosen Dhaka date (or open visits/bookings). */
export const getDailySheet = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ token: z.string().nullable().optional(), date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }).parse(i))
  .handler(async ({ data }) => {
    const { resolveCaller } = await import("@/lib/access.server");
    const c = await resolveCaller(data.token ?? null);
    if (c.scope !== "authority") throw new Error("HQ/IT access required");
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
    const start = new Date(`${data.date}T00:00:00+06:00`).toISOString();
    const end = new Date(Date.parse(start) + 86_400_000).toISOString();
    const [calls, visits, books] = await Promise.all([
      db.from("call_reports").select("lead_id, submitted_at").eq("status", "submitted").gte("submitted_at", start).lt("submitted_at", end).limit(5000),
      db.from("site_visits").select("lead_id, status, visit_at").gte("visit_at", start).lt("visit_at", end).limit(5000),
      db.from("bookings").select("lead_id, approval_status, booked_at").gte("booked_at", start).lt("booked_at", end).limit(5000),
    ]);
    for (const r of [calls, visits, books]) if (r.error) throw new Error(r.error.message);
    const agg = new Map<string, { visits: number; done: number; bookings: number; pay: string[]; last: string | null }>();
    const get = (id: string) => agg.get(id) ?? (agg.set(id, { visits: 0, done: 0, bookings: 0, pay: [], last: null }), agg.get(id)!);
    const touch = (e: { last: string | null }, t: string | null) => { if (t && (!e.last || t > e.last)) e.last = t; };
    for (const r of calls.data ?? []) if (r.lead_id) touch(get(r.lead_id), r.submitted_at);
    for (const r of visits.data ?? []) { const e = get(r.lead_id); e.visits++; if (r.status === "completed") e.done++; touch(e, r.visit_at); }
    for (const r of books.data ?? []) { const e = get(r.lead_id); e.bookings++; e.pay.push(r.approval_status === "approved" ? "HQ approved" : `awaiting HQ (${r.approval_status})`); touch(e, r.booked_at); }
    const ids = [...agg.keys()].slice(0, 1000);
    const leads = ids.length ? (await db.from("leads").select("id, name, phone_number, status, assigned_to").in("id", ids)).data ?? [] : [];
    const owners = [...new Set(leads.map((l) => l.assigned_to).filter(Boolean))] as string[];
    const pn = new Map(((owners.length ? (await db.from("profiles").select("id, name").in("id", owners)).data : []) ?? []).map((p) => [p.id, p.name as string]));
    const fmt = (t: string | null) => (t ? new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Dhaka", hour: "2-digit", minute: "2-digit" }).format(new Date(t)) : null);
    return leads.map((l) => {
      const e = agg.get(l.id)!;
      return { leadId: l.id, lead: l.name, phone: l.phone_number, agent: l.assigned_to ? pn.get(l.assigned_to) ?? null : null, status: String(l.status), visits: e.visits, visitsCompleted: e.done, bookings: e.bookings, paymentStatus: e.pay.join("; ") || "—", lastActivity: fmt(e.last) };
    }).sort((a, b) => (b.lastActivity ?? "").localeCompare(a.lastActivity ?? ""));
  });
