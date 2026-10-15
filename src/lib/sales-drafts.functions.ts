import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/** Agents act on their own records; HQ/IT authority sees the whole team. */
async function scope(token: string | null | undefined) {
  const { resolveCaller } = await import("@/lib/access.server");
  const c = await resolveCaller(token ?? null);
  if (c.scope === "authority") return { agentId: null as string | null, authority: true, readOnly: Boolean(c.readOnly) };
  if (c.scope !== "agent" || !c.profile) throw new Error("Sign in required");
  return { agentId: c.profile.id as string, authority: false, readOnly: false };
}
const Tok = z.string().nullable().optional();

export const getProjectCatalog = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ token: Tok }).parse(i))
  .handler(async ({ data }) => {
    await scope(data.token);
    return (await import("@/lib/sales-drafts.server")).loadCatalog();
  });

export const draftFollowupPair = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ token: Tok, leadId: z.string().uuid() }).parse(i))
  .handler(async ({ data }) => {
    const s = await scope(data.token);
    if (s.readOnly) throw new Error("Read-only access");
    const m = await import("@/lib/sales-drafts.server");
    return m.draftFollowupPair(data.leadId, s.agentId ?? "", s.authority);
  });

export const listSalesDrafts = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ token: Tok }).parse(i))
  .handler(async ({ data }) => {
    const s = await scope(data.token);
    return (await import("@/lib/sales-drafts.server")).listDrafts(s.agentId);
  });

export const saveSalesDraftEdit = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ token: Tok, id: z.string().uuid(), text: z.string().min(1).max(4000) }).parse(i))
  .handler(async ({ data }) => {
    const s = await scope(data.token);
    if (s.readOnly) throw new Error("Read-only access");
    return (await import("@/lib/sales-drafts.server")).saveDraftEdit(data.id, s.agentId, data.text);
  });

export const getNegotiationAdvice = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ token: Tok, leadId: z.string().uuid(), projectId: z.string().uuid() }).parse(i))
  .handler(async ({ data }) => {
    const s = await scope(data.token);
    const m = await import("@/lib/sales-drafts.server");
    return m.negotiationAdvice(data.leadId, data.projectId, s.agentId ?? "", s.authority);
  });
