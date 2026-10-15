import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";

import { approveObjection, getObjectionLibrary } from "@/lib/sales-drafts.functions";
import { getAdminToken } from "@/lib/local-session";

export const Route = createFileRoute("/objections")({
  head: () => ({
    meta: [
      { title: "Objection Library — WINSTONE PULSE" },
      { name: "description", content: "Real customer objections from Winstone call reports with HQ-approved answers for agents." },
      { property: "og:title", content: "Objection Library — WINSTONE PULSE" },
      { property: "og:description", content: "Real objections, HQ-approved answers." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  ssr: false,
  component: Library,
});

function Library() {
  const qc = useQueryClient();
  const load = useServerFn(getObjectionLibrary);
  const save = useServerFn(approveObjection);
  const q = useQuery({ queryKey: ["objections"], queryFn: () => load({ data: { token: getAdminToken() } }) });
  const [edit, setEdit] = useState<Record<string, string>>({});
  const m = useMutation({
    mutationFn: (v: { key: string; objection: string; answer: string }) => save({ data: { token: getAdminToken(), ...v } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["objections"] }),
  });
  return (
    <main className="mx-auto max-w-4xl px-4 py-6">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">WINSTONE PULSE</p>
      <h1 className="text-2xl font-semibold">আপত্তি লাইব্রেরি</h1>
      <p className="text-sm text-muted-foreground">আসল কল থেকে পাওয়া গ্রাহকের আপত্তি। শুধু HQ/IT অনুমোদিত উত্তর এজেন্টরা ব্যবহার করবেন।</p>
      {q.isError ? <p className="mt-4 text-sm text-destructive">{(q.error as Error).message}</p> : null}
      {q.data?.excluded ? <p className="mt-2 text-xs text-destructive">{q.data.excluded}টি আপত্তিতে সন্দেহজনক নির্দেশনা থাকায় বাদ দেওয়া হয়েছে।</p> : null}
      {q.data && q.data.items.length === 0 ? <p className="mt-4 text-sm text-muted-foreground">এখনো কোনো আপত্তি রেকর্ড হয়নি।</p> : null}
      <ul className="mt-4 space-y-3">
        {q.data?.items.map((it) => (
          <li key={it.key} className="rounded-xl border border-border bg-card p-3">
            <p className="text-sm font-semibold">{it.objection} <span className="text-xs text-muted-foreground">· {it.count} বার</span></p>
            {it.answer ? <p className="mt-1 text-sm"><span className="text-primary">অনুমোদিত উত্তর: </span>{it.answer}</p> : <p className="mt-1 text-xs text-muted-foreground">এখনো অনুমোদিত উত্তর নেই — HQ-কে জিজ্ঞাসা করুন।</p>}
            {q.data.canApprove ? (
              <div className="mt-2 flex gap-2">
                <textarea value={edit[it.key] ?? it.answer ?? ""} onChange={(e) => setEdit({ ...edit, [it.key]: e.target.value })}
                  className="min-h-16 flex-1 rounded-md border border-border bg-background p-2 text-sm" placeholder="অনুমোদিত উত্তর লিখুন (দাম/ছাড়ের প্রতিশ্রুতি নয়)" />
                <button disabled={m.isPending || (edit[it.key] ?? "").trim().length < 5}
                  onClick={() => m.mutate({ key: it.key, objection: it.objection, answer: (edit[it.key] ?? "").trim() })}
                  className="self-start rounded-md border border-primary px-3 py-1 text-xs font-semibold text-primary disabled:opacity-50">অনুমোদন</button>
              </div>
            ) : null}
          </li>
        ))}
      </ul>
      {m.isError ? <p className="mt-2 text-sm text-destructive">{(m.error as Error).message}</p> : null}
    </main>
  );
}
