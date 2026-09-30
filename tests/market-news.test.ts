import { describe, expect, it } from "vitest";

import { dedupeKey, groundedAgainst, isFresh, looksRelevant, parseRss } from "@/lib/market-news-rules";

const XML = `<rss><channel>
<item><title>RAJUK approves new DAP for Uttara - The Daily Star</title><link>https://news.google.com/a</link>
<pubDate>Tue, 29 Sep 2026 08:00:00 GMT</pubDate><description>&lt;a href="x"&gt;RAJUK approves 12 new plots&lt;/a&gt;</description>
<source url="https://thedailystar.net">The Daily Star</source></item>
<item><title>No link item</title><link>notaurl</link></item>
</channel></rss>`;

describe("market news rules", () => {
  it("parses RSS items and drops malformed ones", () => {
    const items = parseRss(XML);
    expect(items).toHaveLength(1);
    expect(items[0]?.sourceName).toBe("The Daily Star");
    expect(items[0]?.description).toContain("12 new plots");
  });
  it("dedupes the same story across sources", () => {
    expect(dedupeKey("RAJUK approves new DAP for Uttara - The Daily Star", "The Daily Star")).toBe(dedupeKey("RAJUK approves new DAP for Uttara!", null));
  });
  it("rejects stale or undated news", () => {
    const now = new Date("2026-09-30T00:00:00Z");
    expect(isFresh("Tue, 29 Sep 2026 08:00:00 GMT", now)).toBe(true);
    expect(isFresh("Mon, 01 Jun 2026 08:00:00 GMT", now)).toBe(false);
    expect(isFresh(null, now)).toBe(false);
  });
  it("keeps only real-estate relevant items", () => {
    expect(looksRelevant("Dhaka metro rail extension")).toBe(true);
    expect(looksRelevant("Football league results")).toBe(false);
  });
  it("rejects AI numbers not present in the source, incl. Bengali digits", () => {
    const src = "RAJUK approves 12 new plots";
    expect(groundedAgainst(src, "রাজউক ১২টি নতুন প্লট অনুমোদন করেছে").ok).toBe(true);
    const bad = groundedAgainst(src, "দাম 20% বাড়বে");
    expect(bad.ok).toBe(false);
    expect(bad.unsupported).toContain("20");
  });
});
