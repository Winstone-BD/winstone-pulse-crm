import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/** Agents get their own records; HQ/IT (authority) sees the whole floor. */
export const getCrmInsights = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z
      .object({
        adminToken: z.string().nullable().optional(),
        lang: z.enum(["bn", "en"]).default("en"),
        withAi: z.boolean().default(false),
      })
      .parse(i),
  )
  .handler(async ({ data }) => {
    const { resolveCaller } = await import("@/lib/access.server");
    const c = await resolveCaller(data.adminToken ?? null);
    let agentId: string | null = null;
    if (c.scope === "authority") agentId = null;
    else if (c.scope === "agent" && c.profile) agentId = c.profile.id;
    else throw new Error("Sign in required");
    const m = await import("@/lib/crm-insights.server");
    return m.buildCrmInsights(agentId, data.lang, data.withAi);
  });
