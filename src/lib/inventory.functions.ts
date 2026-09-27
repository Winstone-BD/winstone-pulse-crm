import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/**
 * Winstone inventory requirement list — the options agents pick as "Requirement"
 * in the post-call Smart Report. Every signed-in staff member may read the
 * active list; only HQ/IT (authority) or coordinators may change it.
 */
const Base = z.object({ adminToken: z.string().nullable().optional() });

export const listInventory = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    Base.extend({ includeInactive: z.boolean().optional() }).parse(input),
  )
  .handler(async ({ data }) => {
    const { resolveCaller, canDispatch } = await import("@/lib/access.server");
    const caller = await resolveCaller(data.adminToken ?? null);
    if (caller.scope === "none") throw new Error("অনুমোদিত অ্যাকাউন্ট দিয়ে সাইন ইন করুন");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let query = supabaseAdmin
      .from("inventory_requirements")
      .select("id, label, active, sort_order")
      .order("sort_order", { ascending: true })
      .order("label", { ascending: true });
    if (!(data.includeInactive && canDispatch(caller))) query = query.eq("active", true);
    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);
    return { items: rows ?? [], canManage: canDispatch(caller) };
  });

export const saveInventory = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    Base.extend({
      id: z.string().uuid().nullable().optional(),
      label: z.string().trim().min(2).max(60).optional(),
      active: z.boolean().optional(),
      sortOrder: z.number().int().min(0).max(10000).optional(),
    }).parse(input),
  )
  .handler(async ({ data }) => {
    const { resolveCaller, requireDispatch } = await import("@/lib/access.server");
    const caller = await resolveCaller(data.adminToken ?? null);
    requireDispatch(caller);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (data.id) {
      const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (data.label !== undefined) patch["label"] = data.label;
      if (data.active !== undefined) patch["active"] = data.active;
      if (data.sortOrder !== undefined) patch["sort_order"] = data.sortOrder;
      const { error } = await supabaseAdmin
        .from("inventory_requirements")
        .update(patch)
        .eq("id", data.id);
      if (error) throw new Error(error.message);
      return { ok: true };
    }
    if (!data.label) throw new Error("নাম লিখুন");
    const { error } = await supabaseAdmin.from("inventory_requirements").insert({
      label: data.label,
      sort_order: data.sortOrder ?? 100,
      created_by: caller.profile?.id ?? null,
    });
    if (error) {
      if (error.code === "23505") throw new Error("এই নামটি আগেই তালিকায় আছে");
      throw new Error(error.message);
    }
    return { ok: true };
  });
