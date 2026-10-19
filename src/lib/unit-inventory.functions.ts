import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/**
 * Unit inventory matrix + WhatsApp qualification feed. Server-only; caller resolved via siCaller.
 * Units live in app_config id 'unit_inventory' (HQ/IT write, everyone signed-in reads); units are never removed — mark Blocked.
 */
const Token = z.string().nullable().optional();
export const UNIT_STATUSES = ["available", "booked", "sold", "blocked"] as const;
export const UNIT_KINDS = ["apartment", "commercial", "plot"] as const;
export type Unit = {
  id: string; projectId: string; projectName: string; code: string; kind: (typeof UNIT_KINDS)[number]; floor: string | null;
  sizeSqft: number | null; sizeKatha: number | null; bedrooms: number | null; bathrooms: number | null; priceBdt: number | null;
  status: (typeof UNIT_STATUSES)[number]; updatedBy: string; updatedAt: string;
};
const KEY = "unit_inventory";

async function load() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin.from("app_config").select("data").eq("id", KEY).maybeSingle();
  return { db: supabaseAdmin, units: ((data?.data as { units?: Unit[] } | null)?.units ?? []) as Unit[] };
}

export const listUnits = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ adminToken: Token }).parse(i ?? {}))
  .handler(async ({ data }) => {
    const { siCaller } = await import("@/lib/sales-intel.server");
    const c = await siCaller(data.adminToken).catch(() => null);
    if (!c) return { canEdit: false, units: [] as Unit[], projects: [] as { id: string; name: string; location: string | null }[] };
    const { db, units } = await load();
    const { data: projects } = await db.from("project_catalog").select("id, name, location").eq("status", "active").order("name");
    return { canEdit: c.scope === "authority" && !c.readOnly, units, projects: projects ?? [] };
  });

const n = (max: number) => z.number().nonnegative().max(max).nullish().transform((v) => v ?? null);
export const saveUnit = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z.object({
      adminToken: Token, id: z.string().uuid().nullish(), projectId: z.string().uuid(), code: z.string().trim().min(1).max(40),
      kind: z.enum(UNIT_KINDS), floor: z.string().trim().max(20).nullish().transform((v) => v || null),
      sizeSqft: n(1_000_000), sizeKatha: n(10_000), bedrooms: n(20), bathrooms: n(20), priceBdt: n(100_000_000_000),
      status: z.enum(UNIT_STATUSES),
    }).parse(i),
  )
  .handler(async ({ data }) => {
    const { siCaller, requireAdminWriter } = await import("@/lib/sales-intel.server");
    const c = await siCaller(data.adminToken);
    requireAdminWriter(c);
    const { db, units } = await load();
    const { data: p } = await db.from("project_catalog").select("id, name").eq("id", data.projectId).maybeSingle();
    if (!p) throw new Error("Project not found / প্রজেক্ট পাওয়া যায়নি");
    if (units.some((u) => u.projectId === data.projectId && u.code.toLowerCase() === data.code.toLowerCase() && u.id !== data.id))
      throw new Error("Unit code already exists / এই ইউনিট কোড আছে");
    const prev = data.id ? units.find((u) => u.id === data.id) : undefined;
    if (data.id && !prev) throw new Error("Unit not found");
    const unit: Unit = {
      id: data.id ?? crypto.randomUUID(), projectId: p.id, projectName: p.name, code: data.code, kind: data.kind, floor: data.floor,
      sizeSqft: data.sizeSqft, sizeKatha: data.sizeKatha, bedrooms: data.bedrooms, bathrooms: data.bathrooms, priceBdt: data.priceBdt,
      status: data.status, updatedBy: c.actor, updatedAt: new Date().toISOString(),
    };
    const next = prev ? units.map((u) => (u.id === unit.id ? unit : u)) : [...units, unit];
    const { error } = await db.from("app_config").upsert({ id: KEY, data: { units: next }, updated_at: unit.updatedAt });
    if (error) throw new Error("Unit not saved / সংরক্ষণ হয়নি");
    await db.from("audit_logs").insert({
      action: prev ? "unit_updated" : "unit_created", entity_type: "project_unit", entity_id: null,
      actor_profile_id: c.agentId, actor_label: c.actor,
      metadata: { unitId: unit.id, unit: unit.code, project: p.name, from: prev?.status ?? null, to: unit.status },
    });
    return { ok: true };
  });

/** Recent customer WhatsApp messages per lead, scoped to the caller (agents: own leads only). */
export const whatsappQualificationFeed = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ adminToken: Token }).parse(i ?? {}))
  .handler(async ({ data }) => {
    const { siCaller } = await import("@/lib/sales-intel.server");
    const c = await siCaller(data.adminToken).catch(() => null);
    if (!c) return { rows: [] as { leadId: string; name: string; messages: string[]; lastAt: string }[] };
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
    const since = new Date(Date.now() - 30 * 86_400_000).toISOString();
    let q = db.from("whatsapp_interactions").select("lead_id, message_content, created_at").eq("sender_type", "customer").eq("message_type", "text").gte("created_at", since).order("created_at").limit(2000);
    if (c.scope === "agent") {
      const { data: own } = await db.from("leads").select("id").eq("assigned_agent_id", c.agentId!).limit(5000);
      const ids = (own ?? []).map((l) => l.id);
      if (!ids.length) return { rows: [] };
      q = q.in("lead_id", ids.slice(0, 500));
    }
    const { data: msgs, error } = await q;
    if (error) throw new Error("WhatsApp messages unavailable");
    const by = new Map<string, { messages: string[]; lastAt: string }>();
    for (const m of msgs ?? []) {
      if (!m.lead_id || !m.message_content) continue;
      const e = by.get(m.lead_id) ?? { messages: [], lastAt: m.created_at };
      e.messages.push(String(m.message_content).slice(0, 1000)); e.lastAt = m.created_at; by.set(m.lead_id, e);
    }
    const ids = [...by.keys()].slice(0, 300);
    if (!ids.length) return { rows: [] };
    const { data: leads } = await db.from("leads").select("id, name").in("id", ids);
    const names = new Map((leads ?? []).map((l) => [l.id, l.name ?? "—"]));
    return { rows: ids.map((id) => ({ leadId: id, name: names.get(id) ?? "—", ...by.get(id)! })) };
  });
