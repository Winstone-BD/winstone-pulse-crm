import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

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
