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

export const getCallCoach = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ token: Tok, leadId: z.string().uuid() }).parse(i))
  .handler(async ({ data }) => {
    const s = await scope(data.token);
    if (s.readOnly) throw new Error("Read-only access");
    return (await import("@/lib/sales-drafts.server")).callCoach(data.leadId, s.agentId ?? "", s.authority);
  });

export const getObjectionLibrary = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ token: Tok }).parse(i))
  .handler(async ({ data }) => {
    const s = await scope(data.token);
    return { ...(await (await import("@/lib/sales-drafts.server")).objectionLibrary()), canApprove: s.authority && !s.readOnly };
  });

/** HQ/IT only: approve the answer agents will see for an objection. */
export const approveObjection = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ token: Tok, key: z.string().min(1).max(120), objection: z.string().min(1).max(200), answer: z.string().min(5).max(1200) }).parse(i))
  .handler(async ({ data }) => {
    const s = await scope(data.token);
    if (!s.authority || s.readOnly) throw new Error("Only HQ/IT can approve answers");
    const { resolveCaller } = await import("@/lib/access.server");
    const c = await resolveCaller(data.token ?? null);
    return (await import("@/lib/sales-drafts.server")).approveObjectionAnswer(data.key, data.objection, data.answer, c.profile?.id ?? null);
  });
