import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { getAdminToken } from "@/lib/local-session";
import { draftMarketingPost, getProjectCatalog, saveMarketingPost } from "@/lib/sales-drafts.functions";

export const Route = createFileRoute("/marketing")({
  head: () => ({
    meta: [
      { title: "Marketing Drafts — WINSTONE PULSE" },
      { name: "description", content: "Write real estate ads from verified project facts and preview them as Facebook, Instagram or WhatsApp posts before sharing." },
      { property: "og:title", content: "Marketing Drafts — WINSTONE PULSE" },
      { property: "og:description", content: "Draft and preview social real estate ads from the CRM." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  ssr: false,
  component: Marketing,
});

type Platform = "facebook" | "instagram" | "whatsapp";

function Marketing() {
  const token = getAdminToken();
  const catalogFn = useServerFn(getProjectCatalog);
  const draftFn = useServerFn(draftMarketingPost);
  const saveFn = useServerFn(saveMarketingPost);
  const catalog = useQuery({ queryKey: ["project-catalog"], queryFn: () => catalogFn({ data: { token } }) });
  const [projectId, setProjectId] = useState("");
  const [angle, setAngle] = useState("");
  const [lang, setLang] = useState<"bn" | "en">("bn");
  const [phone, setPhone] = useState("");
  const [headline, setHeadline] = useState("");
  const [body, setBody] = useState("");
  const [platform, setPlatform] = useState<Platform>("facebook");
  const project = catalog.data?.find((p) => p.id === projectId);
  const text = [headline, body].filter(Boolean).join("\n\n");

  const ai = useMutation({
    mutationFn: () => draftFn({ data: { token, projectId, angle, lang, phone: phone || null } }),
    onSuccess: (r) => { setHeadline(r.headline); setBody(r.body); if (r.flagged) toast.warning("Your angle contained instruction-like text; it was treated as plain notes."); },
    onError: (e) => toast.error((e as Error).message),
  });
  const save = useMutation({
    mutationFn: () => saveFn({ data: { token, text } }),
    onSuccess: () => toast.success("Draft saved to your history"),
    onError: (e) => toast.error((e as Error).message),
  });
  const copy = async () => { await navigator.clipboard.writeText(text); toast.success("Copied — paste it into your post"); };
  const shareNative = async () => {
    if (navigator.share) await navigator.share({ text }).catch(() => undefined);
    else copy();
  };

  return (
    <main className="mx-auto max-w-6xl px-4 py-6">
      <header className="border-b border-border pb-4">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">WINSTONE PULSE · Marketing</p>
        <h1 className="text-2xl font-semibold">Marketing drafts</h1>
        <p className="text-sm text-muted-foreground">Write an ad from verified project facts, preview it, then share it yourself. Nothing is posted automatically.</p>
      </header>

      <div className="mt-6 grid gap-6 md:grid-cols-2">
        <section className="space-y-3">
          <label className="block text-sm font-medium">Project
            <select value={projectId} onChange={(e) => setProjectId(e.target.value)} className="mt-1 w-full rounded-md border border-border bg-background px-2 py-2 text-sm">
              <option value="">Choose a project…</option>
              {(catalog.data ?? []).map((p) => <option key={p.id} value={p.id}>{p.name}{p.location ? ` — ${p.location}` : ""}</option>)}
            </select>
          </label>
          {catalog.isError ? <p className="text-sm text-destructive">{(catalog.error as Error).message}</p> : null}
          <label className="block text-sm font-medium">Angle (optional)
            <Input value={angle} onChange={(e) => setAngle(e.target.value)} maxLength={500} placeholder="e.g. family buyers, NRB investors, ready flats" />
          </label>
          <div className="flex gap-3">
            <label className="flex-1 text-sm font-medium">Language
              <select value={lang} onChange={(e) => setLang(e.target.value as "bn" | "en")} className="mt-1 w-full rounded-md border border-border bg-background px-2 py-2 text-sm">
                <option value="bn">বাংলা</option><option value="en">English</option>
              </select>
            </label>
            <label className="flex-1 text-sm font-medium">Your phone (optional)
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={20} inputMode="tel" />
            </label>
          </div>
          <Button disabled={!projectId || ai.isPending} onClick={() => ai.mutate()}>{ai.isPending ? "Writing…" : "Draft with Winstone AI"}</Button>
          <p className="text-xs text-muted-foreground">AI uses only saved project facts — no invented prices, discounts or returns. Always review before posting.</p>
          <label className="block text-sm font-medium">Headline
            <Input value={headline} onChange={(e) => setHeadline(e.target.value)} maxLength={120} />
          </label>
          <label className="block text-sm font-medium">Post text
            <Textarea rows={8} value={body} onChange={(e) => setBody(e.target.value)} maxLength={1500} />
          </label>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" disabled={!text} onClick={copy}>Copy text</Button>
            <Button variant="outline" disabled={!text} asChild={!!text}>
              {text ? <a href={`https://wa.me/?text=${encodeURIComponent(text)}`} target="_blank" rel="noreferrer">Share on WhatsApp</a> : <span>Share on WhatsApp</span>}
            </Button>
            <Button variant="outline" disabled={!text} onClick={shareNative}>Share…</Button>
            <Button disabled={!text || save.isPending} onClick={() => save.mutate()}>Save draft</Button>
          </div>
        </section>

        <section>
          <div className="mb-3 flex gap-1" role="tablist" aria-label="Preview style">
            {(["facebook", "instagram", "whatsapp"] as Platform[]).map((p) => (
              <button key={p} role="tab" aria-selected={platform === p} onClick={() => setPlatform(p)}
                className={`rounded-full px-3 py-1 text-xs font-semibold capitalize ${platform === p ? "bg-primary text-primary-foreground" : "border border-border text-muted-foreground"}`}>{p}</button>
            ))}
          </div>
          <PostPreview platform={platform} headline={headline} body={body} projectName={project?.name ?? "Winstone Properties Ltd"} />
        </section>
      </div>
    </main>
  );
}

function PostPreview({ platform, headline, body, projectName }: { platform: Platform; headline: string; body: string; projectName: string }) {
  const empty = !headline && !body;
  const content = empty ? <p className="text-sm text-muted-foreground">Your post preview appears here.</p> : (
    <div className="space-y-2 whitespace-pre-wrap text-sm">{headline ? <p className="font-semibold">{headline}</p> : null}<p>{body}</p></div>
  );
  if (platform === "whatsapp") {
    return (
      <div className="rounded-xl border border-border bg-muted p-4">
        <div className="ml-auto max-w-[85%] rounded-lg rounded-tr-none bg-card p-3 shadow-sm">{content}<p className="mt-1 text-right text-[10px] text-muted-foreground">now</p></div>
      </div>
    );
  }
  return (
    <article className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="flex items-center gap-2 p-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">W</div>
        <div><p className="text-sm font-semibold">Winstone Properties Ltd</p><p className="text-[11px] text-muted-foreground">{platform === "instagram" ? projectName : "Just now · Public"}</p></div>
      </div>
      {platform === "facebook" ? <div className="px-3 pb-3">{content}</div> : null}
      <div className="flex aspect-square items-center justify-center bg-muted p-6 text-center">
        <div><p className="text-xs uppercase tracking-[0.3em] text-primary">Winstone</p><p className="mt-2 text-xl font-semibold">{projectName}</p><p className="mt-1 text-xs text-muted-foreground">Add your own project photo when posting</p></div>
      </div>
      {platform === "instagram" ? <div className="p-3"><p className="mb-1 text-sm font-semibold">winstoneproperties</p>{content}</div> : (
        <div className="flex justify-around border-t border-border p-2 text-xs text-muted-foreground"><span>Like</span><span>Comment</span><span>Share</span></div>
      )}
    </article>
  );
}
