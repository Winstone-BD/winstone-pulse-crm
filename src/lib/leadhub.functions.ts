import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const checkLeadHubAccess = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ adminToken: z.string().nullable().optional() }).parse(input))
  .handler(async ({ data }) => {
    const { requireLeadHub } = await import("@/lib/access.server");
    try {
      await requireLeadHub(data.adminToken);
      return { allowed: true };
    } catch {
      return { allowed: false };
    }
  });
