import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const STAGES = ["enquiry", "proposal", "offer", "booking", "close"] as const;

/**
 * Move a lead along the sales pipeline. Agents may only touch their own
 * leads; read-only callers are refused. The change is captured by the
 * existing record-audit trigger on leads.
 */
export const setLeadPipelineStage = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        adminToken: z.string().nullable().optional(),
        leadId: z.string().uuid(),
        stage: z.enum(STAGES),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { leadAccess } = await import("@/lib/lead-notes.functions");
    const access = await leadAccess(data.adminToken, data.leadId);
    if (!access || access.caller.readOnly) throw new Error("এই লিডের ধাপ বদলানোর অনুমতি নেই");
    const { error } = await access.db
      .from("leads")
      .update({ pipeline_stage: data.stage })
      .eq("id", data.leadId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
