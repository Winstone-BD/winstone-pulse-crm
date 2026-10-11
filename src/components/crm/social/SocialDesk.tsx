import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Copy, MessageSquareText, UserPlus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { getSocialSetup, listMySocial, logSocialActivity, convertSocialToLead, voidSocialActivity, type SocialKind } from "@/lib/social.functions";
import { useAdminToken } from "@/lib/local-session";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export const KIND_LABEL: Record<SocialKind, { bn: string; en: string }> = {
  inbox: { bn: "ইনবক্স মেসেজ", en: "Inbox message" },
  page_comment: { bn: "পেজ কমেন্ট", en: "Page comment" },
  group: { bn: "গ্রুপ পোস্ট/কমেন্ট", en: "Group post/comment" },
};

const fmt = (iso: string) => new Date(iso).toLocaleString("bn-BD", { timeZone: "Asia/Dhaka", hour: "numeric", minute: "2-digit", day: "numeric", month: "short" });

/** Agent social work log — replies happen in Meta Business Suite; the CRM records them. */
export function SocialDesk() {
  const t = useT();
  const adminToken = useAdminToken();
  const qc = useQueryClient();
  const setupFn = useServerFn(getSocialSetup);
  const mineFn = useServerFn(listMySocial);
  const logFn = useServerFn(logSocialActivity);
  const leadFn = useServerFn(convertSocialToLead);
  const voidFn = useServerFn(voidSocialActivity);
  const setup = useQuery({ queryKey: ["social-setup", adminToken], queryFn: () => setupFn({ data: { adminToken } }), staleTime: 300_000 });
  const mine = useQuery({ queryKey: ["social-mine", adminToken], queryFn: () => mineFn({ data: { adminToken } }) });

  const [kind, setKind] = useState<SocialKind>("inbox");
  const [pageId, setPageId] = useState("");
  const [link, setLink] = useState("");
  const [note, setNote] = useState("");
  const [count, setCount] = useState(1);
  const [lead, setLead] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");

  const reset = () => { setLink(""); setNote(""); setCount(1); setName(""); setPhone(""); setLead(false); };
  const base = () => ({ adminToken, kind, pageId, link: link.trim() || null, note: note.trim() || null, replyCount: count });
  const save = useMutation({
    mutationFn: async () => lead ? leadFn({ data: { ...base(), name, phone } }) : logFn({ data: base() }),
    onSuccess: (r) => {
      toast.success(lead
        ? ("duplicate" in r && r.duplicate ? t({ bn: "নম্বরটি আগে থেকেই আছে — আগের লিডে যুক্ত হলো", en: "Number exists — linked to the existing lead" }) : t({ bn: "লিড তৈরি হলো — LeadHub ভাগ করবে", en: "Lead created — LeadHub will route it" }))
        : t({ bn: "কাজ সংরক্ষিত", en: "Work saved" }));
      reset(); void qc.invalidateQueries({ queryKey: ["social-mine"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const cancel = useMutation({
    mutationFn: (id: string) => voidFn({ data: { adminToken, id } }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["social-mine"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const today = mine.data?.today;
  const pages = setup.data?.pages ?? [];
  const pageName = new Map(pages.map((p) => [p.id, p.name]));

  return <section aria-labelledby="social-h" className="space-y-4">
    <div className="card-elevated space-y-1 p-4">
      <h2 id="social-h" className="flex items-center gap-2 text-base font-bold"><MessageSquareText className="size-5 text-primary" />{t({ bn: "সোশ্যাল মিডিয়া কাজ", en: "Social media work" })}</h2>
      <p className="text-xs text-muted-foreground">{t({ bn: "উত্তর দিন Meta Business Suite বা Facebook অ্যাপে; এখানে শুধু কাজটি লিখে রাখুন।", en: "Reply in Meta Business Suite or Facebook; record the work here." })}</p>
      <dl className="grid grid-cols-3 gap-2 pt-2 text-center">
        {[[t({ bn: "আজ এন্ট্রি", en: "Entries" }), today?.entries], [t({ bn: "আজ উত্তর", en: "Replies" }), today?.replies], [t({ bn: "আজ লিড", en: "Leads" }), today?.leads]].map(([l, v]) =>
          <div key={String(l)} className="rounded-lg bg-muted p-2"><dt className="text-xs text-muted-foreground">{l}</dt><dd className="text-xl font-bold tabular-nums">{mine.isLoading ? "…" : (v ?? 0)}</dd></div>)}
      </dl>
    </div>

    <form className="card-elevated grid gap-3 p-4" onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
      <fieldset className="grid grid-cols-3 gap-2" aria-label={t({ bn: "কাজের ধরন", en: "Kind" })}>
        {(Object.keys(KIND_LABEL) as SocialKind[]).map((k) =>
          <Button key={k} type="button" variant={kind === k ? "default" : "outline"} aria-pressed={kind === k} onClick={() => setKind(k)} className="h-auto min-h-11 whitespace-normal px-2 text-xs">{t(KIND_LABEL[k])}</Button>)}
      </fieldset>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="grid gap-1 text-xs font-medium">{t({ bn: "পেজ / গ্রুপ *", en: "Page / group *" })}
          <select required aria-required="true" aria-invalid={!pageId} value={pageId} onChange={(e) => setPageId(e.target.value)} className="h-10 rounded-md border border-input bg-background px-2 text-sm">
            <option value="">{t({ bn: "— বেছে নিন (বাধ্যতামূলক) —", en: "— required —" })}</option>
            {pages.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select></label>
        <label className="grid gap-1 text-xs font-medium">{t({ bn: "কতগুলো উত্তর", en: "Replies" })}
          <Input type="number" inputMode="numeric" min={1} max={500} value={count} onChange={(e) => setCount(Math.max(1, Math.min(500, Number(e.target.value) || 1)))} /></label>
      </div>
      <Input type="url" placeholder={t({ bn: "পোস্ট/মেসেজের লিংক (ঐচ্ছিক)", en: "Link (optional)" })} value={link} onChange={(e) => setLink(e.target.value)} />
      <Textarea rows={2} maxLength={1000} placeholder={t({ bn: "ছোট নোট (ঐচ্ছিক)", en: "Short note (optional)" })} value={note} onChange={(e) => setNote(e.target.value)} />
      <label className="flex min-h-11 items-center gap-2 text-sm font-medium">
        <input type="checkbox" checked={lead} onChange={(e) => setLead(e.target.checked)} className="size-5" />
        <UserPlus className="size-4 text-success" />{t({ bn: "ক্রেতা ফোন নম্বর দিয়েছেন — লিড বানান", en: "Buyer shared a number — make a lead" })}
      </label>
      {lead && <div className="grid gap-3 sm:grid-cols-2">
        <Input required placeholder={t({ bn: "ক্রেতার নাম", en: "Buyer name" })} value={name} onChange={(e) => setName(e.target.value)} />
        <Input required type="tel" inputMode="tel" placeholder="01XXXXXXXXX" value={phone} onChange={(e) => setPhone(e.target.value)} />
      </div>}
      {!pages.length && <p role="alert" className="text-xs text-destructive">{t({ bn: "HQ এখনো কোনো পেজ/গ্রুপ যোগ করেনি — তাই কাজ জমা দেওয়া যাবে না।", en: "HQ has not added any page/group yet — work cannot be submitted." })}</p>}
      {pages.length > 0 && !pageId && <p className="text-xs text-destructive">{t({ bn: "জমা দিতে পেজ বা গ্রুপ বেছে নিন", en: "Choose a page or group to submit" })}</p>}
      <Button type="submit" disabled={save.isPending || !pageId} className="h-12">{save.isPending ? "…" : t({ bn: "সংরক্ষণ করুন", en: "Save" })}</Button>
    </form>

    <SocialTemplates templates={setup.data?.templates ?? []} />

    <div className="card-elevated p-4">
      <h3 className="mb-2 text-sm font-semibold">{t({ bn: "সাম্প্রতিক এন্ট্রি", en: "Recent entries" })}</h3>
      {mine.isError ? <p className="text-sm text-destructive">{t({ bn: "লোড হয়নি", en: "Failed to load" })} <Button size="sm" variant="outline" onClick={() => mine.refetch()}>{t({ bn: "আবার চেষ্টা", en: "Retry" })}</Button></p>
        : !mine.data?.rows.length ? <p className="text-sm text-muted-foreground">{mine.isLoading ? "…" : t({ bn: "এখনো কোনো এন্ট্রি নেই", en: "No entries yet" })}</p>
        : <ul className="divide-y divide-border">{mine.data.rows.map((r) =>
          <li key={r.id} className={cn("flex items-start justify-between gap-2 py-2 text-sm", r.voided_at && "opacity-60")}>
            <div className="min-w-0">
              <p className="font-medium">{t(KIND_LABEL[r.kind as SocialKind] ?? KIND_LABEL.inbox)} · {r.reply_count} {t({ bn: "উত্তর", en: "replies" })}{r.lead_id && <span className="ml-2 rounded bg-success/15 px-1.5 text-xs text-success">{t({ bn: "লিড", en: "Lead" })}</span>}{r.voided_at && <span className="ml-2 rounded bg-destructive/15 px-1.5 text-xs text-destructive">{t({ bn: "বাতিল", en: "Voided" })}</span>}</p>
              <p className="truncate text-xs text-muted-foreground">{fmt(r.created_at)}{r.page_id && pageName.get(r.page_id) ? ` · ${pageName.get(r.page_id)}` : ""}{r.note ? ` · ${r.note}` : ""}</p>
            </div>
            {!r.voided_at && <Button size="sm" variant="ghost" disabled={cancel.isPending} onClick={() => cancel.mutate(r.id)}>{t({ bn: "বাতিল", en: "Void" })}</Button>}
          </li>)}</ul>}
    </div>
  </section>;
}

function SocialTemplates({ templates }: { templates: { id: string; title: string; body: string }[] }) {
  const t = useT();
  if (!templates.length) return null;
  return <details className="card-elevated group p-4">
    <summary className="cursor-pointer text-sm font-semibold">{t({ bn: "HQ অনুমোদিত তৈরি উত্তর", en: "HQ-approved replies" })} ({templates.length})</summary>
    <ul className="mt-3 space-y-2">{templates.map((tp) => <li key={tp.id} className="rounded-lg border border-border p-3">
      <div className="flex items-center justify-between gap-2"><p className="text-sm font-medium">{tp.title}</p>
        <Button size="sm" variant="outline" aria-label={t({ bn: "কপি করুন", en: "Copy" })} onClick={() => navigator.clipboard.writeText(tp.body).then(() => toast.success(t({ bn: "কপি হয়েছে", en: "Copied" })))}><Copy className="size-4" /></Button></div>
      <p className="mt-1 whitespace-pre-wrap text-xs text-muted-foreground">{tp.body}</p>
    </li>)}</ul>
  </details>;
}
