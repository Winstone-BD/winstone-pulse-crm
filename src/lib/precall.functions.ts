import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const Input = z.object({
  token: z.string().nullable().optional(),
  leadId: z.string().uuid(),
  ai: z.boolean().optional(),
});

/** Same ownership rule for both briefs: agents only for their own assigned lead. */
async function authorize(token: string | null, leadId: string) {
  const { resolveCaller } = await import("@/lib/access.server");
  const caller = await resolveCaller(token);
  if (caller.scope === "none") throw new Error("ব্রিফিং দেখতে সাইন ইন করুন");
  if (caller.scope === "agent") {
    const profileId = caller.profile?.id;
    if (!profileId) throw new Error("এজেন্ট প্রোফাইল পাওয়া যায়নি");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: lead, error } = await supabaseAdmin
      .from("leads")
      .select("id, assigned_to, assigned_agent_id")
      .eq("id", leadId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!lead || (lead.assigned_to !== profileId && lead.assigned_agent_id !== profileId)) {
      throw new Error("এই লিড আপনার নামে নেই");
    }
  }
}

/** Compact 1-line brief + opener shown right before dialling. */
export const getQuickBrief = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => Input.parse(input))
  .handler(async ({ data }) => {
    await authorize(data.token ?? null, data.leadId);
    const { buildQuickBrief } = await import("@/lib/precall.server");
    return buildQuickBrief(data.leadId, data.ai ?? false);
  });

/**
 * AI pre-call briefing for one lead.
 * Authority and coordinators may brief any lead; a signed-in agent only their
 * own assigned leads. A client-supplied lead id is never proof of ownership.
 */
export const getPreCallBrief = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => Input.parse(input))
  .handler(async ({ data }) => {
    const { resolveCaller } = await import("@/lib/access.server");
    const caller = await resolveCaller(data.token ?? null);
    if (caller.scope === "none") throw new Error("ব্রিফিং দেখতে সাইন ইন করুন");

    if (caller.scope === "agent") {
      const profileId = caller.profile?.id;
      if (!profileId) throw new Error("এজেন্ট প্রোফাইল পাওয়া যায়নি");
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: lead, error } = await supabaseAdmin
        .from("leads")
        .select("id, assigned_to")
        .eq("id", data.leadId)
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (!lead || lead.assigned_to !== profileId) {
        throw new Error("এই লিড আপনার নামে নেই");
      }
    }

    const { buildPreCallBrief } = await import("@/lib/precall.server");
    return buildPreCallBrief(data.leadId);
  });
