import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/**
 * Approved Google Drive document knowledge. Reading the index happens inside
 * the grounded answer path only; these functions are the admin controls —
 * status, folder approval and re-indexing are HQ/IT only.
 */

export const driveKnowledge = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ adminToken: z.string().nullable().optional() }).parse(input),
  )
  .handler(async ({ data }) => {
    const { resolveCaller, requireAuthority } = await import("@/lib/access.server");
    try {
      requireAuthority(await resolveCaller(data.adminToken ?? null));
    } catch {
      return null;
    }
    const { driveKnowledgeStatus } = await import("@/lib/drive-knowledge.server");
    return driveKnowledgeStatus();
  });

export const refreshDriveKnowledge = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        adminToken: z.string().nullable().optional(),
        folders: z
          .array(z.object({ id: z.string().min(6).max(200), name: z.string().max(200) }))
          .max(20)
          .optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { resolveCaller, requireAuthority, requireWrite } = await import("@/lib/access.server");
    const caller = await resolveCaller(data.adminToken ?? null);
    requireAuthority(caller);
    requireWrite(caller);
    const { refreshDriveDocuments, setApprovedFolders } = await import(
      "@/lib/drive-knowledge.server"
    );
    if (data.folders && data.folders.length > 0) await setApprovedFolders(data.folders);
    return refreshDriveDocuments({
      profileId: caller.profile?.id ?? null,
      label: caller.label ?? null,
    });
  });
