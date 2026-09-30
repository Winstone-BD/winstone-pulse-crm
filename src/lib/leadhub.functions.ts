import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const checkLeadHubAccess = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ adminToken: z.string().nullable().optional() }).parse(input))
  .handler(async ({ data }) => {
    const { resolveCaller, requireAuthority } = await import("@/lib/access.server");
    const caller = await resolveCaller(data.adminToken ?? null);
    requireAuthority(caller);
    return { allowed: true, readOnly: caller.readOnly };
  });
