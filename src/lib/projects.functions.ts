import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/**
 * HQ-controlled project catalog + append-only sales updates and discussion notes.
 * Server-only tables: caller always resolved on the server (siCaller).
 * HQ/IT edit the catalog; agents read it and log updates only on their own leads.
 */
const Token = z.string().nullable().optional();
const txt = (n: number) => z.string().trim().max(n).nullish().transform((v) => v ?? null);
export const INTERESTS = ["interested", "negotiating", "not_now"] as const;
export const FACINGS = ["north", "south", "east", "west", "north_east", "north_west", "south_east", "south_west"] as const;
export const AMENITIES = ["lift", "generator", "parking", "gas", "security", "rooftop", "gym", "pool", "community_hall", "near_school", "near_hospital", "main_road"] as const;
const filterFields = {
  price_min: z.number().nonnegative().max(100_000_000_000).nullish().transform((v) => v ?? null),
  price_max: z.number().nonnegative().max(100_000_000_000).nullish().transform((v) => v ?? null),
  facing: z.array(z.enum(FACINGS)).max(8).default([]),
  amenities: z.array(z.enum(AMENITIES)).max(20).default([]),
};
export const PARTIES = ["client", "land_owner", "flat_seller"] as const;

export type CatalogProject = {
  id: string; name: string; location: string | null; status: string; price_per_sqft: number | null;
  unit_sizes: string | null; total_price: string | null; down_payment: string | null; installment_plan: string | null;
  parking_charge: string | null; extra_charges: string | null; notes: string | null; image_url: string | null;
  price_min: number | null; price_max: number | null; facing: string[]; amenities: string[]; updated_by: string; updated_at: string;
};

async function ctx(token: string | null | undefined) {
  const { siCaller } = await import("@/lib/sales-intel.server");
  const c = await siCaller(token);
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return { c, db: supabaseAdmin };
}

/**
 * HQ audit: who saw project photos and when. At most one row per viewer per
 * 30 minutes (page refreshes would otherwise flood the log). Best-effort.
 */
async function logPhotoView(
  db: Awaited<ReturnType<typeof ctx>>["db"],
  c: { scope: string; agentId: string | null; actor: string },
  names: string[],
) {
  const since = new Date(Date.now() - 30 * 60_000).toISOString();
  let recent = db.from("audit_logs").select("id").eq("action", "project_photos_viewed").gte("created_at", since).limit(1);
  recent = c.agentId ? recent.eq("actor_profile_id", c.agentId) : recent.is("actor_profile_id", null).eq("actor_label", c.actor);
  const { data } = await recent;
  if (data?.length) return;
  const { logAudit } = await import("@/lib/audit.server");
  await logAudit({
    action: "project_photos_viewed", entityType: "project_catalog", entityId: null,
    actorProfileId: c.agentId, actorLabel: c.actor,
    metadata: { scope: c.scope, photo_count: names.length, projects: names.slice(0, 50), link_lifetime_seconds: 3600 },
  });
}

export const listProjects = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ adminToken: Token }).parse(i ?? {}))
  .handler(async ({ data }) => {
    const { siCaller } = await import("@/lib/sales-intel.server");
    const c = await siCaller(data.adminToken).catch(() => null);
    if (!c) return { canEdit: false, projects: [] as CatalogProject[] };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let q = supabaseAdmin.from("project_catalog").select("*").order("name");
    if (c.scope === "agent") q = q.eq("status", "active");
    const { data: rows, error } = await q;
    if (error) throw new Error("প্রজেক্ট তালিকা পড়া যায়নি");
    const projects = (rows ?? []) as CatalogProject[];
    // Private bucket: swap storage:project-photos/<path> for a short-lived signed URL.
    // Only reachable after siCaller authenticated the caller; anonymous callers get [].
    await Promise.all(projects.map(async (p) => {
      if (!p.image_url?.startsWith("storage:project-photos/")) return;
      const path = p.image_url.slice("storage:project-photos/".length);
      const { data: s } = await supabaseAdmin.storage.from("project-photos").createSignedUrl(path, 120);
      p.image_url = s?.signedUrl ?? null;
    }));
    const shown = projects.filter((p) => p.image_url?.includes("/object/sign/project-photos/"));
    if (shown.length) await logPhotoView(supabaseAdmin, c, shown.map((p) => p.name)).catch(() => undefined);
    return { canEdit: c.scope === "authority", projects };
  });

export const saveProject = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z.object({
      adminToken: Token,
      id: z.string().uuid().optional().nullable(),
      name: z.string().trim().min(2).max(120),
      location: txt(200), status: z.enum(["active", "archived"]).default("active"),
      price_per_sqft: z.number().nonnegative().max(10_000_000).nullish().transform((v) => v ?? null),
      unit_sizes: txt(300), total_price: txt(300), down_payment: txt(300), installment_plan: txt(500),
      parking_charge: txt(200), extra_charges: txt(500), notes: txt(1000), image_url: txt(500), ...filterFields,
    }).refine((v) => v.price_min == null || v.price_max == null || v.price_min <= v.price_max, { message: "price_min > price_max" }).parse(i),
  )
  .handler(async ({ data }) => {
    const { c, db } = await ctx(data.adminToken);
    const { requireAdminWriter } = await import("@/lib/sales-intel.server");
    requireAdminWriter(c);
    const { adminToken: _t, id, ...rest } = data;
    const row = { ...rest, updated_by: c.actor };
    const res = id ? await db.from("project_catalog").update(row).eq("id", id).select("id") : await db.from("project_catalog").insert(row).select("id");
    if (res.error || !res.data?.length) throw new Error(res.error?.code === "23505" ? "এই নামে প্রজেক্ট আছে" : "প্রজেক্ট সংরক্ষণ হয়নি");
    return { ok: true };
  });

export const leadProjectActivity = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ adminToken: Token, leadId: z.string().uuid() }).parse(i))
  .handler(async ({ data }) => {
    const { c, db } = await ctx(data.adminToken);
    const { leadForCaller } = await import("@/lib/sales-intel.server");
    await leadForCaller(db, c, data.leadId);
    const [u, n] = await Promise.all([
      db.from("project_sales_updates").select("id, project_id, interest, offered_price, note, created_by, created_at").eq("lead_id", data.leadId).order("created_at", { ascending: false }).limit(50),
      db.from("project_discussion_notes").select("id, project_id, party, note, created_by, created_at").eq("lead_id", data.leadId).order("created_at", { ascending: false }).limit(50),
    ]);
    if (u.error || n.error) throw new Error("প্রজেক্ট আপডেট পড়া যায়নি");
    return { updates: u.data ?? [], notes: n.data ?? [] };
  });

export const addSalesUpdate = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z.object({
      adminToken: Token, leadId: z.string().uuid(), projectId: z.string().uuid(),
      interest: z.enum(INTERESTS), offeredPrice: z.number().positive().max(100_000_000_000).optional().nullable(), note: txt(500),
    }).parse(i),
  )
  .handler(async ({ data }) => {
    const { c, db } = await ctx(data.adminToken);
    const { leadForCaller } = await import("@/lib/sales-intel.server");
    const lead = await leadForCaller(db, c, data.leadId);
    if (c.scope === "agent") {
      const { assertAgentBriefing } = await import("@/lib/agent-briefing.server");
      await assertAgentBriefing(c.agentId!);
    }
    const { data: p } = await db.from("project_catalog").select("id").eq("id", data.projectId).eq("status", "active").maybeSingle();
    if (!p) throw new Error("প্রজেক্ট পাওয়া যায়নি");
    const { error } = await db.from("project_sales_updates").insert({
      lead_id: data.leadId, project_id: data.projectId,
      agent_id: c.scope === "agent" ? c.agentId : ((lead as { assigned_agent_id?: string | null }).assigned_agent_id ?? null),
      interest: data.interest, offered_price: data.offeredPrice ?? null, note: data.note || null, created_by: c.actor,
    });
    if (error) throw new Error("বিক্রির আপডেট সংরক্ষণ হয়নি");
    return { ok: true };
  });

export const listProjectNotes = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ adminToken: Token, projectId: z.string().uuid() }).parse(i))
  .handler(async ({ data }) => {
    const { c, db } = await ctx(data.adminToken);
    let q = db.from("project_discussion_notes").select("id, party, lead_id, note, created_by, created_at").eq("project_id", data.projectId);
    // Agents: owner notes for the project + client notes on their own leads only.
    if (c.scope === "agent") q = q.or(`party.neq.client,agent_id.eq.${c.agentId}`);
    const { data: rows, error } = await q.order("created_at", { ascending: false }).limit(200);
    if (error) throw new Error("নোট পড়া যায়নি");
    return rows ?? [];
  });

export const addProjectNote = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z.object({ adminToken: Token, projectId: z.string().uuid(), party: z.enum(PARTIES), leadId: z.string().uuid().optional().nullable(), note: z.string().trim().min(2).max(1000) }).parse(i),
  )
  .handler(async ({ data }) => {
    const { c, db } = await ctx(data.adminToken);
    if (data.party === "client" && !data.leadId) throw new Error("ক্লায়েন্ট নোটে লিড দরকার");
    if (data.party !== "client" && c.scope !== "authority") throw new Error("মালিকের সঙ্গে আলোচনার নোট শুধু HQ/IT লিখতে পারে");
    let agentId: string | null = c.scope === "agent" ? c.agentId : null;
    if (data.leadId) {
      const { leadForCaller } = await import("@/lib/sales-intel.server");
      const lead = await leadForCaller(db, c, data.leadId);
      agentId ??= (lead as { assigned_agent_id?: string | null }).assigned_agent_id ?? null;
    }
    const { error } = await db.from("project_discussion_notes").insert({
      project_id: data.projectId, party: data.party, lead_id: data.leadId ?? null, agent_id: agentId, note: data.note, created_by: c.actor,
    });
    if (error) throw new Error("নোট সংরক্ষণ হয়নি");
    return { ok: true };
  });

/* ---------------- Bulk import (HQ/IT only) ---------------- */

const importRow = z.object({
  name: z.string().trim().min(2).max(120),
  location: txt(200), status: z.enum(["active", "archived"]).default("active"),
  price_per_sqft: z.number().nonnegative().max(10_000_000).nullish().transform((v) => v ?? null),
  unit_sizes: txt(300), total_price: txt(300), down_payment: txt(300), installment_plan: txt(500),
  parking_charge: txt(200), extra_charges: txt(500), notes: txt(1000), image_url: txt(500),
});

/** Insert new projects, update existing ones matched by name (case-insensitive). Never deletes. */
export const importProjects = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ adminToken: Token, rows: z.array(z.unknown()).min(1).max(300) }).parse(i))
  .handler(async ({ data }) => {
    const { c, db } = await ctx(data.adminToken);
    const { requireAdminWriter } = await import("@/lib/sales-intel.server");
    requireAdminWriter(c);
    const { data: existing, error: e0 } = await db.from("project_catalog").select("id, name");
    if (e0) throw new Error("প্রজেক্ট তালিকা পড়া যায়নি");
    const byName = new Map((existing ?? []).map((p) => [p.name.trim().toLowerCase(), p.id]));
    const results: { row: number; name: string; outcome: "created" | "updated" | "error"; error?: string }[] = [];
    const seen = new Set<string>();
    for (const [idx, raw] of data.rows.entries()) {
      const parsed = importRow.safeParse(raw);
      const nm = String((raw as { name?: unknown })?.name ?? "").slice(0, 120);
      if (!parsed.success) { results.push({ row: idx + 2, name: nm, outcome: "error", error: parsed.error.issues.map((i) => i.path.join(".")).join(", ") }); continue; }
      const k = parsed.data.name.toLowerCase();
      if (seen.has(k)) { results.push({ row: idx + 2, name: nm, outcome: "error", error: "duplicate_in_file" }); continue; }
      seen.add(k);
      const row = { ...parsed.data, updated_by: c.actor };
      const id = byName.get(k);
      const res = id ? await db.from("project_catalog").update(row).eq("id", id).select("id") : await db.from("project_catalog").insert(row).select("id");
      if (res.error || !res.data?.length) results.push({ row: idx + 2, name: nm, outcome: "error", error: "save_failed" });
      else results.push({ row: idx + 2, name: parsed.data.name, outcome: id ? "updated" : "created" });
    }
    const { logAudit } = await import("@/lib/audit.server");
    await logAudit({ action: "project_catalog_import", entityType: "project_catalog", entityId: null, actorLabel: c.actor,
      metadata: { created: results.filter((r) => r.outcome === "created").length, updated: results.filter((r) => r.outcome === "updated").length, errors: results.filter((r) => r.outcome === "error").length } }).catch(() => undefined);
    return { results };
  });

/* ---------------- Sales update report ---------------- */

const dateKey = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullish();
/** Dhaka-day bounds → UTC ISO. */
const dhakaStart = (d: string) => new Date(`${d}T00:00:00+06:00`).toISOString();
const dhakaEnd = (d: string) => new Date(new Date(`${d}T00:00:00+06:00`).getTime() + 86_400_000).toISOString();

/** Agents see only their own updates; HQ/IT see all and can filter by agent. */
export const salesUpdatesReport = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z.object({
      adminToken: Token, from: dateKey, to: dateKey,
      projectId: z.string().uuid().nullish(), agentId: z.string().uuid().nullish(), interest: z.enum(INTERESTS).nullish(),
    }).parse(i ?? {}),
  )
  .handler(async ({ data }) => {
    const { c, db } = await ctx(data.adminToken);
    let q = db.from("project_sales_updates")
      .select("id, lead_id, project_id, agent_id, interest, offered_price, note, created_by, created_at")
      .order("created_at", { ascending: false }).limit(1000);
    if (c.scope === "agent") q = q.eq("agent_id", c.agentId!);
    else if (data.agentId) q = q.eq("agent_id", data.agentId);
    if (data.projectId) q = q.eq("project_id", data.projectId);
    if (data.interest) q = q.eq("interest", data.interest);
    if (data.from) q = q.gte("created_at", dhakaStart(data.from));
    if (data.to) q = q.lt("created_at", dhakaEnd(data.to));
    const { data: rows, error } = await q;
    if (error) throw new Error("রিপোর্ট পড়া যায়নি");
    const list = rows ?? [];
    const ids = (k: "lead_id" | "project_id" | "agent_id") => [...new Set(list.map((r) => r[k]).filter(Boolean) as string[])];
    const [leads, projects, agents] = await Promise.all([
      ids("lead_id").length ? db.from("leads").select("id, name").in("id", ids("lead_id")) : Promise.resolve({ data: [] }),
      db.from("project_catalog").select("id, name").order("name"),
      c.scope === "authority"
        ? db.from("profiles").select("id, name").eq("role", "agent").order("name")
        : db.from("profiles").select("id, name").eq("id", c.agentId!),
    ]);
    const nm = (arr: { id: string; name: string | null }[] | null | undefined) => new Map((arr ?? []).map((x) => [x.id, x.name ?? "—"]));
    const L = nm(leads.data as never), P = nm(projects.data as never), A = nm(agents.data as never);
    return {
      scope: c.scope,
      projects: (projects.data ?? []).map((p) => ({ id: p.id, name: p.name })),
      agents: (agents.data ?? []).map((a) => ({ id: a.id, name: a.name ?? "—" })),
      rows: list.map((r) => ({
        ...r, lead_name: L.get(r.lead_id) ?? "—", project_name: P.get(r.project_id) ?? "—", agent_name: r.agent_id ? (A.get(r.agent_id) ?? "—") : "—",
      })),
    };
  });
