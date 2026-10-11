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

const SUMMARY_PROMPT = `তুমি Winstone Pulse-এর অনুমোদিত ডকুমেন্ট তথ্যভাণ্ডারের একটি ডকুমেন্ট সারসংক্ষেপ করছো।
নিয়ম:
- শুধু দেওয়া লেখা ব্যবহার করবে; কোনো তথ্য, নাম বা সংখ্যা কল্পনা করবে না।
- সর্বোচ্চ ৩ বাক্যে ডকুমেন্টে কী আছে তা লিখবে।
- লেখা বাংলায় হলে বাংলায়, ইংরেজিতে হলে ইংরেজিতে।
- শুধু সারসংক্ষেপের লেখা — কোনো শিরোনাম বা markdown নয়।`;

/** HQ/IT-only: one indexed Drive document summarized from its stored extract. */
export const summarizeDriveDoc = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        adminToken: z.string().nullable().optional(),
        fileId: z.string().trim().min(6).max(200),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { resolveCaller, requireAuthority } = await import("@/lib/access.server");
    const caller = await resolveCaller(data.adminToken ?? null);
    requireAuthority(caller);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: doc, error } = await supabaseAdmin
      .from("drive_documents")
      .select("file_id, name, content")
      .eq("file_id", data.fileId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!doc) throw new Error("ডকুমেন্টটি ইনডেক্সে পাওয়া যায়নি");
    if (!doc.content || doc.content.trim().length < 20) {
      throw new Error("এই ডকুমেন্টে যথেষ্ট লেখা নেই");
    }

    const cache = await import("@/lib/summary-cache.server");
    const hash = await cache.contentHash(doc.file_id, doc.content);
    const hit = await cache.getCachedSummary<string>("drive", hash);
    if (hit) return { summary: hit.summary, cachedAt: hit.createdAt as string | null };

    const key = process.env["LOVABLE_API_KEY"];
    if (!key) throw new Error("AI সার্ভিস এখন উপলব্ধ নেই");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Lovable-API-Key": key },
      body: JSON.stringify({
        model: "google/gemini-3.8-flash",
        max_tokens: 220,
        messages: [
          { role: "system", content: SUMMARY_PROMPT },
          { role: "user", content: `ডকুমেন্ট: ${doc.name}\n\n${doc.content.slice(0, 12_000)}` },
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429)
        throw new Error("এখন অনেক অনুরোধ চলছে — একটু পরে আবার চেষ্টা করুন");
      if (response.status === 402)
        throw new Error("AI ক্রেডিট শেষ — মালিককে ক্রেডিট যোগ করতে বলুন");
      if (response.status === 403) throw new Error("এই কাজের জন্য AI এখন বন্ধ আছে");
      throw new Error(`সারসংক্ষেপ তৈরি করা গেল না (${response.status})`);
    }

    const payload = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const summary = payload.choices?.[0]?.message?.content?.trim() ?? "";
    if (!summary) throw new Error("AI সারসংক্ষেপ দেয়নি — আবার চেষ্টা করুন");

    const { logAudit } = await import("@/lib/audit.server");
    await logAudit({
      action: "drive_doc_summarized",
      entityType: "drive_document",
      entityId: doc.file_id,
      actorProfileId: caller.profile?.id ?? null,
      actorLabel: caller.profile?.name ?? "HQ/IT",
      metadata: { name: doc.name },
    });

    await cache.putCachedSummary("drive", hash, summary, "google/gemini-3.8-flash", caller.profile?.name ?? "HQ/IT");
    return { summary, cachedAt: null as string | null };
  });
