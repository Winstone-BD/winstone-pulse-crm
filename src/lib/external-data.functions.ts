import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createRateLimiter } from "@/lib/rate-limit";

/** HQ/IT-only, rate-limited wrappers for Firecrawl scrape and Places search. */
const limiter = createRateLimiter(10, 60_000);
const Token = z.string().max(4096).nullable().optional();

async function authorize(token: string | null | undefined, bucket: string) {
  const { resolveCaller } = await import("@/lib/access.server");
  const c = await resolveCaller(token ?? null);
  if (c.scope !== "authority") throw new Error("Only HQ / IT admins can use this");
  const key = `${bucket}:${c.userId ?? "pin"}`;
  if (!limiter(key)) throw new Error(`Too many requests — try again in ${limiter.retryAfter(key)}s`);
}

export const scrapeAllowedPage = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ adminToken: Token, url: z.string().min(8).max(2048) }).parse(i))
  .handler(async ({ data }) => {
    await authorize(data.adminToken, "firecrawl");
    const { scrapePage } = await import("@/lib/firecrawl.server");
    return scrapePage(data.url);
  });

export const searchPlacesFn = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ adminToken: Token, query: z.string().min(2).max(200) }).parse(i))
  .handler(async ({ data }) => {
    await authorize(data.adminToken, "places");
    const { searchPlaces } = await import("@/lib/maps.server");
    return searchPlaces(data.query);
  });
