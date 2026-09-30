import { describe, expect, it } from "vitest";

import { htmlToText, rankPages } from "@/lib/website-knowledge.server";

const pages = [
  { url: "https://x.com/blog", title: "Blog", content: "random notes", fetchedAt: "2026-01-01" },
  {
    url: "https://x.com/sales",
    title: "Sales — Prices",
    content: "price list and payment terms",
    fetchedAt: "2026-01-01",
  },
];

describe("website knowledge", () => {
  it("reads visible text and the title out of a page", () => {
    const { title, text } = htmlToText(
      "<html><head><title>Winstone &amp; Co</title></head><body><script>bad()</script><p>Uttara plot</p></body></html>",
    );
    expect(title).toBe("Winstone & Co");
    expect(text).toContain("Uttara plot");
    expect(text).not.toContain("bad()");
  });

  it("ranks the matching page first", () => {
    expect(rankPages(pages, "what is the price", 1)[0]?.url).toBe("https://x.com/sales");
  });

  it("still returns high-signal pages when no keyword matches (Bengali question)", () => {
    const picked = rankPages(pages, "দাম কত", 2);
    expect(picked).toHaveLength(2);
    expect(picked[0]?.url).toBe("https://x.com/sales");
  });
});
