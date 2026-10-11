import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/**
 * AI summary for a support knowledge-base article. Support leads/admins (the
 * same scope that can edit articles) generate a draft summary; the editor
 * reviews it and saves it through the existing saveKbArticle path, so nothing
 * is published without a human saving it and no schema change is needed.
 */

const GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-3.8-flash";

export const KB_SUMMARY_PROMPT = `তুমি Winstone-এর সাপোর্ট নলেজ বেসের জন্য সংক্ষিপ্ত সারসংক্ষেপ লেখো।
নিয়ম:
- শুধু দেওয়া আর্টিকেলের তথ্য ব্যবহার করবে; কিছু কল্পনা করবে না।
- সর্বোচ্চ ২ বাক্য; পাঠক যেন বুঝতে পারে এই আর্টিকেলে কী আছে।
- আর্টিকেল বাংলায় হলে বাংলায়, ইংরেজিতে হলে ইংরেজিতে লিখবে।
- শুধু সারসংক্ষেপের লেখা দেবে — কোনো শিরোনাম, বুলেট বা markdown নয়।`;

export const kbArticleSummary = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        adminToken: z.string().nullable().optional(),
        articleId: z.string().uuid(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { resolveCaller, requireWrite } = await import("@/lib/access.server");
    const { requireSupportLead } = await import("@/lib/support-access.server");
    const caller = requireSupportLead(await resolveCaller(data.adminToken ?? null));
    requireWrite(caller);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: article, error } = await supabaseAdmin
      .from("support_articles")
      .select("id, title, body_markdown")
      .eq("id", data.articleId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!article) throw new Error("আর্টিকেলটি পাওয়া যায়নি");
    if (article.body_markdown.trim().length < 20) {
      throw new Error("আর্টিকেলের লেখা খুব ছোট — সামারি বানানোর মতো যথেষ্ট লেখা নেই");
    }

    const cache = await import("@/lib/summary-cache.server");
    const hash = await cache.contentHash(article.title, article.body_markdown);
    const hit = await cache.getCachedSummary<string>("kb", hash);
    if (hit) return { summary: hit.summary, cachedAt: hit.createdAt as string | null };

    const key = process.env["LOVABLE_API_KEY"];
    if (!key) throw new Error("AI সার্ভিস এখন উপলব্ধ নেই");

    const response = await fetch(GATEWAY, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Lovable-API-Key": key },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 200,
        messages: [
          { role: "system", content: KB_SUMMARY_PROMPT },
          {
            role: "user",
            content: `শিরোনাম: ${article.title}\n\nআর্টিকেল:\n${article.body_markdown.slice(0, 12_000)}`,
          },
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
    const { actorLabel } = await import("@/lib/support-access.server");
    await logAudit({
      action: "kb_article_summarized",
      entityType: "support_article",
      entityId: article.id,
      actorProfileId: caller.profile?.id ?? null,
      actorLabel: actorLabel(caller),
      metadata: { title: article.title },
    });

    await cache.putCachedSummary("kb", hash, summary, MODEL, caller.profile?.name ?? "Support");
    return { summary, cachedAt: null as string | null };
  });
