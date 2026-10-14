import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/**
 * Site visit records linked to canonical leads. Server-only table: every
 * read/write goes through the server-resolved caller. HQ/IT sees and edits
 * all; agents only visits on leads assigned to them. Never deleted.
 */
export const SITE_VISIT_STATUSES = ["scheduled", "confirmed", "completed", "offer_made", "cancelled", "no_show"] as const;
const Token = z.string().nullable().optional();

export const listSiteVisits = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ adminToken: Token }).parse(i ?? {}))
  .handler(async ({ data }) => {
    const { siCaller } = await import("@/lib/sales-intel.server");
    // Signed-out / no-scope viewers simply see no visits instead of a crash.
    const c = await siCaller(data.adminToken).catch(() => null);
    if (!c) return [];
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const out: Array<{ id: string; lead_id: string; agent_id: string | null; project: string | null; visit_at: string; status: string; notes: string | null; created_by: string; updated_by: string | null; team_calendar_event_id: string | null; team_calendar_added_at: string | null; outcome: string | null; outcome_interest: string | null; outcome_at: string | null; outcome_by: string | null; lead_name: string | null }> = [];
    for (let a = 0; ; a += 1000) {
      let q = supabaseAdmin.from("site_visits").select("id, lead_id, agent_id, project, visit_at, status, notes, created_by, updated_by, team_calendar_event_id, team_calendar_added_at, outcome, outcome_interest, outcome_at, outcome_by, leads(name)");
      if (c.scope === "agent") q = q.eq("agent_id", c.agentId!);
      const { data: rows, error } = await q.order("visit_at", { ascending: false }).order("id").range(a, a + 999);
      if (error) throw new Error("সাইট ভিজিট পড়া যায়নি");
      for (const r of rows ?? []) { const { leads, ...rest } = r as typeof r & { leads?: { name?: string } | null }; out.push({ ...rest, lead_name: leads?.name ?? null }); }
      if (!rows || rows.length < 1000) return out;
    }
  });

export const createSiteVisit = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z.object({
      adminToken: Token,
      leadId: z.string().uuid(),
      visitAt: z.string().datetime({ offset: true }),
      project: z.string().trim().max(120).optional().nullable(),
      notes: z.string().trim().max(500).optional().nullable(),
    }).parse(i),
  )
  .handler(async ({ data }) => {
    const { siCaller, leadForCaller } = await import("@/lib/sales-intel.server");
    const c = await siCaller(data.adminToken);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const lead = await leadForCaller(supabaseAdmin, c, data.leadId); // ownership check for agents
    const agentId = c.scope === "agent" ? c.agentId : ((lead as { assigned_agent_id?: string | null }).assigned_agent_id ?? null);
    const { error } = await supabaseAdmin.from("site_visits").insert({
      lead_id: data.leadId,
      agent_id: agentId,
      visit_at: data.visitAt,
      project: data.project || null,
      notes: data.notes || null,
      created_by: c.actor,
    });
    if (error) throw new Error("সাইট ভিজিট সংরক্ষণ হয়নি");
    return { ok: true };
  });

export const setSiteVisitStatus = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z.object({ adminToken: Token, id: z.string().uuid(), status: z.enum(SITE_VISIT_STATUSES) }).parse(i),
  )
  .handler(async ({ data }) => {
    const { siCaller } = await import("@/lib/sales-intel.server");
    const c = await siCaller(data.adminToken);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let q = supabaseAdmin.from("site_visits").update({ status: data.status, updated_by: c.actor }).eq("id", data.id);
    if (c.scope === "agent") q = q.eq("agent_id", c.agentId!);
    const { data: rows, error } = await q.select("id");
    if (error || !rows?.length) throw new Error("অবস্থা বদলানো যায়নি");
    return { ok: true };
  });

/**
 * Adds one confirmed (scheduled) site visit to the shared Winstone team Google
 * Calendar. Only the visit's own agent or HQ/IT may do it; a visit is added at
 * most once (event id stored on the row). No customer phone number is sent.
 */
export const addSiteVisitToTeamCalendar = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ adminToken: Token, id: z.string().uuid() }).parse(i))
  .handler(async ({ data }) => {
    const { siCaller } = await import("@/lib/sales-intel.server");
    const c = await siCaller(data.adminToken);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let q = supabaseAdmin.from("site_visits").select("id, lead_id, agent_id, project, visit_at, status, team_calendar_event_id").eq("id", data.id);
    if (c.scope === "agent") q = q.eq("agent_id", c.agentId!);
    const { data: v } = await q.maybeSingle();
    if (!v) throw new Error("ভিজিট পাওয়া যায়নি বা আপনার অনুমতি নেই");
    if (v.status !== "scheduled" && v.status !== "confirmed") throw new Error("শুধু নির্ধারিত (কনফার্ম) ভিজিট ক্যালেন্ডারে যোগ করা যায়");
    if (v.team_calendar_event_id) return { ok: true, already: true };
    const lovableKey = process.env["LOVABLE_API_KEY"];
    const calKey = process.env["GOOGLE_CALENDAR_API_KEY"];
    if (!lovableKey || !calKey) throw new Error("টিম ক্যালেন্ডার সংযুক্ত নেই");
    const { data: lead } = await supabaseAdmin.from("leads").select("name").eq("id", v.lead_id).maybeSingle();
    let agentName = "";
    if (v.agent_id) {
      const { data: p } = await supabaseAdmin.from("profiles").select("name").eq("id", v.agent_id).maybeSingle();
      agentName = p?.name ?? "";
    }
    const start = new Date(v.visit_at);
    const end = new Date(start.getTime() + 60 * 60_000);
    const res = await fetch("https://connector-gateway.lovable.dev/google_calendar/calendar/v3/calendars/primary/events", {
      method: "POST",
      headers: { Authorization: `Bearer ${lovableKey}`, "X-Connection-Api-Key": calKey, "Content-Type": "application/json" },
      body: JSON.stringify({
        summary: `সাইট ভিজিট — ${lead?.name ?? "লিড"}${v.project ? ` · ${v.project}` : ""}`,
        description: `Winstone Pulse কনফার্ম সাইট ভিজিট${agentName ? `\nএজেন্ট: ${agentName}` : ""}\nযোগ করেছেন: ${c.actor}`,
        start: { dateTime: start.toISOString(), timeZone: "Asia/Dhaka" },
        end: { dateTime: end.toISOString(), timeZone: "Asia/Dhaka" },
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      console.error(`Team calendar insert failed [${res.status}]: ${body}`);
      throw new Error(`ক্যালেন্ডারে যোগ হয়নি (${res.status})`);
    }
    const ev = (await res.json()) as { id?: string };
    const { error } = await supabaseAdmin.from("site_visits")
      .update({ team_calendar_event_id: ev.id ?? "unknown", team_calendar_added_at: new Date().toISOString(), team_calendar_added_by: c.actor })
      .eq("id", v.id).is("team_calendar_event_id", null);
    if (error) throw new Error("ক্যালেন্ডারে যোগ হয়েছে, কিন্তু রেকর্ড সংরক্ষণ হয়নি");
    return { ok: true, already: false };
  });

/**
 * Post-visit outcome. Only for visits that actually happened (completed /
 * offer made). Visit's own agent or HQ/IT; also appended to the lead timeline.
 */
export const logSiteVisitOutcome = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z.object({
      adminToken: Token,
      id: z.string().uuid(),
      interest: z.enum(["hot", "warm", "cold", "not_interested"]),
      outcome: z.string().trim().min(3).max(1000),
      offerMade: z.boolean().optional(),
    }).parse(i),
  )
  .handler(async ({ data }) => {
    const { siCaller } = await import("@/lib/sales-intel.server");
    const c = await siCaller(data.adminToken);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let read = supabaseAdmin.from("site_visits").select("id, lead_id, agent_id, status").eq("id", data.id);
    if (c.scope === "agent") read = read.eq("agent_id", c.agentId!);
    const { data: v } = await read.maybeSingle();
    if (!v) throw new Error("ভিজিট পাওয়া যায়নি বা আপনার অনুমতি নেই");
    if (v.status !== "completed" && v.status !== "offer_made") throw new Error("শুধু সম্পন্ন ভিজিটের ফলাফল লেখা যায়");
    const patch = {
      outcome: data.outcome, outcome_interest: data.interest, outcome_at: new Date().toISOString(), outcome_by: c.actor, updated_by: c.actor,
      ...(data.offerMade ? { status: "offer_made" } : {}),
    };
    const { error } = await supabaseAdmin.from("site_visits").update(patch).eq("id", v.id);
    if (error) throw new Error("ফলাফল সংরক্ষণ হয়নি");
    const { logLeadEvent } = await import("@/lib/lead-events.server");
    await logLeadEvent({ leadId: v.lead_id, agentId: v.agent_id, kind: "site_visit_outcome",
      detail: `ভিজিটের ফলাফল (${data.interest}${data.offerMade ? " · অফার দেওয়া হয়েছে" : ""}): ${data.outcome}` });
    return { ok: true };
  });

/** Project label for outreach: the lead's most recent site visit project, if any. Owner/HQ only. */
export const leadProjectLabel = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ adminToken: Token, leadId: z.string().uuid() }).parse(i))
  .handler(async ({ data }) => {
    const { siCaller } = await import("@/lib/sales-intel.server");
    const c = await siCaller(data.adminToken).catch(() => null);
    if (!c) return { project: null };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let q = supabaseAdmin.from("site_visits").select("project").eq("lead_id", data.leadId).not("project", "is", null);
    if (c.scope === "agent") q = q.eq("agent_id", c.agentId!);
    const { data: v } = await q.order("visit_at", { ascending: false }).limit(1).maybeSingle();
    if (v?.project) return { project: v.project };
    const { data: r } = await supabaseAdmin.from("call_reports").select("project_interest").eq("lead_id", data.leadId)
      .not("project_interest", "is", null).order("created_at", { ascending: false }).limit(1).maybeSingle();
    return { project: (r as { project_interest?: string | null } | null)?.project_interest ?? null };
  });
