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
