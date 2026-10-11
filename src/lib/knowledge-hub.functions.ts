import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const Token = z.string().nullable().optional();

async function caller(adminToken: string | null | undefined) {
  const { siCaller } = await import("@/lib/sales-intel.server");
  return siCaller(adminToken);
}

export const hubOfficialNews = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ adminToken: Token }).parse(i ?? {}))
  .handler(async ({ data }) => {
    const c = await caller(data.adminToken).catch(() => null);
    if (!c) return [];
    const { latestOfficialNews } = await import("@/lib/knowledge-hub.server");
    return latestOfficialNews();
  });

export const hubProjectFacts = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ adminToken: Token, leadId: z.string().uuid() }).parse(i))
  .handler(async ({ data }) => {
    const c = await caller(data.adminToken);
    const { projectFactsForLead } = await import("@/lib/knowledge-hub.server");
    return projectFactsForLead(c, data.leadId);
  });

export const hubVisitRequests = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z.object({ adminToken: Token, leadId: z.string().uuid().nullable().optional(), openOnly: z.boolean().optional() }).parse(i ?? {}),
  )
  .handler(async ({ data }) => {
    const c = await caller(data.adminToken).catch(() => null);
    if (!c) return [];
    const { listVisitRequests } = await import("@/lib/knowledge-hub.server");
    return listVisitRequests(c, { leadId: data.leadId ?? null, openOnly: data.openOnly ?? false });
  });

export const hubDecideVisitRequest = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z.object({
      adminToken: Token,
      id: z.string().uuid(),
      action: z.enum(["confirm", "dismiss"]),
      visitAt: z.string().datetime({ offset: true }).nullable().optional(),
    }).parse(i),
  )
  .handler(async ({ data }) => {
    const c = await caller(data.adminToken);
    const { decideVisitRequest } = await import("@/lib/knowledge-hub.server");
    return decideVisitRequest(c, { id: data.id, action: data.action, visitAt: data.visitAt ?? null });
  });
