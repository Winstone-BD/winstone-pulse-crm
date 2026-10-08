import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Bell, CheckCircle2, HeartPulse, Loader2, RefreshCw, RotateCcw, TriangleAlert } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/crm/AppShell";
import { RoleGate } from "@/components/crm/RoleGate";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { getAdminToken } from "@/lib/local-session";
import {
  listRuntimeIssues,
  listRuntimeOccurrences,
  runHealthCheckNow,
  setRuntimeIssueStatus,
} from "@/lib/runtime-errors.functions";

export const Route = createFileRoute("/runtime-errors")({
  head: () => ({
    meta: [
      { title: "Runtime Errors & Deployment Health — Winstone CRM" },
      { name: "description", content: "HQ/IT review of recent crashes, affected pages, live-site health checks and resolution status." },
      { property: "og:title", content: "Runtime Errors & Deployment Health — Winstone CRM" },
      { property: "og:description", content: "Recent crashes, affected routes and resolution status for HQ and IT." },
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
        allow={["authority"]}
        icon={<HeartPulse className="size-7" />}
        title="রানটাইম এরর ও ডিপ্লয়মেন্ট হেলথ"
        description="শুধু HQ / IT — মাস্টার পিন দিয়ে খুলুন।"
      >
        <Board />
      </RoleGate>
    </AppShell>
  );
}

type Issue = Awaited<ReturnType<typeof listRuntimeIssues>>[number];
const fmt = (s: string) =>
  new Date(s).toLocaleString("bn-BD", { timeZone: "Asia/Dhaka", dateStyle: "medium", timeStyle: "short" });

function Board() {
  const qc = useQueryClient();
  const listFn = useServerFn(listRuntimeIssues);
  const healthFn = useServerFn(runHealthCheckNow);
  const [filter, setFilter] = useState<"open" | "resolved" | "all">("open");
  const [selected, setSelected] = useState<Issue | null>(null);

  const q = useQuery({
    queryKey: ["runtime-issues"],
    queryFn: () => listFn({ data: { adminToken: getAdminToken(), days: 30 } }),
    refetchInterval: 30_000,
  });
  const health = useMutation({
    mutationFn: () => healthFn({ data: { adminToken: getAdminToken() } }),
    onSuccess: (r) => {
      if (r.healthy) toast.success(`লাইভ সাইট ঠিক আছে (${r.ms} ms)`);
      else toast.error(`লাইভ সাইটে ${r.problems.length}টি সমস্যা পাওয়া গেছে`);
      void qc.invalidateQueries({ queryKey: ["runtime-issues"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "চেক ব্যর্থ"),
  });

  const rows = q.data ?? [];
  const open = rows.filter((r) => r.status === "open");
  const healthOpen = open.filter((r) => r.source === "health-check");
  const shown = filter === "all" ? rows : rows.filter((r) => r.status === filter);
  const notifState = typeof Notification === "undefined" ? "unsupported" : Notification.permission;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight">রানটাইম এরর ও ডিপ্লয়মেন্ট হেলথ</h1>
          <p className="text-sm text-muted-foreground">
            সব ডিভাইসের ক্র্যাশ এক জায়গায় · প্রতি ৩০ সেকেন্ডে আপডেট · গত ৩০ দিন
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {notifState === "default" && (
            <Button variant="outline" size="sm" onClick={() => void Notification.requestPermission().then(() => toast.info("সেটিং সংরক্ষিত"))}>
              <Bell className="size-4" /> ব্রাউজার নোটিফিকেশন চালু
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => void q.refetch()} disabled={q.isFetching}>
            <RefreshCw className={`size-4 ${q.isFetching ? "animate-spin" : ""}`} /> রিফ্রেশ
          </Button>
          <Button size="sm" onClick={() => health.mutate()} disabled={health.isPending}>
            {health.isPending ? <Loader2 className="size-4 animate-spin" /> : <HeartPulse className="size-4" />} লাইভ সাইট এখনই চেক
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="লাইভ সাইট" value={healthOpen.length ? "সমস্যা" : "ঠিক আছে"} danger={healthOpen.length > 0} />
        <Stat label="অমীমাংসিত" value={String(open.length)} danger={open.length > 0} />
        <Stat label="সমাধান হয়েছে" value={String(rows.length - open.length)} />
        <Stat label="মোট ঘটনা" value={String(rows.reduce((n, r) => n + r.occurrences, 0))} />
      </div>

      {healthOpen.length > 0 && (
        <div role="alert" className="flex items-start gap-3 rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm">
          <TriangleAlert className="mt-0.5 size-4 shrink-0 text-destructive" />
          <div>
            <p className="font-semibold text-destructive">লাইভ সাইট ঠিকমতো লোড হচ্ছে না</p>
            <p className="text-muted-foreground">{healthOpen[0]!.message}</p>
          </div>
        </div>
      )}

      <div className="inline-flex rounded-full border border-border bg-card p-0.5 text-xs font-semibold">
        {(["open", "resolved", "all"] as const).map((f) => (
          <button
            key={f}
            type="button"
            aria-pressed={filter === f}
            onClick={() => setFilter(f)}
            className={`h-7 rounded-full px-3 ${filter === f ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
          >
            {f === "open" ? "অমীমাংসিত" : f === "resolved" ? "সমাধান হয়েছে" : "সব"}
          </button>
        ))}
      </div>

      {q.isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" /> লোড হচ্ছে…</div>
      ) : q.error ? (
        <p className="text-sm text-destructive">{q.error instanceof Error ? q.error.message : "লোড ব্যর্থ"}</p>
      ) : shown.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
          <CheckCircle2 className="mx-auto mb-2 size-6 text-live" /> এই তালিকায় কোনো এরর নেই।
        </div>
      ) : (
        <ul className="space-y-2">
          {shown.map((r) => (
            <li key={r.id}>
              <button
                type="button"
                onClick={() => setSelected(r)}
                className="w-full rounded-xl border border-border bg-card p-4 text-left transition-shadow hover:shadow-sm"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={r.status === "open" ? "destructive" : "secondary"}>
                    {r.status === "open" ? "অমীমাংসিত" : "সমাধান হয়েছে"}
                  </Badge>
                  <Badge variant="outline">{r.source === "health-check" ? "হেলথ চেক" : "ব্রাউজার"}</Badge>
                  <span className="text-xs font-medium text-muted-foreground">{r.kind}</span>
                  {r.reopened_count > 0 && <Badge variant="outline">আবার ঘটেছে ×{r.reopened_count}</Badge>}
                  <span className="ml-auto text-xs text-muted-foreground">×{r.occurrences} · {fmt(r.last_seen)}</span>
                </div>
                <p className="mt-2 line-clamp-2 break-words text-sm font-medium">{r.message}</p>
                <p className="mt-1 truncate text-xs text-muted-foreground">পেজ: {r.routes.join(", ")}</p>
              </button>
            </li>
          ))}
        </ul>
      )}

      <IssueDialog issue={selected} onClose={() => setSelected(null)} />
    </div>
  );
}

function Stat({ label, value, danger }: { label: string; value: string; danger?: boolean }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${danger ? "text-destructive" : ""}`}>{value}</p>
    </div>
  );
}

function IssueDialog({ issue, onClose }: { issue: Issue | null; onClose: () => void }) {
  const qc = useQueryClient();
  const occFn = useServerFn(listRuntimeOccurrences);
  const statusFn = useServerFn(setRuntimeIssueStatus);
  const [note, setNote] = useState("");
  const occ = useQuery({
    queryKey: ["runtime-occ", issue?.id],
    enabled: !!issue,
    queryFn: () => occFn({ data: { adminToken: getAdminToken(), issueId: issue!.id } }),
  });
  const m = useMutation({
    mutationFn: (status: "open" | "resolved") =>
      statusFn({ data: { adminToken: getAdminToken(), issueId: issue!.id, status, note: note || undefined } }),
    onSuccess: (_, status) => {
      toast.success(status === "resolved" ? "সমাধান হিসেবে চিহ্নিত" : "আবার খোলা হয়েছে");
      setNote("");
      void qc.invalidateQueries({ queryKey: ["runtime-issues"] });
      void qc.invalidateQueries({ queryKey: ["runtime-alerts"] });
      onClose();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "ব্যর্থ"),
  });

  return (
    <Dialog open={!!issue} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        {issue && (
          <>
            <DialogHeader>
              <DialogTitle className="break-words text-base">{issue.kind}</DialogTitle>
              <DialogDescription className="break-words">{issue.message}</DialogDescription>
            </DialogHeader>
            <dl className="grid grid-cols-2 gap-2 text-xs">
              <dt className="text-muted-foreground">প্রথম দেখা</dt><dd>{fmt(issue.first_seen)}</dd>
              <dt className="text-muted-foreground">সর্বশেষ</dt><dd>{fmt(issue.last_seen)}</dd>
              <dt className="text-muted-foreground">মোট বার</dt><dd>{issue.occurrences}</dd>
              <dt className="text-muted-foreground">প্রভাবিত পেজ</dt><dd className="break-words">{issue.routes.join(", ")}</dd>
              {issue.resolved_at && (
                <>
                  <dt className="text-muted-foreground">সমাধান</dt>
                  <dd>{fmt(issue.resolved_at)} · {issue.resolved_by}{issue.resolution_note ? ` — ${issue.resolution_note}` : ""}</dd>
                </>
              )}
            </dl>
            <div>
              <p className="mb-2 text-sm font-semibold">সাম্প্রতিক ঘটনা</p>
              {occ.isLoading ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <ul className="space-y-1.5 text-xs">
                  {(occ.data ?? []).map((o) => (
                    <li key={o.id} className="rounded-lg border border-border p-2">
                      <span className="font-medium">{fmt(o.occurred_at)}</span> · {o.route}
                      {o.browser && <span className="block truncate text-muted-foreground">{o.browser}</span>}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            {issue.status === "open" ? (
              <div className="space-y-2">
                <Textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} placeholder="কী ঠিক করা হয়েছে (ঐচ্ছিক)" />
                <Button onClick={() => m.mutate("resolved")} disabled={m.isPending}>
                  <CheckCircle2 className="size-4" /> সমাধান হয়েছে
                </Button>
                <p className="text-xs text-muted-foreground">আবার ঘটলে নিজে থেকেই অমীমাংসিত হয়ে যাবে।</p>
              </div>
            ) : (
              <Button variant="outline" onClick={() => m.mutate("open")} disabled={m.isPending}>
                <RotateCcw className="size-4" /> আবার খুলুন
              </Button>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
