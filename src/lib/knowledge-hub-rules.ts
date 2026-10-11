/**
 * Pure, browser-safe rules for the Winstone Knowledge Hub (winstonebd.com)
 * integration. Kept free of I/O so they are unit-tested directly.
 */
import { parseRss } from "@/lib/market-news-rules";

export const HUB_ORIGIN = "https://winstonebd.com";
export const HUB_NEWS_FEED = `${HUB_ORIGIN}/api/public/news-feed`;
/** Exact fallback when the fetched sources do not answer the question. */
export const NO_SOURCE_ANSWER = "তথ্য পাওয়া যায়নি — অনুমান করবেন না";
/** Response bodies larger than this are refused (bytes). */
export const HUB_MAX_BYTES = 1_000_000;

/** Hub pages the CRM may read: /projects/*, /faq, /news/* only (https, no creds/port/query). */
export function isHubPublicPage(raw: string): boolean {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return false;
  }
  if (u.protocol !== "https:" || u.hostname !== "winstonebd.com" || u.port || u.username || u.password) return false;
  if (u.search || u.hash) return false;
  const p = u.pathname.replace(/\/+$/, "");
  if (p.includes("..") || p.includes("//")) return false;
  return /^\/projects\/[a-z0-9][a-z0-9-]{0,120}$/i.test(p) || p === "/faq" || /^\/news\/[a-z0-9][a-z0-9-]{0,160}$/i.test(p);
}

export type HubNewsItem = { title: string; link: string; publishedAt: string | null; description: string };

/** Parse the Hub feed (RSS today; JSON array/{items} tolerated). Only Hub /news/* links kept, deduped by link. */
export function parseHubFeed(body: string): HubNewsItem[] {
  let raw: HubNewsItem[] = [];
  const trimmed = body.trim();
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    try {
      const j = JSON.parse(trimmed) as unknown;
      const arr = Array.isArray(j) ? j : ((j as { items?: unknown[] }).items ?? []);
      raw = (arr as Record<string, unknown>[]).map((x) => ({
        title: String(x.title ?? "").trim(),
        link: String(x.url ?? x.link ?? "").trim(),
        publishedAt: typeof x.published_at === "string" ? x.published_at : typeof x.date === "string" ? x.date : null,
        description: String(x.summary ?? x.excerpt ?? "").trim(),
      }));
    } catch {
      return [];
    }
  } else {
    raw = parseRss(trimmed).map((i) => ({ title: i.title, link: i.link, publishedAt: i.pubDate || null, description: i.description }));
  }
  return dedupeByLink(raw.filter((i) => i.title && isHubPublicPage(i.link))).map((i) => ({
    ...i,
    publishedAt: i.publishedAt && !Number.isNaN(Date.parse(i.publishedAt)) ? new Date(i.publishedAt).toISOString() : null,
  }));
}

export function normalizeLink(link: string): string {
  return link.trim().replace(/[?#].*$/, "").replace(/\/+$/, "");
}

export function dedupeByLink<T extends { link: string }>(items: T[]): T[] {
  const seen = new Set<string>();
  return items.filter((i) => {
    const k = normalizeLink(i.link);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

/** Fresh official items (last 14 days) first, original order kept within each group. */
export function pinOfficialFirst<T extends { origin: string; created_at: string }>(items: T[], now = Date.now()): T[] {
  const fresh = (n: T) => n.origin === "official" && now - Date.parse(n.created_at) < 14 * 86_400_000;
  return [...items.filter(fresh), ...items.filter((n) => !fresh(n))];
}

/** Final answer gate: without sources or coverage the exact fallback is returned, with no citations. */
export function finalizeCitedAnswer<S>(r: { answer: string; covered: boolean }, sources: S[]) {
  if (!r.covered || sources.length === 0 || !r.answer.trim()) return { answer: NO_SOURCE_ANSWER, covered: false, sources: [] as S[] };
  return { answer: r.answer, covered: true, sources };
}

/** Bounded, redirect-refusing fetch of an allowlisted Hub URL. Returns null on any violation. */
export async function fetchHubText(url: string, allow: (u: string) => boolean = (u) => isHubPublicPage(u) || u === HUB_NEWS_FEED) {
  if (!allow(url)) return null;
  try {
    const r = await fetch(url, { redirect: "manual", headers: { "User-Agent": "WinstoneCRM-Hub/1.0" }, signal: AbortSignal.timeout(15_000) });
    if (!r.ok) return null; // 3xx (manual) is not ok → redirects refused
    const len = Number(r.headers.get("content-length") ?? "0");
    if (len > HUB_MAX_BYTES) return null;
    const text = await r.text();
    return text.length > HUB_MAX_BYTES ? null : { text, type: r.headers.get("content-type") ?? "" };
  } catch {
    return null;
  }
}
