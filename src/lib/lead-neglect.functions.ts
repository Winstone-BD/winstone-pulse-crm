import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const TokenInput = z.object({ adminToken: z.string().nullable().optional() });

/** Agent: own neglect warnings (last 7 days) and recall disputes. */
export const myNeglect = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => TokenInput.parse(input))
  .handler(async ({ data }) => {
    const { resolveCaller } = await import("@/lib/access.server");
    const caller = await resolveCaller(data.adminToken ?? null);
    if (caller.scope !== "agent" || !caller.profile) return { notices: [], disputes: [] };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const since = new Date(Date.now() - 7 * 86_400_000).toISOString();
    const [n, d] = await Promise.all([
      supabaseAdmin
        .from("lead_neglect_notices")
        .select("id, notice_day, business_date, lead:leads(id, name)")
        .eq("agent_id", caller.profile.id)
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(100),
      supabaseAdmin
        .from("lead_neglect_recalls")
        .select("id, business_date, reason, recalled_at, lead:leads(id, name)")
        .eq("agent_id", caller.profile.id)
        .order("recalled_at", { ascending: false })
        .limit(50),
    ]);
    return { notices: n.data ?? [], disputes: d.data ?? [] };
  });

/** HQ + IT: neglect disputes across agents. */
export const listNeglectDisputes = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => TokenInput.parse(input))
  .handler(async ({ data }) => {
    const { resolveCaller } = await import("@/lib/access.server");
    const caller = await resolveCaller(data.adminToken ?? null);
    if (caller.scope !== "authority") throw new Error("Executive HQ or IT access required");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("lead_neglect_recalls")
      .select("id, business_date, reason, recalled_at, assigned_at, agent:profiles(name, employee_id), lead:leads(id, name)")
      .order("recalled_at", { ascending: false })
      .limit(300);
    if (error) throw new Error(error.message);
    return { disputes: rows ?? [] };
  });
