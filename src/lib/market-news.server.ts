import {
  NEWS_CATEGORY_CODES,
  NEWS_QUERIES,
  dedupeKey,
  groundedAgainst,
  isFresh,
  looksRelevant,
  parseRss,
  type RssItem,
} from "@/lib/market-news-rules";

const MODEL = "openai/gpt-6-astra";
const PER_RUN_CAP = 12;
const LEASE_MS = 5 * 60_000;

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

export type NewsCaller = { scope: "authority" | "agent"; actor: string; readOnly: boolean };

export async function newsCaller(adminToken: string | null | undefined): Promise<NewsCaller> {
  const { siCaller } = await import("@/lib/sales-intel.server");
  const c = await siCaller(adminToken);
  return { scope: c.scope, actor: c.actor, readOnly: c.readOnly };
}
function requireHq(c: NewsCaller) {
  if (c.scope !== "authority") throw new Error("শুধু HQ নিউজ পরিচালনা করতে পারে");
}

export type NewsRow = {
  id: string; origin: string; status: string; headline: string; summary: string; key_points: string[];
  category: string; tags: string[]; sales_insight: string | null; source_name: string | null; source_url: string | null;
  source_published_at: string | null; created_by: string; created_at: string;
};
const COLS = "id,origin,status,headline,summary,key_points,category,tags,sales_insight,source_name,source_url,source_published_at,created_by,created_at";

export async function listNews(c: NewsCaller, f: { category?: string | null; includeHidden?: boolean; cursor?: string | null; limit: number }) {
  const db = await admin();
  let q = db.from("market_news").select(COLS).order("created_at", { ascending: false }).limit(f.limit + 1);
  if (!(f.includeHidden && c.scope === "authority")) q = q.eq("status", "published");
  if (f.category) q = q.eq("category", f.category);
  if (f.cursor) q = q.lt("created_at", f.cursor);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as unknown as NewsRow[];
  const more = rows.length > f.limit;
  const items = rows.slice(0, f.limit);
  return { items, nextCursor: more ? items[items.length - 1]?.created_at ?? null : null };
}

async function audit(newsId: string | null, action: string, actor: string, detail: unknown) {
  const db = await admin();
  await db.from("market_news_audit").insert({ news_id: newsId, action, actor, detail: detail as never });
}

export async function publishManual(c: NewsCaller, input: { headline: string; summary: string; keyPoints: string[]; category: string; sourceUrl: string | null }) {
  requireHq(c);
  const db = await admin();
  const { data, error } = await db
    .from("market_news")
    .insert({
      origin: "manual", status: "published", headline: input.headline, summary: input.summary, key_points: input.keyPoints,
      category: input.category, source_name: "Winstone HQ", source_url: input.sourceUrl,
      dedupe_key: `manual:${crypto.randomUUID()}`, created_by: c.actor,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  await audit(data.id, "manual_publish", c.actor, { headline: input.headline });
  return { id: data.id };
}

export async function setNewsStatus(c: NewsCaller, id: string, status: "published" | "unpublished") {
  requireHq(c);
  const db = await admin();
  const { error } = await db.from("market_news").update({ status, updated_by: c.actor, updated_at: new Date().toISOString() }).eq("id", id);
  if (error) throw new Error(error.message);
  await audit(id, status === "published" ? "publish" : "unpublish", c.actor, null);
  return { ok: true };
}

export async function editNews(c: NewsCaller, id: string, patch: { headline: string; summary: string; salesInsight: string | null }) {
  requireHq(c);
  const db = await admin();
  const { data: before } = await db.from("market_news").select("headline,summary,sales_insight").eq("id", id).single();
  const { error } = await db
    .from("market_news")
    .update({ headline: patch.headline, summary: patch.summary, sales_insight: patch.salesInsight, updated_by: c.actor, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
  await audit(id, "edit", c.actor, { before, after: patch });
  return { ok: true };
}

/* ---------------- Automatic collection ---------------- */

async function fetchFeed(query: string): Promise<RssItem[]> {
  const bn = /[\u0980-\u09FF]/.test(query);
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}+when:14d&hl=${bn ? "bn" : "en-BD"}&gl=BD&ceid=BD:${bn ? "bn" : "en"}`;
  const r = await fetch(url, { headers: { "User-Agent": "WinstoneCRM-News/1.0" } });
  if (!r.ok) return [];
  return parseRss(await r.text());
}

type AiItem = { i: number; relevant: boolean; headline: string; summary: string; key_points: string[]; category: string; tags: string[]; sales_insight: string | null };

const SYSTEM = `You are the Market News desk for a Bangladesh real-estate sales CRM.
You receive news items retrieved from Google News (title, source, snippet). You must ONLY restate what the
retrieved text says. Never add facts, numbers, dates, prices, names or outcomes that are not in that item's text.
For each item decide if it is relevant to Bangladesh real estate (property market, RAJUK/regulation, Dhaka/Uttara/
Purbachal areas, metro/infrastructure, housing projects, home-loan/interest rates). Foreign-only news is not relevant.
Write in Bengali. Return JSON: {"items":[{"i":number,"relevant":boolean,"headline":"short Bengali headline",
"summary":"1-3 Bengali sentences restating the source only","key_points":["max 3 short points from the source"],
"category":"one of ${NEWS_CATEGORY_CODES.filter((c) => c !== "announcement").join("|")}","tags":["max 4 short tags"],
"sales_insight":"one Bengali sentence on how an agent could mention this in a conversation, phrased as context not a promise; null if none"}]}`;

async function summarise(batch: RssItem[]): Promise<AiItem[]> {
  const key = process.env["LOVABLE_API_KEY"];
  if (!key) throw new Error("AI সেট করা নেই");
  const payload = batch.map((b, i) => ({ i, title: b.title, source: b.sourceName, snippet: b.description.slice(0, 600) }));
  const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}`, "X-Lovable-AIG-SDK": "fetch" },
    body: JSON.stringify({
      model: MODEL,
      reasoning_effort: "low",
      messages: [{ role: "system", content: SYSTEM }, { role: "user", content: JSON.stringify(payload) }],
      response_format: { type: "json_object" },
    }),
  });
  if (r.status === 402 || r.status === 403) throw Object.assign(new Error(`AI বন্ধ/ক্রেডিট শেষ (${r.status})`), { pause: true });
  if (!r.ok) throw new Error(`AI ত্রুটি ${r.status}`);
  const j = (await r.json()) as { choices?: { message?: { content?: string } }[] };
  const raw = (j.choices?.[0]?.message?.content ?? "").replace(/^```(json)?|```$/g, "").trim();
  const parsed = JSON.parse(raw || "{}") as { items?: AiItem[] };
  return Array.isArray(parsed.items) ? parsed.items : [];
}

export async function collectNews(actor: string) {
  const db = await admin();
  const now = new Date();
  // single-flight lease
  const { data: running } = await db.from("market_news_runs").select("id").eq("status", "running").gt("lease_until", now.toISOString()).limit(1);
  if (running && running.length) return { skipped: true, reason: "আরেকটি সংগ্রহ চলছে" };
  const { data: paused } = await db.from("market_news_runs").select("error").eq("status", "paused").order("started_at", { ascending: false }).limit(1);
  const { data: run } = await db.from("market_news_runs").insert({ lease_until: new Date(now.getTime() + LEASE_MS).toISOString() }).select("id").single();
  const runId = run?.id as string;
  let fetched = 0, added = 0, skipped = 0;
  try {
    // Official Winstone news from the Knowledge Hub: copied verbatim, no AI.
    const { importOfficialNews } = await import("@/lib/knowledge-hub.server");
    const official = await importOfficialNews(actor).catch(() => ({ fetched: 0, added: 0 }));
    fetched += official.fetched; added += official.added;
    const all: RssItem[] = [];
    for (const q of NEWS_QUERIES) all.push(...(await fetchFeed(q).catch(() => [])));
    fetched += all.length;
    const seen = new Set<string>();
    const fresh = all.filter((it) => {
      const k = dedupeKey(it.title, it.sourceName);
      if (!k || seen.has(k)) return false;
      seen.add(k);
      return isFresh(it.pubDate, now) && looksRelevant(`${it.title} ${it.description}`);
    });
    const keys = fresh.map((f) => dedupeKey(f.title, f.sourceName));
    const existing = new Set<string>();
    for (let i = 0; i < keys.length; i += 200) {
      const { data } = await db.from("market_news").select("dedupe_key").in("dedupe_key", keys.slice(i, i + 200));
      for (const d of data ?? []) existing.add(d.dedupe_key as string);
    }
    const todo = fresh.filter((f) => !existing.has(dedupeKey(f.title, f.sourceName))).slice(0, paused?.length ? 1 : PER_RUN_CAP);
    skipped = all.length - todo.length;
    const autoPublish = await getAutoPublish();
    if (todo.length) {
      const ai = await summarise(todo);
      for (const a of ai) {
        const src = todo[a.i];
        if (!src || !a.relevant || !a.headline || !a.summary) { skipped++; continue; }
        const sourceText = `${src.title} ${src.description}`;
        const g = groundedAgainst(sourceText, [a.headline, a.summary, ...(a.key_points ?? []), a.sales_insight ?? ""].join(" "));
        if (!g.ok) { skipped++; await audit(null, "rejected_ungrounded", actor, { title: src.title, unsupported: g.unsupported }); continue; }
        const category = (NEWS_CATEGORY_CODES as readonly string[]).includes(a.category) ? a.category : "market";
        const pub = src.pubDate ? new Date(src.pubDate).toISOString() : null;
        const { data: ins, error } = await db
          .from("market_news")
          .insert({
            origin: "auto", status: autoPublish ? "published" : "pending", headline: a.headline.slice(0, 200), summary: a.summary.slice(0, 1200),
            key_points: (a.key_points ?? []).slice(0, 3), category, tags: (a.tags ?? []).slice(0, 4), sales_insight: a.sales_insight,
            source_name: src.sourceName, source_url: src.link, source_title: src.title,
            retrieved_excerpt: sourceText.slice(0, 2000), source_published_at: pub,
            dedupe_key: dedupeKey(src.title, src.sourceName), ai_model: MODEL, created_by: actor,
          })
          .select("id")
          .single();
        if (error) { skipped++; continue; }
        added++;
        await audit(ins.id, "auto_collect", actor, { source: src.link });
      }
    }
    await db.from("market_news_runs").update({ status: "done", finished_at: new Date().toISOString(), fetched, added, skipped }).eq("id", runId);
    return { skipped: false, fetched, added };
  } catch (e) {
    const pause = (e as { pause?: boolean }).pause === true;
    await db.from("market_news_runs").update({ status: pause ? "paused" : "failed", finished_at: new Date().toISOString(), error: (e as Error).message, fetched, added, skipped }).eq("id", runId);
    throw e;
  }
}

export async function lastRuns(c: NewsCaller) {
  requireHq(c);
  const db = await admin();
  const { data } = await db.from("market_news_runs").select("started_at,status,fetched,added,skipped,error").order("started_at", { ascending: false }).limit(5);
  return data ?? [];
}

/** HQ setting: publish AI items immediately, or hold them as pending for HQ approval. Default: publish. */
export async function getAutoPublish() {
  const db = await admin();
  const { data } = await db.from("system_settings").select("value").eq("key", "news_auto_publish").maybeSingle();
  const v = data?.value as { enabled?: boolean } | null | undefined;
  return v?.enabled !== false;
}

export async function setAutoPublish(c: NewsCaller, enabled: boolean) {
  requireHq(c);
  const db = await admin();
  const { error } = await db.from("system_settings").upsert({ key: "news_auto_publish", value: { enabled } as never }, { onConflict: "key" });
  if (error) throw new Error(error.message);
  await audit(null, enabled ? "auto_publish_on" : "auto_publish_off", c.actor, null);
  return { enabled };
}
