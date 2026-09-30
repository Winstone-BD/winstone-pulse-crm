/** Pure, testable rules for Market News. No network, no database. */

export const NEWS_CATEGORIES = [
  { code: "rajuk", label: "RAJUK / নিয়ন্ত্রক" },
  { code: "market", label: "প্রপার্টি মার্কেট" },
  { code: "infrastructure", label: "মেট্রো / অবকাঠামো" },
  { code: "finance", label: "সুদের হার / লোন" },
  { code: "housing", label: "হাউজিং / প্রকল্প" },
  { code: "announcement", label: "HQ ঘোষণা" },
] as const;
export type NewsCategory = (typeof NEWS_CATEGORIES)[number]["code"];
export const NEWS_CATEGORY_CODES = NEWS_CATEGORIES.map((c) => c.code) as [NewsCategory, ...NewsCategory[]];
export const newsCategoryLabel = (c: string) => NEWS_CATEGORIES.find((x) => x.code === c)?.label ?? c;

/** Bangladesh-first search queries sent to Google News. */
export const NEWS_QUERIES = [
  "Bangladesh real estate",
  "Dhaka property market apartment price",
  "RAJUK",
  "Uttara Dhaka",
  "Dhaka metro rail",
  "Bangladesh home loan interest rate",
  "ঢাকা ফ্ল্যাট আবাসন",
  "রাজউক",
];

const KEYWORDS = [
  "real estate", "property", "apartment", "flat", "housing", "land", "plot", "rajuk", "rehab", "developer",
  "metro", "expressway", "infrastructure", "uttara", "purbachal", "dhaka", "home loan", "mortgage", "interest rate",
  "bangladesh bank", "construction", "building code", "dap",
  "আবাসন", "ফ্ল্যাট", "জমি", "প্লট", "রাজউক", "রিহ্যাব", "মেট্রো", "উত্তরা", "পূর্বাচল", "গৃহঋণ", "সুদের হার", "নির্মাণ",
];

export const MAX_AGE_DAYS = 14;

export type RssItem = { title: string; link: string; pubDate: string | null; sourceName: string | null; description: string };

const decode = (s: string) =>
  s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&");
const strip = (s: string) => decode(s).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
const tag = (block: string, name: string) => block.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`))?.[1] ?? null;

export function parseRss(xml: string): RssItem[] {
  const out: RssItem[] = [];
  for (const m of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
    const b = m[1] ?? "";
    const title = strip(tag(b, "title") ?? "");
    const link = strip(tag(b, "link") ?? "");
    if (!title || !/^https?:\/\//.test(link)) continue;
    const src = tag(b, "source");
    out.push({ title, link, pubDate: tag(b, "pubDate")?.trim() ?? null, sourceName: src ? strip(src) : null, description: strip(tag(b, "description") ?? "") });
  }
  return out;
}

/** Google News titles end with " - Source"; strip it and normalise for duplicate detection. */
export function normalizeTitle(title: string, source?: string | null) {
  let t = title;
  if (source && t.endsWith(` - ${source}`)) t = t.slice(0, -(source.length + 3));
  return t.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

export function dedupeKey(title: string, source?: string | null) {
  return normalizeTitle(title, source).split(" ").slice(0, 12).join(" ");
}

export function isFresh(pubDate: string | null, now: Date, maxDays = MAX_AGE_DAYS) {
  if (!pubDate) return false;
  const t = Date.parse(pubDate);
  if (Number.isNaN(t)) return false;
  const age = now.getTime() - t;
  return age >= -3_600_000 && age <= maxDays * 86_400_000;
}

export function looksRelevant(text: string) {
  const t = text.toLowerCase();
  return KEYWORDS.some((k) => t.includes(k));
}

/** Western and Bengali digits normalised to Western for comparison. */
const toLatinDigits = (s: string) => s.replace(/[০-৯]/g, (d) => String("০১২৩৪৫৬৭৮৯".indexOf(d)));
const numbers = (s: string) => (toLatinDigits(s).match(/\d+(?:[.,]\d+)?/g) ?? []).map((n) => n.replace(/,/g, ""));

/**
 * The AI may only restate the source. Every number in its output must appear in
 * the retrieved source text — otherwise the item is rejected as ungrounded.
 */
export function groundedAgainst(source: string, aiText: string) {
  const allowed = new Set(numbers(source));
  const bad = numbers(aiText).filter((n) => !allowed.has(n));
  return { ok: bad.length === 0, unsupported: bad };
}
