import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { MessageSquareText } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { getSocialSetup, saveSocialPage, saveSocialTemplate, socialReport } from "@/lib/social.functions";
import { useAdminToken } from "@/lib/local-session";
import { useT } from "@/lib/i18n";

/** HQ/IT: real per-agent social work counts, page/group list and approved replies. */
export function SocialHqPanel() {
  const t = useT();
  const adminToken = useAdminToken();
  const qc = useQueryClient();
  const [range, setRange] = useState<"today" | "month">("today");
  const reportFn = useServerFn(socialReport);
  const setupFn = useServerFn(getSocialSetup);
  const pageFn = useServerFn(saveSocialPage);
  const tplFn = useServerFn(saveSocialTemplate);
  const report = useQuery({ queryKey: ["social-report", range, adminToken], queryFn: () => reportFn({ data: { adminToken, range } }), enabled: Boolean(adminToken) });
  const setup = useQuery({ queryKey: ["social-setup", adminToken], queryFn: () => setupFn({ data: { adminToken } }), enabled: Boolean(adminToken) });
  const done = () => { toast.success(t({ bn: "সংরক্ষিত", en: "Saved" })); void qc.invalidateQueries({ queryKey: ["social-setup"] }); };
  const page = useMutation({ mutationFn: (v: Parameters<typeof pageFn>[0]["data"]) => pageFn({ data: v }), onSuccess: done, onError: (e: Error) => toast.error(e.message) });
  const tpl = useMutation({ mutationFn: (v: Parameters<typeof tplFn>[0]["data"]) => tplFn({ data: v }), onSuccess: done, onError: (e: Error) => toast.error(e.message) });
  const [pName, setPName] = useState(""); const [pKind, setPKind] = useState<"page" | "group">("page"); const [pUrl, setPUrl] = useState("");
  const [tTitle, setTTitle] = useState(""); const [tBody, setTBody] = useState("");
  const rows = report.data ?? [];
  const heads = [t({ bn: "এজেন্ট", en: "Agent" }), t({ bn: "এন্ট্রি", en: "Entries" }), t({ bn: "উত্তর", en: "Replies" }), t({ bn: "লিড", en: "Leads" }), t({ bn: "সাইট ভিজিট", en: "Visits" }), t({ bn: "বুকিং", en: "Bookings" })];

  return <section className="card-elevated space-y-4 p-4" aria-labelledby="social-hq-h">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h2 id="social-hq-h" className="flex items-center gap-2 font-bold"><MessageSquareText className="size-5 text-primary" />{t({ bn: "সোশ্যাল মিডিয়া কাজ", en: "Social media work" })}</h2>
      <div className="flex gap-1">{(["today", "month"] as const).map((r) => <Button key={r} size="sm" variant={range === r ? "default" : "outline"} aria-pressed={range === r} onClick={() => setRange(r)}>{r === "today" ? t({ bn: "আজ", en: "Today" }) : t({ bn: "এই মাস", en: "This month" })}</Button>)}</div>
    </div>
    {report.isError ? <p className="text-sm text-destructive">{(report.error as Error).message}</p>
      : !rows.length ? <p className="text-sm text-muted-foreground">{report.isLoading ? "…" : t({ bn: "এই সময়ে কোনো এন্ট্রি নেই", en: "No entries in this period" })}</p>
      : <>
        <ul className="grid gap-2 md:hidden">{rows.map((r) => <li key={r.agentId} className="rounded-lg border border-border p-3 text-sm"><p className="font-semibold">{r.name}</p>
          <p className="text-xs text-muted-foreground">{r.entries} {heads[1]} · {r.replies} {heads[2]} · {r.leads} {heads[3]} · {r.visits} {heads[4]} · {r.bookings} {heads[5]}</p></li>)}</ul>
        <table className="hidden w-full text-sm md:table"><thead><tr className="text-left text-xs text-muted-foreground">{heads.map((h) => <th key={h} className="py-1">{h}</th>)}</tr></thead>
          <tbody>{rows.map((r) => <tr key={r.agentId} className="border-t border-border tabular-nums"><td className="py-1.5 font-medium">{r.name}</td><td>{r.entries}</td><td>{r.replies}</td><td>{r.leads}</td><td>{r.visits}</td><td>{r.bookings}</td></tr>)}</tbody></table>
      </>}

    <details className="rounded-lg border border-border p-3"><summary className="cursor-pointer text-sm font-semibold">{t({ bn: "পেজ ও গ্রুপ", en: "Pages & groups" })} ({setup.data?.pages.length ?? 0})</summary>
      <ul className="mt-2 space-y-1 text-sm">{setup.data?.pages.map((p) => <li key={p.id} className="flex items-center justify-between gap-2"><span>{p.name} <span className="text-xs text-muted-foreground">· {p.kind === "group" ? t({ bn: "গ্রুপ", en: "Group" }) : t({ bn: "পেজ", en: "Page" })}{p.active ? "" : ` · ${t({ bn: "বন্ধ", en: "Off" })}`}</span></span>
        <Button size="sm" variant="ghost" onClick={() => page.mutate({ adminToken, id: p.id, name: p.name, kind: p.kind as "page" | "group", url: p.url, active: !p.active })}>{p.active ? t({ bn: "বন্ধ করুন", en: "Disable" }) : t({ bn: "চালু করুন", en: "Enable" })}</Button></li>)}</ul>
      <form className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto_1fr_auto]" onSubmit={(e) => { e.preventDefault(); page.mutate({ adminToken, name: pName, kind: pKind, url: pUrl || null, active: true }, { onSuccess: () => { setPName(""); setPUrl(""); } }); }}>
        <Input required placeholder={t({ bn: "নাম", en: "Name" })} value={pName} onChange={(e) => setPName(e.target.value)} />
        <select value={pKind} onChange={(e) => setPKind(e.target.value as "page" | "group")} className="h-10 rounded-md border border-input bg-background px-2 text-sm"><option value="page">{t({ bn: "পেজ", en: "Page" })}</option><option value="group">{t({ bn: "গ্রুপ", en: "Group" })}</option></select>
        <Input type="url" placeholder="https://facebook.com/…" value={pUrl} onChange={(e) => setPUrl(e.target.value)} />
        <Button type="submit" disabled={page.isPending}>{t({ bn: "যোগ করুন", en: "Add" })}</Button>
      </form></details>

    <details className="rounded-lg border border-border p-3"><summary className="cursor-pointer text-sm font-semibold">{t({ bn: "তৈরি উত্তর", en: "Reply templates" })} ({setup.data?.templates.length ?? 0})</summary>
      <ul className="mt-2 space-y-2 text-sm">{setup.data?.templates.map((tp) => <li key={tp.id} className="rounded border border-border p-2"><div className="flex items-center justify-between gap-2"><span className="font-medium">{tp.title}{tp.active ? "" : ` · ${t({ bn: "বন্ধ", en: "Off" })}`}</span>
        <Button size="sm" variant="ghost" onClick={() => tpl.mutate({ adminToken, id: tp.id, title: tp.title, body: tp.body, active: !tp.active })}>{tp.active ? t({ bn: "বন্ধ করুন", en: "Disable" }) : t({ bn: "চালু করুন", en: "Enable" })}</Button></div>
        <p className="whitespace-pre-wrap text-xs text-muted-foreground">{tp.body}</p></li>)}</ul>
      <form className="mt-3 grid gap-2" onSubmit={(e) => { e.preventDefault(); tpl.mutate({ adminToken, title: tTitle, body: tBody, active: true }, { onSuccess: () => { setTTitle(""); setTBody(""); } }); }}>
        <Input required placeholder={t({ bn: "শিরোনাম", en: "Title" })} value={tTitle} onChange={(e) => setTTitle(e.target.value)} />
        <Textarea required rows={3} placeholder={t({ bn: "উত্তর — শুধু আসল প্রকল্প ও দামের তথ্য", en: "Reply — real project and price facts only" })} value={tBody} onChange={(e) => setTBody(e.target.value)} />
        <Button type="submit" disabled={tpl.isPending}>{t({ bn: "যোগ করুন", en: "Add" })}</Button>
      </form></details>
  </section>;
}
