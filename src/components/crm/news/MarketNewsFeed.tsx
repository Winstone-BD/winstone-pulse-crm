import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ExternalLink, EyeOff, Eye, Lightbulb, Pencil, RefreshCw, Sparkles, Megaphone } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useAdminToken } from "@/lib/local-session";
import { NEWS_CATEGORIES, newsCategoryLabel, type NewsCategory } from "@/lib/market-news-rules";
import { newsAutoPublish, newsCollectNow, newsEdit, newsFeed, newsPublishManual, newsRuns, newsSetStatus } from "@/lib/market-news.functions";

type Item = Awaited<ReturnType<typeof newsFeed>>["items"][number];

const when = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("bn-BD", { timeZone: "Asia/Dhaka", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "";

export function MarketNewsFeed({ compact = false, manage = false }: { compact?: boolean; manage?: boolean }) {
  const adminToken = useAdminToken();
  const feed = useServerFn(newsFeed);
  const [cat, setCat] = useState<NewsCategory | null>(null);
  const q = useInfiniteQuery({
    queryKey: ["market-news", adminToken, cat, manage],
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) => feed({ data: { adminToken, category: cat, includeHidden: manage, cursor: pageParam } }),
    getNextPageParam: (p) => p.nextCursor,
  });
  const items = q.data?.pages.flatMap((p) => p.items) ?? [];
  const isHq = q.data?.pages[0]?.scope === "authority";
  const shown = compact ? items.slice(0, 3) : items;

  return (
    <div className="space-y-3">
      {!compact && (
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          <Chip on={cat === null} onClick={() => setCat(null)}>সব</Chip>
          {NEWS_CATEGORIES.map((c) => (
            <Chip key={c.code} on={cat === c.code} onClick={() => setCat(c.code)}>{c.label}</Chip>
          ))}
        </div>
      )}
      {q.isLoading && <div className="grid gap-3 md:grid-cols-2">{[0, 1].map((i) => <div key={i} className="h-40 animate-pulse rounded-2xl bg-muted" />)}</div>}
      {(q.isError || q.data?.pages[0]?.signedOut) && <p className="rounded-xl border border-border bg-card p-4 text-sm">নিউজ দেখতে সাইন ইন করুন অথবা HQ PIN দিন।</p>}
      {!q.isLoading && !q.isError && !q.data?.pages[0]?.signedOut && shown.length === 0 && (
        <p className="rounded-xl border border-dashed border-border p-5 text-center text-sm text-muted-foreground">এখনো কোনো যাচাইকৃত খবর নেই।</p>
      )}
      <div className={compact ? "space-y-2" : "grid gap-3 md:grid-cols-2"}>
        {shown.map((n) => <NewsCard key={n.id} n={n} compact={compact} manage={manage && isHq} />)}
      </div>
      {!compact && q.hasNextPage && (
        <div className="text-center">
          <Button variant="outline" size="sm" onClick={() => q.fetchNextPage()} disabled={q.isFetchingNextPage}>আরও দেখুন</Button>
        </div>
      )}
    </div>
  );
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium ${on ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
      {children}
    </button>
  );
}

function NewsCard({ n, compact, manage }: { n: Item; compact: boolean; manage: boolean }) {
  const adminToken = useAdminToken();
  const qc = useQueryClient();
  const setStatus = useServerFn(newsSetStatus);
  const edit = useServerFn(newsEdit);
  const [editing, setEditing] = useState(false);
  const [h, setH] = useState(n.headline);
  const [s, setS] = useState(n.summary);
  const [ins, setIns] = useState(n.sales_insight ?? "");
  const refresh = () => qc.invalidateQueries({ queryKey: ["market-news"] });
  const toggle = useMutation({
    mutationFn: () => setStatus({ data: { adminToken, id: n.id, status: n.status === "published" ? "unpublished" : "published" } }),
    onSuccess: refresh,
    onError: (e) => toast.error((e as Error).message),
  });
  const save = useMutation({
    mutationFn: () => edit({ data: { adminToken, id: n.id, headline: h, summary: s, salesInsight: ins || null } }),
    onSuccess: () => { setEditing(false); refresh(); toast.success("সংরক্ষিত"); },
    onError: (e) => toast.error((e as Error).message),
  });
  const points = Array.isArray(n.key_points) ? n.key_points : [];

  return (
    <article className={`rounded-2xl border border-border bg-card p-4 shadow-sm ${n.status !== "published" ? "opacity-60" : ""}`}>
      <div className="mb-2 flex flex-wrap items-center gap-1.5 text-[11px]">
        <span className="rounded-full bg-primary/10 px-2 py-0.5 font-medium text-primary">{newsCategoryLabel(n.category)}</span>
        {n.origin === "auto" ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5"><Sparkles className="size-3" />AI সংক্ষেপ</span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5"><Megaphone className="size-3" />HQ</span>
        )}
        {n.status === "pending" && <span className="rounded-full bg-warning/15 px-2 py-0.5 text-warning">অনুমোদন অপেক্ষায়</span>}
        {n.status === "unpublished" && <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-destructive">অপ্রকাশিত</span>}
        <span className="ml-auto text-muted-foreground">{when(n.source_published_at ?? n.created_at)}</span>
      </div>
      {editing ? (
        <div className="space-y-2">
          <Input value={h} onChange={(e) => setH(e.target.value)} />
          <Textarea value={s} onChange={(e) => setS(e.target.value)} rows={4} />
          <Input value={ins} onChange={(e) => setIns(e.target.value)} placeholder="সেলস ইনসাইট (ঐচ্ছিক)" />
          <div className="flex gap-2">
            <Button size="sm" onClick={() => save.mutate()} disabled={save.isPending}>সংরক্ষণ</Button>
            <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>বাতিল</Button>
          </div>
        </div>
      ) : (
        <>
          <h3 className="text-base font-semibold leading-snug">{n.headline}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{n.summary}</p>
          {!compact && points.length > 0 && (
            <ul className="mt-2 list-disc space-y-0.5 pl-5 text-sm">{points.map((p, i) => <li key={i}>{p}</li>)}</ul>
          )}
          {!compact && n.sales_insight && (
            <p className="mt-3 flex gap-2 rounded-xl bg-primary/5 p-2.5 text-sm"><Lightbulb className="mt-0.5 size-4 shrink-0 text-primary" />{n.sales_insight}</p>
          )}
        </>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
        {n.source_url ? (
          <a href={n.source_url} target="_blank" rel="noopener noreferrer" className="inline-flex min-w-0 items-center gap-1 text-primary underline-offset-2 hover:underline">
            <ExternalLink className="size-3.5 shrink-0" /><span className="truncate">উৎস: {n.source_name ?? "মূল খবর"}</span>
          </a>
        ) : (
          <span className="text-muted-foreground">উৎস: {n.source_name ?? n.created_by}</span>
        )}
        {manage && !editing && (
          <span className="ml-auto flex gap-1">
            <Button size="sm" variant="ghost" className="h-8" onClick={() => setEditing(true)}><Pencil className="size-3.5" /></Button>
            <Button size="sm" variant="ghost" className="h-8" onClick={() => toggle.mutate()} disabled={toggle.isPending}>
              {n.status === "published" ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
            </Button>
          </span>
        )}
      </div>
    </article>
  );
}

export function NewsAdminPanel() {
  const adminToken = useAdminToken();
  const qc = useQueryClient();
  const publish = useServerFn(newsPublishManual);
  const collect = useServerFn(newsCollectNow);
  const runsFn = useServerFn(newsRuns);
  const runs = useQuery({ queryKey: ["news-runs", adminToken], queryFn: () => runsFn({ data: { adminToken } }) });
  const autoFn = useServerFn(newsAutoPublish);
  const auto = useQuery({ queryKey: ["news-auto", adminToken], queryFn: () => autoFn({ data: { adminToken } }) });
  const setAuto = useMutation({
    mutationFn: (enabled: boolean) => autoFn({ data: { adminToken, enabled } }),
    onSuccess: () => auto.refetch(),
    onError: (e) => toast.error((e as Error).message),
  });
  const [headline, setHeadline] = useState("");
  const [summary, setSummary] = useState("");
  const [points, setPoints] = useState("");
  const [category, setCategory] = useState<NewsCategory>("announcement");
  const [url, setUrl] = useState("");

  const pub = useMutation({
    mutationFn: () =>
      publish({ data: { adminToken, headline, summary, keyPoints: points.split("\n").map((p) => p.trim()).filter(Boolean).slice(0, 5), category, sourceUrl: url.trim() || null } }),
    onSuccess: () => { setHeadline(""); setSummary(""); setPoints(""); setUrl(""); qc.invalidateQueries({ queryKey: ["market-news"] }); toast.success("প্রকাশিত — সব এজেন্ট দেখতে পাবেন"); },
    onError: (e) => toast.error((e as Error).message),
  });
  const run = useMutation({
    mutationFn: () => collect({ data: { adminToken } }),
    onSuccess: (r) => { qc.invalidateQueries({ queryKey: ["market-news"] }); runs.refetch(); toast.success("skipped" in r && r.skipped ? String(r.reason) : `নতুন ${"added" in r ? r.added : 0}টি খবর যোগ হয়েছে`); },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <section className="space-y-3 rounded-2xl border border-border bg-card p-4">
        <h2 className="font-semibold">HQ নিউজ / ঘোষণা প্রকাশ</h2>
        <Input value={headline} onChange={(e) => setHeadline(e.target.value)} placeholder="শিরোনাম" />
        <Textarea value={summary} onChange={(e) => setSummary(e.target.value)} rows={4} placeholder="বিস্তারিত" />
        <Textarea value={points} onChange={(e) => setPoints(e.target.value)} rows={3} placeholder="মূল পয়েন্ট (প্রতি লাইনে একটি, ঐচ্ছিক)" />
        <div className="grid gap-2 sm:grid-cols-2">
          <select value={category} onChange={(e) => setCategory(e.target.value as NewsCategory)} className="h-9 rounded-md border border-input bg-background px-3 text-sm">
            {NEWS_CATEGORIES.map((c) => <option key={c.code} value={c.code}>{c.label}</option>)}
          </select>
          <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="উৎস লিংক (ঐচ্ছিক)" />
        </div>
        <Button onClick={() => pub.mutate()} disabled={pub.isPending || headline.trim().length < 4 || summary.trim().length < 10}>প্রকাশ করুন</Button>
      </section>
      <section className="space-y-3 rounded-2xl border border-border bg-card p-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-semibold">AI স্বয়ংক্রিয় সংগ্রহ</h2>
          <Button size="sm" variant="outline" onClick={() => run.mutate()} disabled={run.isPending}>
            <RefreshCw className={`size-3.5 ${run.isPending ? "animate-spin" : ""}`} /> এখনই সংগ্রহ
          </Button>
        </div>
        <label className="flex items-center justify-between gap-3 rounded-lg bg-muted/60 px-3 py-2 text-sm">
          <span>{auto.data?.enabled === false ? "AI খবর HQ অনুমোদনের পর প্রকাশ হবে" : "AI খবর সরাসরি প্রকাশ হবে"}</span>
          <input type="checkbox" className="size-4" checked={auto.data?.enabled !== false} disabled={auto.isLoading || setAuto.isPending} onChange={(e) => setAuto.mutate(e.target.checked)} aria-label="AI খবর সরাসরি প্রকাশ" />
        </label>
        <p className="text-xs text-muted-foreground">Google News → প্রাসঙ্গিকতা ও ডুপ্লিকেট ছাঁকনি → AI শুধু উৎসের তথ্য সংক্ষেপ করে → উৎস লিংকসহ ফিডে। উৎসে নেই এমন সংখ্যা থাকলে খবরটি বাতিল হয়।</p>
        <ul className="space-y-1 text-xs">
          {(runs.data ?? []).map((r, i) => (
            <li key={i} className="flex flex-wrap justify-between gap-2 rounded-lg bg-muted/60 px-2 py-1.5">
              <span>{when(r.started_at)}</span>
              <span>{r.status} · পাওয়া {r.fetched ?? 0} · যোগ {r.added ?? 0}{r.error ? ` · ${r.error}` : ""}</span>
            </li>
          ))}
          {runs.data?.length === 0 && <li className="text-muted-foreground">এখনো কোনো সংগ্রহ চালানো হয়নি।</li>}
        </ul>
      </section>
    </div>
  );
}
