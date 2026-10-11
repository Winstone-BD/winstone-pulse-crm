import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { logAiUsage } from "@/lib/ai-usage.server";

/**
 * Company website knowledge — the public Winstone Properties site is read into
 * the CRM so agents get project, price and location answers while they talk.
 *
 * Two paths, on purpose:
 *  - stored pages (fast, always available, refreshed on a schedule), and
 *  - a live re-read of the single most relevant page at answer time, so a price
 *    changed on the website today is not answered from yesterday's copy.
 *
 * The model may only use the supplied page text. Nothing is invented: when the
 * pages do not cover the question the answer says so.
 */

const MODEL = "openai/gpt-6-astra";
const ENDPOINT = "https://ai.gateway.lovable.dev/v1/responses";
const CONFIG_ID = "website_knowledge";
export const DEFAULT_WEBSITE_URL = "https://winstone.lovable.app";
/** Winstone Knowledge Hub — public project, FAQ and news pages, always read too. */
export const HUB_URL = "https://winstonebd.com";
const MAX_PAGES = 40;
const PAGE_CHARS = 6000;

export type WebsiteSource = { url: string; title: string; fetchedAt: string; live: boolean };

export type DriveSource = {
  fileId: string;
  name: string;
  folderName: string | null;
  webViewLink: string | null;
  indexedAt: string;
};

export type WebsiteAnswer = {
  answer: string;
  covered: boolean;
  sources: WebsiteSource[];
  /** Approved Drive documents used, if any. */
  documents: DriveSource[];
};

/** Only Winstone's own public sites may be read (blocks fetching arbitrary/internal hosts). */
export function isAllowedWebsiteUrl(raw: string): boolean {
  try {
    const u = new URL(raw);
    if (u.protocol !== "https:" || u.username || u.password || u.port) return false;
    const h = u.hostname.toLowerCase();
    return (
      h === "winstonebd.com" ||
      h.endsWith(".winstonebd.com") ||
      h === "winstone.lovable.app" ||
      h === new URL(DEFAULT_WEBSITE_URL).hostname
    );
  } catch {
    return false;
  }
}

export async function websiteBaseUrl(): Promise<string> {
  const { data } = await supabaseAdmin
    .from("app_config")
    .select("data")
    .eq("id", CONFIG_ID)
    .maybeSingle();
  const raw = (data?.data as { baseUrl?: unknown } | null)?.baseUrl;
  const value = typeof raw === "string" ? raw.trim() : "";
  return value && isAllowedWebsiteUrl(value) ? value : DEFAULT_WEBSITE_URL;
}

export async function setWebsiteBaseUrl(url: string): Promise<void> {
  if (!isAllowedWebsiteUrl(url)) {
    throw new Error("Only Winstone's own https websites can be used as the knowledge source");
  }
  await supabaseAdmin.from("app_config").upsert({ id: CONFIG_ID, data: { baseUrl: url } });
}

/** Plain readable text from an HTML document. */
export function htmlToText(html: string): { title: string; text: string } {
  const title = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1]?.trim() ?? "";
  const text = html
    .replace(/<(script|style|noscript|svg)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<\/(p|div|li|h[1-6]|tr|section)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/[ \t\u00a0]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return { title: decodeTitle(title), text };
}

function decodeTitle(title: string) {
  return title.replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
}

async function fetchText(url: string): Promise<{ title: string; text: string } | null> {
  if (!isAllowedWebsiteUrl(url)) return null;
  try {
    const response = await fetch(url, {
      headers: { "User-Agent": "WinstoneCRM-KnowledgeReader/1.0" },
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) return null;
    const type = response.headers.get("content-type") ?? "";
    if (!type.includes("html") && !type.includes("text")) return null;
    return htmlToText(await response.text());
  } catch {
    return null;
  }
}

/** Page addresses to read: sitemap first, then in-page links, base page always. */
async function discoverUrls(base: string): Promise<string[]> {
  const origin = new URL(base).origin;
  const found = new Set<string>([base.replace(/\/$/, "") || origin]);

  try {
    const sitemap = await fetch(new URL("/sitemap.xml", origin).toString(), {
      signal: AbortSignal.timeout(15_000),
    });
    if (sitemap.ok) {
      const xml = await sitemap.text();
      for (const match of xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)) {
        const loc = match[1];
        if (loc && loc.startsWith(origin)) found.add(loc.replace(/\/$/, ""));
      }
    }
  } catch {
    // No sitemap: fall back to links on the landing page.
  }

  if (found.size < 3) {
    try {
      const page = await fetch(origin, { signal: AbortSignal.timeout(15_000) });
      if (page.ok) {
        const html = await page.text();
        for (const match of html.matchAll(/href="(\/[^"#?]*)"/g)) {
          const path = match[1];
          if (path && !/\.(png|jpe?g|svg|css|js|ico|webp|pdf)$/i.test(path)) {
            found.add(new URL(path, origin).toString().replace(/\/$/, ""));
          }
        }
      }
    } catch {
      // Site unreachable — the caller reports zero pages read.
    }
  }

  return [...found].slice(0, MAX_PAGES);
}

export type RefreshResult = {
  baseUrl: string;
  discovered: number;
  stored: number;
  failed: number;
  at: string;
};

/** Read the public website into the CRM. Read-only against the website. */
export async function refreshWebsitePages(): Promise<RefreshResult> {
  const baseUrl = await websiteBaseUrl();
  const bases = [...new Set([baseUrl, HUB_URL])];
  const urls = [...new Set((await Promise.all(bases.map((b) => discoverUrls(b)))).flat())];
  let stored = 0;
  let failed = 0;

  for (const url of urls) {
    const page = await fetchText(url);
    if (!page || page.text.length < 120) {
      failed += 1;
      continue;
    }
    const content = page.text.slice(0, PAGE_CHARS);
    const { error } = await supabaseAdmin.from("website_pages").upsert(
      {
        url,
        title: page.title || url,
        content,
        word_count: content.split(/\s+/).length,
        fetched_at: new Date().toISOString(),
      },
      { onConflict: "url" },
    );
    if (error) failed += 1;
    else stored += 1;
  }

  return {
    baseUrl,
    discovered: urls.length,
    stored,
    failed,
    at: new Date().toISOString(),
  };
}

export type StoredPage = { url: string; title: string; content: string; fetchedAt: string };

export async function storedPages(): Promise<StoredPage[]> {
  const { data } = await supabaseAdmin
    .from("website_pages")
    .select("url, title, content, fetched_at")
    .order("fetched_at", { ascending: false })
    .limit(MAX_PAGES * 2);
  return (data ?? []).map((row) => ({
    url: row.url,
    title: row.title ?? row.url,
    content: row.content,
    fetchedAt: row.fetched_at,
  }));
}

function tokens(query: string): string[] {
  return query
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((word) => word.length > 2)
    .slice(0, 12);
}

/** Pages that answer most customer questions, used when keywords do not match. */
const HIGH_SIGNAL = ["sales", "price", "project", "contact", "about", "address", "faq"];

/** Simple keyword ranking — enough for a handful of marketing pages. */
export function rankPages(pages: StoredPage[], query: string, limit = 3): StoredPage[] {
  const words = tokens(query);
  return pages
    .map((page) => {
      const haystack = `${page.title}\n${page.content}`.toLowerCase();
      const label = `${page.title} ${page.url}`.toLowerCase();
      let score = HIGH_SIGNAL.some((hint) => label.includes(hint)) ? 1 : 0;
      for (const word of words) {
        const hits = haystack.split(word).length - 1;
        if (hits > 0) score += Math.min(hits, 5) + (page.title.toLowerCase().includes(word) ? 3 : 0);
      }
      return { page, score };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((entry) => entry.page);
}

/**
 * Bengali questions rarely share words with English pages, so keyword misses
 * must not mean "no answer" — the highest-signal pages are sent anyway and the
 * model decides whether they cover the question.
 */

export async function websiteKnowledgeStatus() {
  const [{ count }, pages] = await Promise.all([
    supabaseAdmin.from("website_pages").select("id", { count: "exact", head: true }),
    storedPages(),
  ]);
  return {
    baseUrl: await websiteBaseUrl(),
    pages: count ?? 0,
    lastFetchedAt: pages[0]?.fetchedAt ?? null,
    titles: pages.slice(0, 8).map((page) => ({ url: page.url, title: page.title })),
  };
}

function apiKey() {
  const key = process.env["LOVABLE_API_KEY"];
  if (!key) throw new Error("AI is not configured for this workspace");
  return key;
}

const SCHEMA = {
  type: "object",
  properties: {
    answer: { type: "string" },
    covered: { type: "boolean" },
  },
  required: ["answer", "covered"],
  additionalProperties: false,
};

async function askJson(system: string, user: string): Promise<{ answer: string; covered: boolean }> {
  const response = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Lovable-API-Key": apiKey(),
      "X-Lovable-AIG-SDK": "fetch",
    },
    body: JSON.stringify({
      model: MODEL,
      stream: true,
      reasoning: { effort: "low" },
      input: [
        { role: "system", content: [{ type: "input_text", text: system }] },
        { role: "user", content: [{ type: "input_text", text: user }] },
      ],
      text: {
        format: { type: "json_schema", name: "website_answer", strict: true, schema: SCHEMA },
      },
    }),
  });

  if (!response.ok || !response.body) {
    if (response.status === 429) throw new Error("এআই এখন ব্যস্ত — একটু পরে চেষ্টা করুন");
    if (response.status === 402) throw new Error("এআই ক্রেডিট শেষ");
    throw new Error(`এআই সাড়া দিচ্ছে না (${response.status})`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let text = "";
  for (;;) {
    const chunk = await reader.read();
    if (chunk.done) break;
    buffer += decoder.decode(chunk.value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.startsWith("data:")) continue;
      const payload = line.slice(5).trim();
      if (!payload || payload === "[DONE]") continue;
      try {
        const event = JSON.parse(payload) as {
          type?: string;
          delta?: string;
          response?: { output_text?: string };
        };
        if (event.type === "response.output_text.delta" && typeof event.delta === "string") {
          text += event.delta;
        }
        if (event.type === "response.completed" && event.response?.output_text) {
          text = event.response.output_text;
        }
      } catch {
        // keep-alive frame
      }
    }
  }
  if (!text.trim()) throw new Error("এআই খালি উত্তর দিয়েছে");
  return JSON.parse(text) as { answer: string; covered: boolean };
}

const SYSTEM = [
  "তুমি Winstone Properties-এর বিক্রয় এজেন্টদের সহকারী।",
  "শুধুমাত্র নিচে দেওয়া ওয়েবসাইট পেজ ও অনুমোদিত ডকুমেন্টের লেখা থেকে উত্তর দাও।",
  "ওয়েবসাইটের তথ্য আগে গুরুত্ব পাবে; ডকুমেন্ট শুধু পরিপূরক তথ্য হিসেবে ব্যবহার করবে।",
  "কোনো দাম, আয়তন, অবস্থান বা সুবিধা নিজে বানাবে না।",
  "উত্তর না থাকলে covered=false দিয়ে বলবে যে অনুমোদিত তথ্যে এটি নেই।",
  "উত্তর বাংলায়, সংক্ষিপ্ত, ৩-৫ বাক্য, এজেন্ট কথায় বলতে পারবে এমন ভাষায়।",
].join(" ");

/**
 * Grounded answer for agents. Sources in priority order: the company website
 * (stored copy plus one live re-read of the best-matching page, so today's
 * website text wins), then extracts from Drive folders an admin approved.
 * Approved-document retrieval is audited inside the Drive layer.
 */
export async function answerFromWebsite(input: {
  question: string;
  leadContext?: string | null;
  actorProfileId?: string | null;
  actorLabel?: string | null;
}): Promise<WebsiteAnswer> {
  const pages = await storedPages();
  const picked = rankPages(pages, input.question);

  const used: { source: WebsiteSource; content: string }[] = [];
  for (const [index, page] of picked.entries()) {
    if (index === 0) {
      const fresh = await fetchText(page.url);
      if (fresh && fresh.text.length > 120) {
        used.push({
          source: {
            url: page.url,
            title: fresh.title || page.title,
            fetchedAt: new Date().toISOString(),
            live: true,
          },
          content: fresh.text.slice(0, PAGE_CHARS),
        });
        continue;
      }
    }
    used.push({
      source: { url: page.url, title: page.title, fetchedAt: page.fetchedAt, live: false },
      content: page.content,
    });
  }

  // Approved Drive documents: supplementary, never a replacement for live data.
  let driveUsed: { source: DriveSource; content: string }[] = [];
  try {
    const { driveExtractsFor } = await import("@/lib/drive-knowledge.server");
    driveUsed = await driveExtractsFor({
      question: input.question,
      actorProfileId: input.actorProfileId ?? null,
      actorLabel: input.actorLabel ?? null,
    });
  } catch (error) {
    console.error("[knowledge] drive extracts unavailable", error);
  }

  if (used.length === 0 && driveUsed.length === 0) {
    return {
      answer:
        pages.length === 0
          ? "ওয়েবসাইটের তথ্য এখনো CRM-এ পড়া হয়নি — আইটি কনসোল থেকে একবার রিফ্রেশ করতে হবে।"
          : "এই প্রশ্নের উত্তর অনুমোদিত তথ্যে পাওয়া যায়নি। নিশ্চিত না হয়ে কিছু বলবেন না।",
      covered: false,
      sources: [],
      documents: [],
    };
  }

  const userPrompt = [
    input.leadContext ? `লিডের প্রসঙ্গ: ${input.leadContext}` : null,
    `প্রশ্ন: ${input.question}`,
    "",
    "ওয়েবসাইট পেজ:",
    ...used.map((entry) => `--- ${entry.source.title} (${entry.source.url})\n${entry.content}`),
    ...(driveUsed.length > 0
      ? [
          "",
          "অনুমোদিত ডকুমেন্ট (Google Drive):",
          ...driveUsed.map((entry) => `--- ${entry.source.name}\n${entry.content}`),
        ]
      : []),
  ]
    .filter(Boolean)
    .join("\n");

  const result = await askJson(SYSTEM, userPrompt);
  await logAiUsage({
    category: "other",
    model: MODEL,
    detail: "website_answer",
    actorProfileId: input.actorProfileId ?? null,
  });

  return {
    answer: result.answer,
    covered: result.covered,
    sources: used.map((e) => e.source),
    documents: driveUsed.map((e) => e.source),
  };
}
