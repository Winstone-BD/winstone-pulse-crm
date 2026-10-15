import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { EXTRACT_FIELDS } from "@/lib/agent-templates";

/** Gemini buyer-profile suggestions from saved call notes. Agents: own leads only; HQ/IT: any. */
export const extractBuyerCheck = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z.object({ token: z.string().nullable().optional(), leadId: z.string().uuid() }).parse(i),
  )
  .handler(async ({ data }) => {
    const { resolveCaller } = await import("@/lib/access.server");
    const c = await resolveCaller(data.token ?? null);
    if (c.scope !== "authority" && (c.scope !== "agent" || !c.profile)) throw new Error("Sign in required");
    const { extractBuyerProfile } = await import("@/lib/buyer-extract.server");
    return extractBuyerProfile(data.leadId, c.profile?.id ?? "", c.scope === "authority");
  });

/**
 * Confirm-and-save: writes user-confirmed buyer-check values into the lead's
 * buyer_profile. Only empty fields are filled — existing values never change.
 */
export const saveBuyerCheck = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z.object({
      token: z.string().nullable().optional(),
      leadId: z.string().uuid(),
      fields: z.record(z.string(), z.object({ value: z.string().trim().min(1).max(120), evidence: z.string().max(160).optional() })),
    }).parse(i),
  )
  .handler(async ({ data }) => {
    const { resolveCaller } = await import("@/lib/access.server");
    const c = await resolveCaller(data.token ?? null);
    if (c.readOnly) throw new Error("Read-only access");
    if (c.scope !== "authority" && (c.scope !== "agent" || !c.profile)) throw new Error("Sign in required");
    const db = (await import("@/integrations/supabase/client.server")).supabaseAdmin;
    const { data: lead, error } = await db.from("leads").select("assigned_to, buyer_profile").eq("id", data.leadId).maybeSingle();
    if (error) throw new Error(error.message);
    if (!lead || (c.scope !== "authority" && lead.assigned_to !== c.profile?.id)) throw new Error("This lead is not assigned to you");
    const current = (lead.buyer_profile ?? {}) as Record<string, { value?: string } | undefined>;
    const next: Record<string, unknown> = { ...current };
    const saved: string[] = [];
    const skipped: string[] = [];
    const now = new Date().toISOString();
    for (const k of EXTRACT_FIELDS) {
      const f = data.fields[k];
      if (!f) continue;
      if (current[k]?.value) { skipped.push(k); continue; }
      next[k] = { value: f.value, evidence: f.evidence ?? null, source: "gemini_confirmed", by: c.profile?.id ?? c.userId, at: now };
      saved.push(k);
    }
    if (saved.length) {
      const { error: ue } = await db.from("leads").update({ buyer_profile: next as never }).eq("id", data.leadId);
      if (ue) throw new Error(ue.message);
      await db.from("lead_events").insert({ lead_id: data.leadId, agent_id: c.profile?.id ?? null, kind: "buyer_profile_saved", detail: `Saved: ${saved.join(", ")}` });
    }
    return { saved, skipped };
  });
