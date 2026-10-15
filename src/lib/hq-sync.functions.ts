import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const tok = z.string().nullable().optional();

async function authority(token: string | null | undefined, write = false) {
  const { resolveCaller } = await import("@/lib/access.server");
  const c = await resolveCaller(token ?? null);
  if (c.scope !== "authority") throw new Error("HQ/IT access required");
  if (write && c.readOnly) throw new Error("Read-only access");
  return c.profile?.id ?? c.userId ?? "hq";
}

export const listSheetProposals = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ token: tok }).parse(i))
  .handler(async ({ data }) => {
    await authority(data.token);
    return (await import("@/lib/sheet-pull.server")).listProposals("pending");
  });

export const decideSheetProposal = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ token: tok, id: z.string().uuid(), approve: z.boolean() }).parse(i))
  .handler(async ({ data }) => {
    const by = await authority(data.token, true);
    return (await import("@/lib/sheet-pull.server")).decideProposal(data.id, data.approve, by);
  });

export const getRecordingsInbox = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ token: tok }).parse(i))
  .handler(async ({ data }) => {
    await authority(data.token);
    const m = await import("@/lib/drive-recordings-inbox.server");
    return { folder: await m.getInboxFolder(), files: await m.listInbox() };
  });

export const createRecordingsFolder = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ token: tok }).parse(i))
  .handler(async ({ data }) => {
    await authority(data.token, true);
    return (await import("@/lib/drive-recordings-inbox.server")).ensureInboxFolder();
  });

export const syncRecordingsFolder = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ token: tok }).parse(i))
  .handler(async ({ data }) => {
    await authority(data.token, true);
    return (await import("@/lib/drive-recordings-inbox.server")).syncRecordingsInbox();
  });

export const linkRecordingFile = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ token: tok, id: z.string().uuid(), phone: z.string().trim().min(10).max(20) }).parse(i))
  .handler(async ({ data }) => {
    const by = await authority(data.token, true);
    return (await import("@/lib/drive-recordings-inbox.server")).linkInboxFile(data.id, data.phone, by);
  });
