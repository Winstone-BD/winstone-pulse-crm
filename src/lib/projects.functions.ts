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
export const PARTIES = ["client", "land_owner", "flat_seller"] as const;

export type CatalogProject = {
  id: string; name: string; location: string | null; status: string; price_per_sqft: number | null;
  unit_sizes: string | null; total_price: string | null; down_payment: string | null; installment_plan: string | null;
  parking_charge: string | null; extra_charges: string | null; notes: string | null; updated_by: string; updated_at: string;
};

async function ctx(token: string | null | undefined) {
  const { siCaller } = await import("@/lib/sales-intel.server");
  const c = await siCaller(token);
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return { c, db: supabaseAdmin };
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
    return { canEdit: c.scope === "authority", projects: (rows ?? []) as CatalogProject[] };
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
      parking_charge: txt(200), extra_charges: txt(500), notes: txt(1000),
    }).parse(i),
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
