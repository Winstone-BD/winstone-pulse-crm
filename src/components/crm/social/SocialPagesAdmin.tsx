import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Globe, Pencil, Plus, Users, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getSocialSetup, saveSocialPage } from "@/lib/social.functions";
import { useAdminToken } from "@/lib/local-session";
import { useT } from "@/lib/i18n";
import { SocialPageAuditLog, SocialPageSummaryTable } from "@/components/crm/social/SocialPageInsights";

type PageRow = { id: string; name: string; kind: string; url: string | null; active: boolean };

/** HQ/IT: create, edit and disable the pages/groups agents pick when logging social work. */
export function SocialPagesAdmin() {
  const t = useT();
  const adminToken = useAdminToken();
  const qc = useQueryClient();
  const setupFn = useServerFn(getSocialSetup);
  const pageFn = useServerFn(saveSocialPage);
  const setup = useQuery({
    queryKey: ["social-setup", adminToken],
    queryFn: () => setupFn({ data: { adminToken } }),
    enabled: Boolean(adminToken),
  });

  const [editing, setEditing] = useState<PageRow | null>(null);
  const [name, setName] = useState("");
  const [kind, setKind] = useState<"page" | "group">("page");
  const [url, setUrl] = useState("");

  const reset = () => { setEditing(null); setName(""); setKind("page"); setUrl(""); };
  const startEdit = (p: PageRow) => { setEditing(p); setName(p.name); setKind(p.kind === "group" ? "group" : "page"); setUrl(p.url ?? ""); };

  const save = useMutation({
    mutationFn: (v: { adminToken: string | null; id?: string | null; name: string; kind: "page" | "group"; url: string | null; active: boolean }) => pageFn({ data: v }),
    onSuccess: () => {
      toast.success(t({ bn: "সংরক্ষিত", en: "Saved" }));
      void qc.invalidateQueries({ queryKey: ["social-setup"] });
      void qc.invalidateQueries({ queryKey: ["social-page-audit"] });
      reset();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggle = (p: PageRow) =>
    save.mutate({ adminToken, id: p.id, name: p.name, kind: p.kind === "group" ? "group" : "page", url: p.url, active: !p.active });

  const pages = setup.data?.pages ?? [];
  const active = pages.filter((p) => p.active).length;

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4">
      <header>
        <h1 className="flex items-center gap-2 text-xl font-bold">
          <Globe className="size-5 text-primary" />
          {t({ bn: "সোশ্যাল পেজ ও গ্রুপ", en: "Social pages & groups" })}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t({
            bn: "এজেন্টরা কাজ জমা দেওয়ার সময় এই তালিকা থেকে পেজ বা গ্রুপ বেছে নেয়। বন্ধ করা পেজ এজেন্টদের তালিকায় দেখায় না, তবে পুরনো রেকর্ডে উৎস থেকে যায়।",
            en: "Agents pick from this list when submitting work. Disabled pages stay on old records but no longer appear to agents.",
          })}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          {t({ bn: "মোট", en: "Total" })}: {pages.length} · {t({ bn: "চালু", en: "Active" })}: {active}
        </p>
      </header>

      <form
        className="card-elevated grid gap-2 p-4 sm:grid-cols-[1fr_auto_1fr_auto]"
        aria-label={editing ? t({ bn: "পেজ সম্পাদনা", en: "Edit page" }) : t({ bn: "নতুন পেজ", en: "New page" })}
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate({ adminToken, id: editing?.id ?? null, name, kind, url: url || null, active: editing ? editing.active : true });
        }}
      >
        <Input required maxLength={120} placeholder={t({ bn: "নাম", en: "Name" })} value={name} onChange={(e) => setName(e.target.value)} />
        <select value={kind} onChange={(e) => setKind(e.target.value as "page" | "group")} className="h-10 rounded-md border border-input bg-background px-2 text-sm">
          <option value="page">{t({ bn: "পেজ", en: "Page" })}</option>
          <option value="group">{t({ bn: "গ্রুপ", en: "Group" })}</option>
        </select>
        <Input type="url" maxLength={500} placeholder="https://facebook.com/…" value={url} onChange={(e) => setUrl(e.target.value)} />
        <div className="flex gap-1">
          <Button type="submit" disabled={save.isPending}>
            {editing ? t({ bn: "হালনাগাদ", en: "Update" }) : <><Plus className="size-4" /> {t({ bn: "যোগ করুন", en: "Add" })}</>}
          </Button>
          {editing ? <Button type="button" variant="ghost" onClick={reset}><X className="size-4" /></Button> : null}
        </div>
      </form>

      {setup.isError ? (
        <p className="text-sm text-destructive">{(setup.error as Error).message}</p>
      ) : setup.isLoading ? (
        <p className="text-sm text-muted-foreground">…</p>
      ) : !pages.length ? (
        <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          {t({ bn: "এখনো কোনো পেজ বা গ্রুপ নেই — উপরে যোগ করুন", en: "No pages or groups yet — add one above" })}
        </p>
      ) : (
        <ul className="space-y-2">
          {pages.map((p) => (
            <li key={p.id} className="card-elevated flex flex-wrap items-center justify-between gap-2 p-3">
              <div className="min-w-0">
                <p className="flex items-center gap-2 font-medium">
                  {p.kind === "group" ? <Users className="size-4 text-muted-foreground" /> : <Globe className="size-4 text-muted-foreground" />}
                  <span className="truncate">{p.name}</span>
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${p.active ? "bg-success/15 text-success" : "bg-muted text-muted-foreground"}`}>
                    {p.active ? t({ bn: "চালু", en: "Active" }) : t({ bn: "বন্ধ", en: "Disabled" })}
                  </span>
                </p>
                {p.url ? (
                  <a href={p.url} target="_blank" rel="noreferrer" className="mt-0.5 block truncate text-xs text-primary underline-offset-2 hover:underline">{p.url}</a>
                ) : null}
              </div>
              <div className="flex gap-1">
                <Button size="sm" variant="outline" onClick={() => startEdit(p)}><Pencil className="size-4" /> {t({ bn: "সম্পাদনা", en: "Edit" })}</Button>
                <Button size="sm" variant={p.active ? "ghost" : "default"} onClick={() => toggle(p)} disabled={save.isPending}>
                  {p.active ? t({ bn: "বন্ধ করুন", en: "Disable" }) : t({ bn: "চালু করুন", en: "Enable" })}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <SocialPageSummaryTable />
      <SocialPageAuditLog />
    </div>
  );
}
