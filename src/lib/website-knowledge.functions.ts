import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/**
 * Company website knowledge for agents. Asking is open to any signed-in staff
 * account; refreshing the stored copy and changing the website address is IT/HQ
 * only.
 */

export const askWebsite = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        adminToken: z.string().nullable().optional(),
        question: z.string().min(2).max(500),
        leadContext: z.string().max(1000).nullable().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { resolveCaller } = await import("@/lib/access.server");
    const caller = await resolveCaller(data.adminToken ?? null);
    if (caller.scope === "none") {
      return { answer: "অনুমোদিত অ্যাকাউন্ট দিয়ে সাইন ইন করুন।", covered: false, sources: [] };
    }
    const { answerFromWebsite } = await import("@/lib/website-knowledge.server");
    return answerFromWebsite({
      question: data.question,
      leadContext: data.leadContext ?? null,
      actorProfileId: caller.profile?.id ?? null,
    });
  });

export const websiteKnowledge = createServerFn({ method: "POST" })
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
    const { websiteKnowledgeStatus } = await import("@/lib/website-knowledge.server");
    return websiteKnowledgeStatus();
  });

export const refreshWebsiteKnowledge = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        adminToken: z.string().nullable().optional(),
        baseUrl: z.string().url().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { resolveCaller, requireAuthority, requireWrite } = await import("@/lib/access.server");
    const caller = await resolveCaller(data.adminToken ?? null);
    requireAuthority(caller);
    requireWrite(caller);
    const { refreshWebsitePages, setWebsiteBaseUrl } = await import(
      "@/lib/website-knowledge.server"
    );
    if (data.baseUrl) await setWebsiteBaseUrl(data.baseUrl);
    return refreshWebsitePages();
  });
