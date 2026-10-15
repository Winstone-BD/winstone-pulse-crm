import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/** Buyer progress signals from saved CRM records only. Agents: own leads; HQ/IT: any. */
export const getHandoverSignals = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ token: z.string().nullable().optional(), leadId: z.string().uuid() }).parse(i))
  .handler(async ({ data }) => {
    const { resolveCaller } = await import("@/lib/access.server");
    const c = await resolveCaller(data.token ?? null);
    if (c.scope !== "authority" && (c.scope !== "agent" || !c.profile)) throw new Error("Sign in required");
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
    const { data: lead, error } = await db.from("leads").select("assigned_to").eq("id", data.leadId).maybeSingle();
    if (error) throw new Error(error.message);
    if (!lead || (c.scope === "agent" && lead.assigned_to !== c.profile!.id)) throw new Error("This lead is not assigned to you");
    const [rep, visits, books] = await Promise.all([
      db.from("call_reports").select("id").eq("lead_id", data.leadId).eq("status", "submitted").limit(1),
      db.from("site_visits").select("status, outcome").eq("lead_id", data.leadId),
      db.from("bookings").select("status, approval_status, project, amount_usd, booked_at").eq("lead_id", data.leadId).order("booked_at", { ascending: false }).limit(1),
    ]);
    const v = visits.data ?? [];
    const b = books.data?.[0] ?? null;
    return {
      reported: (rep.data?.length ?? 0) > 0,
      visitScheduled: v.length > 0,
      visitCompleted: v.some((x) => x.status === "completed" || x.outcome != null),
      booking: b ? { status: b.status, approval: b.approval_status, project: b.project, amountUsd: b.amount_usd, at: b.booked_at } : null,
    };
  });

/** HQ/IT-only printable summary: verified progress per lead that has a visit or booking. */
export const getHandoverSummary = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ token: z.string().nullable().optional() }).parse(i))
  .handler(async ({ data }) => {
    const { resolveCaller } = await import("@/lib/access.server");
    const c = await resolveCaller(data.token ?? null);
    if (c.scope !== "authority") throw new Error("HQ/IT access required");
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
    const [visits, books] = await Promise.all([
      db.from("site_visits").select("lead_id, status, outcome").limit(2000),
      db.from("bookings").select("lead_id, approval_status, project, booked_at").order("booked_at", { ascending: false }).limit(2000),
    ]);
    if (visits.error) throw new Error(visits.error.message);
    if (books.error) throw new Error(books.error.message);
    const map = new Map<string, { scheduled: boolean; completed: boolean; booking: { approval: string; project: string | null } | null }>();
    for (const v of visits.data ?? []) {
      if (!v.lead_id) continue;
      const m = map.get(v.lead_id) ?? { scheduled: false, completed: false, booking: null };
      m.scheduled = true; if (v.status === "completed" || v.outcome != null) m.completed = true;
      map.set(v.lead_id, m);
    }
    for (const b of books.data ?? []) {
      if (!b.lead_id) continue;
      const m = map.get(b.lead_id) ?? { scheduled: false, completed: false, booking: null };
      if (!m.booking) m.booking = { approval: String(b.approval_status), project: b.project ?? null };
      map.set(b.lead_id, m);
    }
    const ids = [...map.keys()];
    const leads = ids.length ? (await db.from("leads").select("id, name, phone_number, assigned_to").in("id", ids.slice(0, 1000))).data ?? [] : [];
    const owners = [...new Set(leads.map((l) => l.assigned_to).filter(Boolean))] as string[];
    const profs = owners.length ? (await db.from("profiles").select("id, full_name").in("id", owners)).data ?? [] : [];
    const pn = new Map(profs.map((p) => [p.id, p.full_name]));
    return leads.map((l) => ({ id: l.id, name: l.name, phone: l.phone_number, agent: l.assigned_to ? pn.get(l.assigned_to) ?? null : null, ...map.get(l.id)! }));
  });
