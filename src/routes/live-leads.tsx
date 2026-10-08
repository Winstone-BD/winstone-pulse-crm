import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect } from "react";
import { Activity, Loader2, RefreshCw } from "lucide-react";

import { AppShell } from "@/components/crm/AppShell";
import { RoleGate } from "@/components/crm/RoleGate";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { getAdminToken } from "@/lib/local-session";
import { liveLeads } from "@/lib/live-leads.functions";

export const Route = createFileRoute("/live-leads")({
  head: () => ({
    meta: [
      { title: "Live Lead Dashboard — Winstone CRM" },
      { name: "description", content: "Leads by day — added, assigned, called and status — updating as call reports arrive." },
      { property: "og:title", content: "Live Lead Dashboard — Winstone CRM" },
      { property: "og:description", content: "Daily lead flow and status mix for HQ, LeadHub and team leaders." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Page,
});

function Page() {
  return (
    <AppShell>
      <RoleGate
        allow={["authority", "coordinator", "agent"]}
        icon={<Activity className="size-7" />}
        title="লাইভ লিড ড্যাশবোর্ড"
        description="HQ, LeadHub ও টিম লিডারদের জন্য।"
      >
        <Board />
      </RoleGate>
    </AppShell>
  );
}

const STATUS_BN: Record<string, string> = {
  pending: "পেন্ডিং",
  contacted: "যোগাযোগ হয়েছে",
  follow_up: "ফলো-আপ",
  closed: "বন্ধ",
};

function Board() {
  const fn = useServerFn(liveLeads);
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["live-leads"],
    queryFn: () => fn({ data: { adminToken: getAdminToken(), days: 14 } }),
    refetchInterval: 30_000,
  });

  // Refresh as soon as a new call report lands (in addition to the 30s poll).
  useEffect(() => {
    const ch = supabase.channel(`live-leads-${Date.now()}`);
    ch.on("postgres_changes", { event: "INSERT", schema: "public", table: "call_reports" }, () => {
      void qc.invalidateQueries({ queryKey: ["live-leads"] });
    });
    ch.subscribe();
    return () => {
      void supabase.removeChannel(ch);
    };
  }, [qc]);

  if (q.isLoading) return <div className="skeleton h-64 w-full" />;
  if (q.error)
    return (
      <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
        {(q.error as Error).message}
      </div>
    );
  const d = q.data!;
  const max = Math.max(1, ...d.days.map((x) => Math.max(x.added, x.assigned, x.called)));
  const statusTotal = d.status.reduce((s, x) => s + x.count, 0) || 1;
  const updated = new Date(d.generatedAt).toLocaleTimeString("en-GB", { timeZone: "Asia/Dhaka" });

  return (
    <div className="grid gap-4">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">লাইভ লিড ড্যাশবোর্ড</h1>
          <p className="text-xs text-muted-foreground">
            নতুন রিপোর্ট এলেই আপডেট হয় · শেষ আপডেট {updated} (ঢাকা)
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={() => q.refetch()} disabled={q.isFetching}>
          {q.isFetching ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />} রিফ্রেশ
        </Button>
      </header>

      <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
        <Stat label="আজ নতুন লিড" value={d.today.added} />
        <Stat label="আজ বরাদ্দ" value={d.today.assigned} />
        <Stat label="আজ কল করা লিড" value={d.today.called} />
        <Stat label="আজকের রিপোর্ট" value={`${d.today.reports} (${d.today.connected} সংযোগ)`} />
        <Stat label="পুলে অপেক্ষমাণ" value={d.pool} />
      </div>

      <section className="card-elevated p-4">
        <h2 className="mb-3 text-sm font-semibold">দিনভিত্তিক — গত ১৪ দিন</h2>
        <div className="mb-2 flex flex-wrap gap-3 text-xs text-muted-foreground">
          <Legend className="bg-muted-foreground/50" label="নতুন" />
          <Legend className="bg-primary/60" label="বরাদ্দ" />
          <Legend className="bg-success" label="কল করা" />
        </div>
        <div className="flex h-44 items-end gap-1 border-b border-border/60">
          {d.days.map((x) => (
            <div key={x.day} className="flex h-full flex-1 items-end justify-center gap-px" title={`${x.day}: নতুন ${x.added}, বরাদ্দ ${x.assigned}, কল ${x.called}`}>
              <div className="w-1/3 rounded-t bg-muted-foreground/50" style={{ height: `${(x.added / max) * 100}%` }} />
              <div className="w-1/3 rounded-t bg-primary/60" style={{ height: `${(x.assigned / max) * 100}%` }} />
              <div className="w-1/3 rounded-t bg-success" style={{ height: `${(x.called / max) * 100}%` }} />
            </div>
          ))}
        </div>
        <div className="mt-1 flex gap-1 text-[10px] text-muted-foreground">
          {d.days.map((x) => (
            <span key={x.day} className="flex-1 text-center tabular">{x.day.slice(8)}</span>
          ))}
        </div>
      </section>

      <section className="card-elevated p-4">
        <h2 className="mb-3 text-sm font-semibold">সব লিডের অবস্থা</h2>
        <div className="grid gap-2">
          {d.status.map((s) => (
            <div key={s.status} className="grid grid-cols-[7rem_1fr_4rem] items-center gap-2 text-sm">
              <span>{STATUS_BN[s.status] ?? s.status}</span>
              <div className="h-2 rounded bg-muted">
                <div className="h-2 rounded bg-primary" style={{ width: `${(s.count / statusTotal) * 100}%` }} />
              </div>
              <span className="tabular text-right">{s.count.toLocaleString("en-US")}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="card-elevated p-4">
        <h2 className="mb-3 text-sm font-semibold">দিনের হিসাব</h2>
        <div className="table-scroll">
          <table className="w-full text-sm">
            <thead className="text-xs text-muted-foreground">
              <tr className="text-left">
                <th className="py-1">তারিখ</th><th>নতুন</th><th>বরাদ্দ</th><th>কল করা</th><th>রিপোর্ট</th><th>সংযোগ</th>
              </tr>
            </thead>
            <tbody className="tabular">
              {[...d.days].reverse().map((x) => (
                <tr key={x.day} className="border-t border-border/60">
                  <td className="py-1">{x.day}</td><td>{x.added}</td><td>{x.assigned}</td><td>{x.called}</td><td>{x.reports}</td><td>{x.connected}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="tabular text-lg font-semibold">{value}</div>
    </div>
  );
}

function Legend({ className, label }: { className: string; label: string }) {
  return (
    <span className="flex items-center gap-1">
      <span className={`size-2.5 rounded-sm ${className}`} />
      {label}
    </span>
  );
}
