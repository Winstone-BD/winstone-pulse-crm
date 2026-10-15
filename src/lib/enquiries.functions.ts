import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/** HQ / IT only: website buyer-portal enquiries with live lead status. */
export const listWebsiteEnquiries = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z.object({ adminToken: z.string().max(4096).nullable().optional(), days: z.number().int().min(1).max(365).default(30) }).parse(i),
  )
  .handler(async ({ data }) => {
    const { resolveCaller } = await import("@/lib/access.server");
    const c = await resolveCaller(data.adminToken ?? null);
    if (c.scope !== "authority") throw new Error("Only HQ / IT can view website enquiries");
    const { listEnquiries } = await import("@/lib/knowledge-hub.server");
    return listEnquiries(data.days);
  });
