import { safeCsvCell } from "@/lib/csv-safe";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/**
 * Social media moderation (Method A — no Meta API). Agents reply in Meta
 * Business Suite themselves; the CRM only records the work, turns interested
 * buyers into unassigned leads, and reports real counts to HQ/IT.
 */
const Base = z.object({ adminToken: z.string().nullable().optional() });
export const SOCIAL_KINDS = ["inbox", "page_comment", "group"] as const;
export type SocialKind = (typeof SOCIAL_KINDS)[number];

async function ctx(token: string | null | undefined) {
  const { resolveCaller } = await import("@/lib/access.server");
  const caller = await resolveCaller(token ?? null);
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return { caller, db: supabaseAdmin };
}

async function agentCtx(token: string | null | undefined) {
  const c = await ctx(token);
  if (c.caller.scope !== "agent" || !c.caller.profile) throw new Error("শুধু এজেন্ট অ্যাকাউন্ট থেকে লেখা যায়");
  const { assertBriefingForCaller } = await import("@/lib/agent-briefing.server");
  await assertBriefingForCaller(c.caller);
  return { ...c, agentId: c.caller.profile.id as string };
}

async function authorityCtx(token: string | null | undefined, write = false) {
  const c = await ctx(token);
  const { requireAuthority } = await import("@/lib/access.server");
  requireAuthority(c.caller);
  if (write && c.caller.readOnly) throw new Error("শুধু-দেখার অ্যাক্সেসে বদলানো যায় না");
  return c;
}

/** Dhaka midnight (UTC+6) as an ISO instant. */
export function dhakaDayStart(now = Date.now()): string {
  const d = new Date(now + 6 * 3_600_000);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - 6 * 3_600_000).toISOString();
}

const Link = z.string().trim().url().max(500).refine((u) => /^https:\/\//.test(u), "https লিংক দিন");

export const getSocialSetup = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => Base.parse(i))
  .handler(async ({ data }) => {
    const { caller, db } = await ctx(data.adminToken);
    if (caller.scope === "none") return { pages: [], templates: [] };
    const all = caller.scope === "authority";
    let pq = db.from("social_pages").select("id, name, kind, url, active").order("name");
    let tq = db.from("social_reply_templates").select("id, title, body, active").order("title");
    if (!all) { pq = pq.eq("active", true); tq = tq.eq("active", true); }
    const [{ data: pages }, { data: templates }] = await Promise.all([pq, tq]);
    return { pages: pages ?? [], templates: templates ?? [] };
  });

export const listMySocial = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => Base.parse(i))
  .handler(async ({ data }) => {
    const { caller, db } = await ctx(data.adminToken);
    if (caller.scope !== "agent" || !caller.profile) return { rows: [], today: { replies: 0, leads: 0, entries: 0 } };
    const { data: rows, error } = await db.from("social_activity_logs")
      .select("id, kind, page_id, link, note, reply_count, lead_id, voided_at, created_at")
      .eq("agent_id", caller.profile.id).order("created_at", { ascending: false }).limit(50);
    if (error) throw new Error(error.message);
    const start = dhakaDayStart();
    const live = (rows ?? []).filter((r) => !r.voided_at && r.created_at >= start);
    return {
      rows: rows ?? [],
      today: { entries: live.length, replies: live.reduce((s, r) => s + r.reply_count, 0), leads: live.filter((r) => r.lead_id).length },
    };
  });

const Activity = Base.extend({
  kind: z.enum(SOCIAL_KINDS),
  pageId: z.string({ required_error: "পেজ বা গ্রুপ বেছে নিন" }).uuid("পেজ বা গ্রুপ বেছে নিন"),
  link: Link.nullable().optional().or(z.literal("").transform(() => null)),
  note: z.string().trim().max(1000).nullable().optional(),
  replyCount: z.number().int().min(1).max(500).default(1),
});

export const logSocialActivity = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => Activity.parse(i))
  .handler(async ({ data }) => {
    const { db, agentId } = await agentCtx(data.adminToken);
    await requireActivePage(db, data.pageId);
    const { data: row, error } = await db.from("social_activity_logs").insert({
      agent_id: agentId, kind: data.kind, page_id: data.pageId ?? null, link: data.link ?? null,
      note: data.note || null, reply_count: data.replyCount,
    }).select("id").single();
    if (error) throw new Error(error.message);
    return { id: row.id };
  });

export const voidSocialActivity = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => Base.extend({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data }) => {
    const { db, agentId } = await agentCtx(data.adminToken);
    const { data: row } = await db.from("social_activity_logs").select("agent_id, voided_at").eq("id", data.id).maybeSingle();
    if (!row || row.agent_id !== agentId) throw new Error("এন্ট্রি পাওয়া যায়নি");
    if (row.voided_at) return { ok: true };
    const { error } = await db.from("social_activity_logs")
      .update({ voided_at: new Date().toISOString(), voided_by: agentId }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Every social entry must name a real, active HQ page/group so lead sources are never blank. */
// deno-lint-ignore no-explicit-any
async function requireActivePage(db: any, pageId: string): Promise<string> {
  const { data } = await db.from("social_pages").select("name, active").eq("id", pageId).maybeSingle();
  if (!data || !data.active) throw new Error("পেজ বা গ্রুপ বেছে নিন");
  return data.name as string;
}

export const SOCIAL_LEAD_SOURCE: Record<SocialKind, string> = {
  inbox: "facebook_inbox", page_comment: "facebook_comment", group: "facebook_group",
};

/** Buyer shared a number: create (or match) the lead — always unassigned, LeadHub routes it. */
export const convertSocialToLead = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    Activity.extend({ name: z.string().trim().min(1).max(120), phone: z.string().trim().min(6).max(40) }).parse(i),
  )
  .handler(async ({ data }) => {
    const { db, agentId, caller } = await agentCtx(data.adminToken);
    const pageName = await requireActivePage(db, data.pageId);
    const { intakeLead } = await import("@/lib/lead-intake.server");
    const r = await intakeLead({
      name: data.name, phoneNumber: data.phone, ownerId: null, source: SOCIAL_LEAD_SOURCE[data.kind],
      actorProfileId: agentId, actorLabel: caller.profile?.name ?? null,
      notes: ["Facebook থেকে আগ্রহী ক্রেতা", `উৎস: ${pageName}`, data.note || null, data.link ? `লিংক: ${data.link}` : null].filter(Boolean).join("\n"),
    });
    const { error } = await db.from("social_activity_logs").insert({
      agent_id: agentId, kind: data.kind, page_id: data.pageId ?? null, link: data.link ?? null,
      note: data.note || null, reply_count: data.replyCount, lead_id: r.leadId,
    });
    if (error) throw new Error(error.message);
    return { leadId: r.leadId, duplicate: Boolean(r.duplicate) };
  });

/* ---------------- HQ / IT ---------------- */

export type SocialAgentRow = { agentId: string; name: string; entries: number; replies: number; leads: number; visits: number; bookings: number };

export function summariseSocial(
  rows: { agent_id: string; reply_count: number; lead_id: string | null; voided_at: string | null }[],
  names: Map<string, string>, visited: Set<string>, booked: Set<string>,
): SocialAgentRow[] {
  const by = new Map<string, SocialAgentRow>();
  for (const r of rows) {
    if (r.voided_at) continue;
    const a = by.get(r.agent_id) ?? { agentId: r.agent_id, name: names.get(r.agent_id) ?? "—", entries: 0, replies: 0, leads: 0, visits: 0, bookings: 0 };
    a.entries += 1; a.replies += r.reply_count;
    if (r.lead_id) { a.leads += 1; if (visited.has(r.lead_id)) a.visits += 1; if (booked.has(r.lead_id)) a.bookings += 1; }
    by.set(r.agent_id, a);
  }
  return [...by.values()].sort((x, y) => y.replies - x.replies);
}

export const socialReport = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => Base.extend({ range: z.enum(["today", "month"]).default("today") }).parse(i))
  .handler(async ({ data }) => {
    const { db } = await authorityCtx(data.adminToken);
    let since = dhakaDayStart();
    if (data.range === "month") since = `${since.slice(0, 8)}01T00:00:00.000Z`;
    const { data: rows, error } = await db.from("social_activity_logs")
      .select("agent_id, reply_count, lead_id, voided_at").gte("created_at", since).limit(20000);
    if (error) throw new Error(error.message);
    const ids = [...new Set((rows ?? []).map((r) => r.agent_id))];
    const leadIds = [...new Set((rows ?? []).map((r) => r.lead_id).filter(Boolean))] as string[];
    const [{ data: people }, { data: visits }, { data: bookings }] = await Promise.all([
      ids.length ? db.from("profiles").select("id, name").in("id", ids) : Promise.resolve({ data: [] as { id: string; name: string }[] }),
      leadIds.length ? db.from("site_visits").select("lead_id").in("lead_id", leadIds) : Promise.resolve({ data: [] as { lead_id: string | null }[] }),
      leadIds.length ? db.from("bookings").select("lead_id").in("lead_id", leadIds) : Promise.resolve({ data: [] as { lead_id: string | null }[] }),
    ]);
    return summariseSocial(
      rows ?? [], new Map((people ?? []).map((p) => [p.id, p.name])),
      new Set((visits ?? []).map((v) => v.lead_id).filter(Boolean) as string[]),
      new Set((bookings ?? []).map((v) => v.lead_id).filter(Boolean) as string[]),
    );
  });

export type SocialLogRow = {
  id: string; createdAt: string; agentId: string; agentName: string; kind: string;
  source: string | null; link: string | null; replies: number; note: string | null;
  leadId: string | null; leadName: string | null; leadStatus: string | null; visited: boolean; booked: boolean;
  history: SocialLeadEvent[];
};
export type SocialLeadEvent = { at: string; label: string; from: string | null; to: string | null; by: string | null };

/** HQ/IT: filtered social work log (agent + Dhaka date range) with source page/group and real lead outcomes. */
export const socialLog = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => Base.extend({
    agentId: z.string().uuid().nullable().optional(),
    from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  }).parse(i))
  .handler(async ({ data }): Promise<SocialLogRow[]> => {
    const { db } = await authorityCtx(data.adminToken);
    const since = new Date(`${data.from}T00:00:00+06:00`).toISOString();
    const until = new Date(new Date(`${data.to}T00:00:00+06:00`).getTime() + 86_400_000).toISOString();
    let q = db.from("social_activity_logs")
      .select("id, agent_id, kind, page_id, link, note, reply_count, lead_id, created_at")
      .is("voided_at", null).gte("created_at", since).lt("created_at", until)
      .order("created_at", { ascending: false }).limit(5000);
    if (data.agentId) q = q.eq("agent_id", data.agentId);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    const list = rows ?? [];
    const agentIds = [...new Set(list.map((r) => r.agent_id))];
    const pageIds = [...new Set(list.map((r) => r.page_id).filter(Boolean))] as string[];
    const leadIds = [...new Set(list.map((r) => r.lead_id).filter(Boolean))] as string[];
    const empty = Promise.resolve({ data: [] as never[] });
    const [{ data: people }, { data: pages }, { data: leads }, { data: visits }, { data: bookings }, { data: changes }] = await Promise.all([
      agentIds.length ? db.from("profiles").select("id, name").in("id", agentIds) : empty,
      pageIds.length ? db.from("social_pages").select("id, name").in("id", pageIds) : empty,
      leadIds.length ? db.from("leads").select("id, name, status").in("id", leadIds) : empty,
      leadIds.length ? db.from("site_visits").select("lead_id, created_at, status").in("lead_id", leadIds) : empty,
      leadIds.length ? db.from("bookings").select("lead_id, created_at, approval_status").in("lead_id", leadIds) : empty,
      leadIds.length ? db.from("lead_state_changes").select("lead_id, field, old_value, new_value, changed_by, changed_at")
        .in("lead_id", leadIds).order("changed_at", { ascending: true }).limit(20000) : empty,
    ]);
    const hist = new Map<string, SocialLeadEvent[]>();
    const push = (id: string | null, e: SocialLeadEvent) => { if (!id) return; const a = hist.get(id) ?? []; a.push(e); hist.set(id, a); };
    const byIds = [...new Set((changes ?? []).map((c: { changed_by: string | null }) => c.changed_by).filter(Boolean))] as string[];
    const { data: changers } = byIds.length ? await db.from("profiles").select("id, name").in("id", byIds) : { data: [] as { id: string; name: string }[] };
    const cn = new Map((changers ?? []).map((p: { id: string; name: string }) => [p.id, p.name]));
    for (const c of (changes ?? []) as { lead_id: string; field: string; old_value: string | null; new_value: string | null; changed_by: string | null; changed_at: string }[])
      push(c.lead_id, { at: c.changed_at, label: c.field, from: c.old_value, to: c.new_value, by: c.changed_by ? cn.get(c.changed_by) ?? null : null });
    for (const v of (visits ?? []) as { lead_id: string | null; created_at: string; status: string | null }[])
      push(v.lead_id, { at: v.created_at, label: "site_visit", from: null, to: v.status, by: null });
    for (const b of (bookings ?? []) as { lead_id: string | null; created_at: string; approval_status: string | null }[])
      push(b.lead_id, { at: b.created_at, label: "booking", from: null, to: b.approval_status, by: null });
    for (const a of hist.values()) a.sort((x, y) => x.at.localeCompare(y.at));
    const pn = new Map((people ?? []).map((p: { id: string; name: string }) => [p.id, p.name]));
    const sn = new Map((pages ?? []).map((p: { id: string; name: string }) => [p.id, p.name]));
    const ln = new Map((leads ?? []).map((l: { id: string; name: string | null; status: string | null }) => [l.id, l]));
    const vs = new Set((visits ?? []).map((v: { lead_id: string | null }) => v.lead_id));
    const bs = new Set((bookings ?? []).map((v: { lead_id: string | null }) => v.lead_id));
    return list.map((r) => {
      const l = r.lead_id ? ln.get(r.lead_id) : undefined;
      return {
        id: r.id, createdAt: r.created_at, agentId: r.agent_id, agentName: pn.get(r.agent_id) ?? "—", kind: r.kind,
        source: r.page_id ? sn.get(r.page_id) ?? null : null, link: r.link, replies: r.reply_count, note: r.note,
        leadId: r.lead_id, leadName: l?.name ?? null, leadStatus: l?.status ?? null,
        visited: Boolean(r.lead_id && vs.has(r.lead_id)), booked: Boolean(r.lead_id && bs.has(r.lead_id)),
        history: r.lead_id ? hist.get(r.lead_id) ?? [] : [],
      };
    });
  });

/** CSV with a BOM so Excel opens Bengali text correctly. */
export function socialLogCsv(rows: SocialLogRow[]): string {
  const esc = safeCsvCell;
  const head = ["date_dhaka", "agent", "kind", "source_page_group", "link", "replies", "lead", "lead_status", "site_visit", "booking", "note"];
  const body = rows.map((r) => [
    new Date(new Date(r.createdAt).getTime() + 6 * 3_600_000).toISOString().slice(0, 16).replace("T", " "),
    r.agentName, r.kind, r.source, r.link, r.replies, r.leadName, r.leadStatus,
    r.leadId ? (r.visited ? "yes" : "no") : "", r.leadId ? (r.booked ? "yes" : "no") : "", r.note,
  ].map(esc).join(","));
  return "\uFEFF" + [head.join(","), ...body].join("\r\n");
}

export const saveSocialPage = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => Base.extend({
    id: z.string().uuid().nullable().optional(), name: z.string().trim().min(1).max(120),
    kind: z.enum(["page", "group"]), url: Link.nullable().optional().or(z.literal("").transform(() => null)), active: z.boolean().default(true),
  }).parse(i))
  .handler(async ({ data }) => {
    const { db, caller } = await authorityCtx(data.adminToken, true);
    const row = { name: data.name, kind: data.kind, url: data.url ?? null, active: data.active };
    let before: { name: string; kind: string; url: string | null; active: boolean } | null = null;
    if (data.id) {
      const { data: prev } = await db.from("social_pages").select("name, kind, url, active").eq("id", data.id).maybeSingle();
      if (!prev) throw new Error("পেজ পাওয়া যায়নি");
      before = prev;
    }
    const { data: saved, error } = data.id
      ? await db.from("social_pages").update(row).eq("id", data.id).select("id").single()
      : await db.from("social_pages").insert(row).select("id").single();
    if (error) throw new Error(error.message);
    const changes = before
      ? (Object.keys(row) as (keyof typeof row)[])
          .filter((k) => before![k] !== row[k])
          .map((k) => ({ field: k, from: before![k], to: row[k] }))
      : (Object.keys(row) as (keyof typeof row)[]).map((k) => ({ field: k, from: null, to: row[k] }));
    if (changes.length) {
      const { logAudit } = await import("@/lib/audit.server");
      await logAudit({
        action: before ? "social_page_updated" : "social_page_created",
        entityType: "social_page",
        entityId: saved.id,
        actorProfileId: caller.profile?.id ?? null,
        actorLabel: caller.profile?.name ?? "HQ/IT PIN",
        metadata: { changes },
      });
    }
    return { ok: true };
  });

export const saveSocialTemplate = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => Base.extend({
    id: z.string().uuid().nullable().optional(), title: z.string().trim().min(1).max(120),
    body: z.string().trim().min(1).max(2000), active: z.boolean().default(true),
  }).parse(i))
  .handler(async ({ data }) => {
    const { db } = await authorityCtx(data.adminToken, true);
    const row = { title: data.title, body: data.body, active: data.active, updated_at: new Date().toISOString() };
    const { error } = data.id ? await db.from("social_reply_templates").update(row).eq("id", data.id) : await db.from("social_reply_templates").insert(row);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export type SocialPageAuditRow = {
  id: string; at: string; pageId: string | null; pageName: string; action: string; by: string;
  changes: { field: string; from: string | boolean | null; to: string | boolean | null }[];
};

/** HQ/IT: who changed a page/group's name, link or active state, and when (append-only audit_logs). */
export const socialPageAudit = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => Base.parse(i))
  .handler(async ({ data }): Promise<SocialPageAuditRow[]> => {
    const { db } = await authorityCtx(data.adminToken);
    const { data: rows, error } = await db.from("audit_logs")
      .select("id, created_at, entity_id, action, actor_label, metadata")
      .eq("entity_type", "social_page").order("created_at", { ascending: false }).limit(300);
    if (error) throw new Error(error.message);
    const ids = [...new Set((rows ?? []).map((r) => r.entity_id).filter(Boolean))] as string[];
    const { data: pages } = ids.length ? await db.from("social_pages").select("id, name").in("id", ids) : { data: [] as { id: string; name: string }[] };
    const pn = new Map((pages ?? []).map((p) => [p.id, p.name]));
    return (rows ?? []).map((r) => ({
      id: r.id, at: r.created_at, pageId: r.entity_id, pageName: (r.entity_id && pn.get(r.entity_id)) || "—",
      action: r.action, by: r.actor_label ?? "—",
      changes: ((r.metadata as { changes?: SocialPageAuditRow["changes"] } | null)?.changes) ?? [],
    }));
  });

export type SocialPageSummary = {
  pageId: string; name: string; kind: string; active: boolean;
  entries: number; replies: number; leads: number; visits: number; bookings: number; closed: number; conversion: number;
};

/** HQ/IT: per page/group — work logged, leads made, site visits, bookings and conversion (real rows only). */
export const socialPageSummary = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => Base.extend({
    from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  }).parse(i))
  .handler(async ({ data }): Promise<SocialPageSummary[]> => {
    const { db } = await authorityCtx(data.adminToken);
    const since = new Date(`${data.from}T00:00:00+06:00`).toISOString();
    const until = new Date(new Date(`${data.to}T00:00:00+06:00`).getTime() + 86_400_000).toISOString();
    const [{ data: pages, error: pe }, { data: rows, error }] = await Promise.all([
      db.from("social_pages").select("id, name, kind, active").order("name"),
      db.from("social_activity_logs").select("page_id, reply_count, lead_id")
        .is("voided_at", null).gte("created_at", since).lt("created_at", until).limit(20000),
    ]);
    if (pe || error) throw new Error((pe ?? error)!.message);
    const leadIds = [...new Set((rows ?? []).map((r) => r.lead_id).filter(Boolean))] as string[];
    const empty = Promise.resolve({ data: [] as never[] });
    const [{ data: visits }, { data: bookings }, { data: leads }] = await Promise.all([
      leadIds.length ? db.from("site_visits").select("lead_id").in("lead_id", leadIds) : empty,
      leadIds.length ? db.from("bookings").select("lead_id, approval_status").in("lead_id", leadIds) : empty,
      leadIds.length ? db.from("leads").select("id, status").in("id", leadIds) : empty,
    ]);
    const vs = new Set((visits ?? []).map((v: { lead_id: string | null }) => v.lead_id));
    const bs = new Set((bookings ?? []).filter((b: { approval_status: string | null }) => b.approval_status !== "rejected").map((b: { lead_id: string | null }) => b.lead_id));
    const cs = new Set((leads ?? []).filter((l: { status: string | null }) => l.status === "closed").map((l: { id: string }) => l.id));
    const out = new Map<string, SocialPageSummary & { _l: Set<string> }>();
    for (const p of pages ?? []) out.set(p.id, { pageId: p.id, name: p.name, kind: p.kind, active: p.active, entries: 0, replies: 0, leads: 0, visits: 0, bookings: 0, closed: 0, conversion: 0, _l: new Set() });
    for (const r of rows ?? []) {
      const a = r.page_id ? out.get(r.page_id) : undefined;
      if (!a) continue;
      a.entries += 1; a.replies += r.reply_count ?? 0;
      if (r.lead_id) a._l.add(r.lead_id);
    }
    return [...out.values()].map(({ _l, ...a }) => {
      const ls = [..._l];
      const bookingsN = ls.filter((id) => bs.has(id)).length;
      return { ...a, leads: ls.length, visits: ls.filter((id) => vs.has(id)).length, bookings: bookingsN,
        closed: ls.filter((id) => cs.has(id)).length, conversion: ls.length ? Math.round((bookingsN / ls.length) * 100) : 0 };
    }).sort((x, y) => y.leads - x.leads || y.entries - x.entries);
  });

export type SocialPageDailyPoint = { date: string; leads: number; bookings: number; conversion: number };
export type SocialPageDaily = { pageId: string; name: string; points: SocialPageDailyPoint[] };

/** HQ/IT: per page/group, per Dhaka date — leads made and conversion (booked ÷ leads) for trend charts. */
export const socialPageDaily = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => Base.extend({
    from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  }).parse(i))
  .handler(async ({ data }): Promise<SocialPageDaily[]> => {
    const { db } = await authorityCtx(data.adminToken);
    const since = new Date(`${data.from}T00:00:00+06:00`).toISOString();
    const until = new Date(new Date(`${data.to}T00:00:00+06:00`).getTime() + 86_400_000).toISOString();
    const [{ data: pages, error: pe }, { data: rows, error }] = await Promise.all([
      db.from("social_pages").select("id, name").order("name"),
      db.from("social_activity_logs").select("page_id, lead_id, created_at")
        .is("voided_at", null).not("lead_id", "is", null)
        .gte("created_at", since).lt("created_at", until).limit(20000),
    ]);
    if (pe || error) throw new Error((pe ?? error)!.message);
    const leadIds = [...new Set((rows ?? []).map((r) => r.lead_id).filter(Boolean))] as string[];
    const { data: bookings } = leadIds.length
      ? await db.from("bookings").select("lead_id, approval_status").in("lead_id", leadIds)
      : { data: [] as { lead_id: string | null; approval_status: string | null }[] };
    const bs = new Set((bookings ?? []).filter((b) => b.approval_status !== "rejected").map((b) => b.lead_id));
    const dhakaDay = (iso: string) => new Date(new Date(iso).getTime() + 6 * 3_600_000).toISOString().slice(0, 10);
    const byPage = new Map<string, Map<string, { leads: Set<string>; booked: Set<string> }>>();
    for (const r of rows ?? []) {
      if (!r.page_id || !r.lead_id) continue;
      const day = dhakaDay(r.created_at);
      const pm = byPage.get(r.page_id) ?? new Map();
      const d = pm.get(day) ?? { leads: new Set<string>(), booked: new Set<string>() };
      d.leads.add(r.lead_id);
      if (bs.has(r.lead_id)) d.booked.add(r.lead_id);
      pm.set(day, d);
      byPage.set(r.page_id, pm);
    }
    return (pages ?? []).map((p) => {
      const pm = byPage.get(p.id);
      const points: SocialPageDailyPoint[] = pm
        ? [...pm.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([date, d]) => ({
            date, leads: d.leads.size, bookings: d.booked.size,
            conversion: d.leads.size ? Math.round((d.booked.size / d.leads.size) * 100) : 0,
          }))
        : [];
      return { pageId: p.id, name: p.name, points };
    }).filter((p) => p.points.length > 0);
  });
