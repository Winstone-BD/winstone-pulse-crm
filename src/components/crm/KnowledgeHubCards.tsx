import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Building2, CalendarCheck, ExternalLink, Megaphone, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { hubDecideVisitRequest, hubOfficialNews, hubProjectFacts, hubVisitRequests } from "@/lib/knowledge-hub.functions";
import { useAdminToken } from "@/lib/local-session";
import { useT } from "@/lib/i18n";

/** Slim gold strip on the Desk when official Winstone news arrived in the last 7 days. */
export function OfficialNewsStrip() {
  const adminToken = useAdminToken();
  const t = useT();
  const fn = useServerFn(hubOfficialNews);
  const q = useQuery({ queryKey: ["hub-official-news", adminToken], queryFn: () => fn({ data: { adminToken } }), staleTime: 300_000 });
  const top = q.data?.[0];
  if (!top) return null;
  return (
    <Link to="/news" className="flex min-w-0 items-center gap-2 rounded-xl border border-accent-foreground/25 bg-accent px-3 py-2 text-sm text-accent-foreground hover:shadow-sm">
      <Megaphone className="size-4 shrink-0" />
      <span className="shrink-0 font-semibold">{t({ bn: "নতুন অফিসিয়াল আপডেট", en: "New official update" })}:</span>
      <span className="truncate">{top.headline}</span>
    </Link>
  );
}

/** Project facts from winstonebd.com, matched only to what the lead's own records say. */
export function LeadProjectFacts({ leadId }: { leadId: string }) {
  const adminToken = useAdminToken();
  const t = useT();
  const fn = useServerFn(hubProjectFacts);
  const q = useQuery({ queryKey: ["hub-project-facts", leadId, adminToken], queryFn: () => fn({ data: { adminToken, leadId } }) });
  return (
    <section className="space-y-2 rounded-xl border bg-card p-4 text-sm">
      <h3 className="flex items-center gap-2 text-sm font-semibold"><Building2 className="size-4 text-primary" />{t({ bn: "প্রজেক্ট তথ্য (winstonebd.com)", en: "Project info (winstonebd.com)" })}</h3>
      {q.isLoading && <div className="h-16 animate-pulse rounded-lg bg-muted" />}
      {q.isError && <p className="text-xs text-muted-foreground">{t({ bn: "প্রজেক্ট তথ্য পড়া যায়নি।", en: "Could not load project info." })}</p>}
      {q.data && q.data.matches.length === 0 && (
        <p className="text-xs text-muted-foreground">
          {q.data.projectPages === 0
            ? t({ bn: "ওয়েবসাইটের প্রজেক্ট পাতা এখনো পড়া হয়নি — IT Console থেকে রিফ্রেশ করুন।", en: "Website project pages not read yet — refresh from IT Console." })
            : t({ bn: "এই লিডের রেকর্ডে কোনো ওয়েবসাইট-প্রজেক্টের নাম মেলেনি। অনুমান করবেন না।", en: "No website project matches this lead's records. Do not guess." })}
        </p>
      )}
      {q.data?.matches.map((m) => (
        <div key={m.url} className="rounded-lg border border-border bg-surface p-3">
          <a href={m.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-semibold text-primary hover:underline">
            {m.title}<ExternalLink className="size-3.5" />
          </a>
          <p className="mt-1 line-clamp-6 whitespace-pre-wrap text-xs text-muted-foreground">{m.excerpt}</p>
          <p className="mt-1 text-[11px] text-muted-foreground">{t({ bn: "উৎস: ওয়েবসাইটের পাতা, শুধু হুবহু লেখা", en: "Source: website page, verbatim text only" })}</p>
        </div>
      ))}
    </section>
  );
}

/** Website visit requests — confirm (creates a real site visit) or dismiss. */
export function VisitRequestsPanel({ leadId }: { leadId?: string }) {
  const adminToken = useAdminToken();
  const t = useT();
  const qc = useQueryClient();
  const fn = useServerFn(hubVisitRequests);
  const decide = useServerFn(hubDecideVisitRequest);
  const key = ["hub-visit-requests", leadId ?? "all", adminToken];
  const q = useQuery({ queryKey: key, queryFn: () => fn({ data: { adminToken, leadId: leadId ?? null, openOnly: !leadId } }) });
  const [when, setWhen] = useState<Record<string, string>>({});
  const m = useMutation({
    mutationFn: (v: { id: string; action: "confirm" | "dismiss" }) =>
      decide({ data: { adminToken, id: v.id, action: v.action, visitAt: v.action === "confirm" && when[v.id] ? new Date(when[v.id]!).toISOString() : null } }),
    onSuccess: () => { toast.success(t({ bn: "সংরক্ষিত", en: "Saved" })); qc.invalidateQueries({ queryKey: ["hub-visit-requests"] }); qc.invalidateQueries({ queryKey: ["site-visits"] }); },
    onError: (e) => toast.error((e as Error).message),
  });
  const rows = q.data ?? [];
  if (!rows.length) return null;
  return (
    <section className="space-y-2 rounded-xl border border-accent-foreground/25 bg-card p-4 text-sm">
      <h3 className="flex items-center gap-2 text-sm font-semibold"><CalendarCheck className="size-4 text-primary" />{t({ bn: "ওয়েবসাইট ভিজিট অনুরোধ — নিশ্চিত করুন", en: "Website visit requests — confirm" })}</h3>
      {rows.map((r) => (
        <div key={r.id} className="space-y-2 rounded-lg border border-border bg-surface p-3">
          <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
            <span className="font-semibold">{r.lead_name ?? r.customer_name}</span>
            {r.project && <span className="text-xs text-muted-foreground">{r.project}</span>}
            <span className="text-xs text-muted-foreground">{[r.preferred_date, r.preferred_time].filter(Boolean).join(" · ")}{r.visitors ? ` · ${r.visitors} ${t({ bn: "জন", en: "people" })}` : ""}</span>
            {r.status !== "requested" && <span className="rounded-full bg-muted px-2 py-0.5 text-[11px]">{r.status === "confirmed" ? t({ bn: "নিশ্চিত", en: "Confirmed" }) : t({ bn: "বাতিল", en: "Dismissed" })}</span>}
          </div>
          {r.notes && <p className="text-xs text-muted-foreground">{r.notes}</p>}
          {r.status === "requested" && (
            <div className="flex flex-wrap items-center gap-2">
              <Input type="datetime-local" aria-label={t({ bn: "ভিজিটের সময়", en: "Visit time" })} className="h-9 w-auto" value={when[r.id] ?? ""} onChange={(e) => setWhen((w) => ({ ...w, [r.id]: e.target.value }))} />
              <Button size="sm" disabled={!when[r.id] || m.isPending} onClick={() => m.mutate({ id: r.id, action: "confirm" })}>{t({ bn: "ভিজিট নিশ্চিত", en: "Confirm visit" })}</Button>
              <Button size="sm" variant="ghost" disabled={m.isPending} onClick={() => m.mutate({ id: r.id, action: "dismiss" })}><X className="size-3.5" />{t({ bn: "বাতিল", en: "Dismiss" })}</Button>
            </div>
          )}
        </div>
      ))}
    </section>
  );
}
