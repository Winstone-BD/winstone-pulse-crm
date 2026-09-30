import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { NEWS_CATEGORY_CODES } from "@/lib/market-news-rules";

const Tok = { adminToken: z.string().nullable().optional() };
const s = () => import("@/lib/market-news.server");

export const newsFeed = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z.object({ ...Tok, category: z.enum(NEWS_CATEGORY_CODES).nullable().optional(), includeHidden: z.boolean().optional(), cursor: z.string().nullable().optional() }).parse(d),
  )
  .handler(async ({ data }) => {
    const m = await s();
    const c = await m.newsCaller(data.adminToken);
    return { scope: c.scope, ...(await m.listNews(c, { category: data.category ?? null, includeHidden: data.includeHidden === true, cursor: data.cursor ?? null, limit: 20 })) };
  });

export const newsPublishManual = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z.object({
      ...Tok,
      headline: z.string().trim().min(4).max(200),
      summary: z.string().trim().min(10).max(2000),
      keyPoints: z.array(z.string().trim().min(1).max(200)).max(5),
      category: z.enum(NEWS_CATEGORY_CODES),
      sourceUrl: z.string().url().max(500).nullable(),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    const m = await s();
    return m.publishManual(await m.newsCaller(data.adminToken), data);
  });

export const newsSetStatus = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ ...Tok, id: z.string().uuid(), status: z.enum(["published", "unpublished"]) }).parse(d))
  .handler(async ({ data }) => {
    const m = await s();
    return m.setNewsStatus(await m.newsCaller(data.adminToken), data.id, data.status);
  });

export const newsEdit = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z.object({ ...Tok, id: z.string().uuid(), headline: z.string().trim().min(4).max(200), summary: z.string().trim().min(10).max(2000), salesInsight: z.string().max(400).nullable() }).parse(d),
  )
  .handler(async ({ data }) => {
    const m = await s();
    return m.editNews(await m.newsCaller(data.adminToken), data.id, data);
  });

export const newsCollectNow = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object(Tok).parse(d))
  .handler(async ({ data }) => {
    const m = await s();
    const c = await m.newsCaller(data.adminToken);
    if (c.scope !== "authority") throw new Error("শুধু HQ");
    return m.collectNews(c.actor);
  });

export const newsRuns = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object(Tok).parse(d))
  .handler(async ({ data }) => {
    const m = await s();
    return m.lastRuns(await m.newsCaller(data.adminToken));
  });
