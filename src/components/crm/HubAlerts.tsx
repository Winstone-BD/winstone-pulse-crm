import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CalendarCheck } from "lucide-react";

import { hubSyncStatusFn, hubVisitRequests } from "@/lib/knowledge-hub.functions";
import { useAdminToken } from "@/lib/local-session";
import { useT } from "@/lib/i18n";

/** Top-bar alert for the assigned agent: open website visit requests on their own leads (server-scoped). */
export function VisitRequestBell() {
  const adminToken = useAdminToken();
  const t = useT();
  const fn = useServerFn(hubVisitRequests);
  const q = useQuery({
    queryKey: ["hub-visit-requests", "all", adminToken],
    queryFn: () => fn({ data: { adminToken, leadId: null, openOnly: true } }),
    refetchInterval: 60_000,
  });
  const n = q.data?.length ?? 0;
  if (!n) return null;
  const label = t({ bn: `${n}টি নতুন সাইট ভিজিট অনুরোধ — দেখে নিশ্চিত বা বাতিল করুন`, en: `${n} new site visit request${n > 1 ? "s" : ""} — review to confirm or dismiss` });
  return (
    <Link
      to="/site-visits"
      aria-label={label}
      title={label}
      className="relative inline-flex h-8 items-center gap-1 rounded-full border border-primary/40 bg-primary/10 px-2.5 text-[11px] font-semibold text-primary"
    >
      <CalendarCheck className="size-4" aria-hidden />
      <span>{t({ bn: "ভিজিট অনুরোধ", en: "Visit requests" })}</span>
      <span className="rounded-full bg-destructive px-1.5 text-[10px] text-destructive-foreground">{n}</span>
    </Link>
  );
}

const fmt = (iso: string | null) =>
  iso ? new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Dhaka", dateStyle: "medium", timeStyle: "short" }).format(new Date(iso)) : "—";

/** HQ/IT-only Knowledge Hub sync health. Shows times and counts only. */
export function HubSyncStatusPanel() {
  const adminToken = useAdminToken();
  const t = useT();
  const fn = useServerFn(hubSyncStatusFn);
  const q = useQuery({ queryKey: ["hub-sync-status", adminToken], queryFn: () => fn({ data: { adminToken } }), refetchInterval: 300_000 });
  const d = q.data;
  const Stat = ({ label, value, bad }: { label: string; value: string | number; bad?: boolean }) => (
    <div className="rounded-lg border border-border bg-card p-3">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className={`mt-1 text-sm font-semibold ${bad ? "text-destructive" : "text-foreground"}`}>{value}{bad ? " ⚠" : ""}</p>
    </div>
  );
  return (
    <section aria-labelledby="hub-sync-h" className="rounded-xl border border-border bg-card/60 p-4">
      <h2 id="hub-sync-h" className="text-sm font-bold">{t({ bn: "Knowledge Hub সিঙ্ক অবস্থা", en: "Knowledge Hub sync status" })}</h2>
      {q.isLoading && <p className="mt-2 text-xs text-muted-foreground">{t({ bn: "লোড হচ্ছে…", en: "Loading…" })}</p>}
      {q.isError && !d && <p role="alert" className="mt-2 text-xs text-destructive">{t({ bn: "অবস্থা পড়া যায়নি", en: "Could not load status" })}</p>}
      {d && (
        <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-3">
          <Stat label={t({ bn: "শেষ পেজ সিঙ্ক (ঢাকা)", en: "Last page sync (Dhaka)" })} value={fmt(d.lastPageSyncAt)} />
          <Stat label={t({ bn: "সংরক্ষিত পেজ", en: "Stored pages" })} value={d.pageCount} />
          <Stat label={t({ bn: "শেষ অফিসিয়াল নিউজ", en: "Last official news" })} value={fmt(d.lastNewsSyncAt)} />
          <Stat label={t({ bn: "ভিজিট ইভেন্ট সফল (৩০ দিন)", en: "Visit events processed (30d)" })} value={d.visitEvents30d.processed} />
          <Stat label={t({ bn: "ভিজিট ইভেন্ট ব্যর্থ (৩০ দিন)", en: "Visit events failed (30d)" })} value={d.visitEvents30d.failed} bad={d.visitEvents30d.failed > 0} />
          <Stat label={t({ bn: "আটকে থাকা (১৫ মিনিট+)", en: "Stuck (15 min+)" })} value={d.visitEvents30d.stuck} bad={d.visitEvents30d.stuck > 0} />
        </div>
      )}
    </section>
  );
}
