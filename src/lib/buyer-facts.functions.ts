import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/** Saved CRM facts for the buyer-check template. Agents: own leads only; HQ/IT: any. */
export const getBuyerCheckFacts = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z.object({ token: z.string().nullable().optional(), leadId: z.string().uuid() }).parse(i),
  )
  .handler(async ({ data }) => {
    const { resolveCaller } = await import("@/lib/access.server");
    const c = await resolveCaller(data.token ?? null);
    if (c.scope !== "authority" && (c.scope !== "agent" || !c.profile)) throw new Error("Sign in required");
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
    const { data: lead, error } = await db
      .from("leads")
      .select("name, area, address, temperature, grade, call_attempts, last_call_at, assigned_to")
      .eq("id", data.leadId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!lead || (c.scope === "agent" && lead.assigned_to !== c.profile!.id)) throw new Error("This lead is not assigned to you");
    const { data: rep } = await db
      .from("call_reports")
      .select("requirement, interest, customer_response, next_action")
      .eq("lead_id", data.leadId)
      .eq("status", "submitted")
      .order("submitted_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    return {
      name: lead.name ?? null,
      area: lead.area ?? lead.address ?? null,
      temperature: lead.temperature ?? null,
      grade: lead.grade ?? null,
      attempts: lead.call_attempts ?? 0,
      lastCallAt: lead.last_call_at ?? null,
      requirement: rep?.requirement ?? null,
      interest: rep?.interest ?? null,
      customerResponse: rep?.customer_response ?? null,
      nextAction: rep?.next_action ?? null,
    };
  });
