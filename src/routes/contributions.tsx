import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, Download, Eye, Loader2, Trophy, XCircle } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/crm/AppShell";
import { PageHeader } from "@/components/crm/PageHeader";
import { RoleGate } from "@/components/crm/RoleGate";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { listContributionReports, reviewContributionReport } from "@/lib/agent-contribution.functions";
import { useAdminToken } from "@/lib/local-session";

export const Route = createFileRoute("/contributions")({
  head: () => ({
    meta: [
      { title: "এজেন্ট অবদান রিপোর্ট — Winstone Pulse" },
      { name: "description", content: "HQ review of agents' daily 5:20 PM contribution reports by date and agent." },
      { property: "og:title", content: "এজেন্ট অবদান রিপোর্ট — Winstone Pulse" },
      { property: "og:description", content: "HQ review of agents' daily contribution reports." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ContributionsPage,
});

function ContributionsPage() {
  return (
    <AppShell>
      <RoleGate
        surface="hq"
        allow={["authority"]}
        icon={<Trophy className="size-7" />}
        title="এজেন্ট অবদান রিপোর্ট"
        description="এজেন্টদের দৈনিক অবদানের রিপোর্ট শুধু HQ/IT দেখতে পারে। মাস্টার পিন লাগবে।"
      >
        <ContributionsBoard />
      </RoleGate>
    </AppShell>
  );
}

const bn = (n: number) => n.toLocaleString("bn-BD");
const dhaka = (ms: number) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dhaka" }).format(new Date(ms));
const KIND = { since_joining: "যোগদান থেকে", daily: "দৈনিক" } as const;
const fmtDate = (d: string) =>
  new Date(`${d}T12:00:00+06:00`).toLocaleDateString("bn-BD", { timeZone: "Asia/Dhaka", day: "numeric", month: "short", year: "numeric" });

import { safeCsvCell as csvCell } from "@/lib/csv-safe";

function ContributionsBoard() {
  const adminToken = useAdminToken();
  const qc = useQueryClient();
  const list = useServerFn(listContributionReports);
  const review = useServerFn(reviewContributionReport);
  const [from, setFrom] = useState(dhaka(Date.now() - 6 * 86_400_000));
  const [to, setTo] = useState(dhaka(Date.now()));
  const [agentId, setAgentId] = useState("");
  const [kind, setKind] = useState<"" | "since_joining" | "daily">("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [note, setNote] = useState("");

  const key = ["contribution-reports", from, to, agentId, kind, adminToken ? "pin" : "session"];
  const q = useQuery({
    queryKey: key,
    queryFn: () =>
      list({ data: { adminToken, from, to, agentId: agentId || null, kind: kind || null } }),
    refetchInterval: 120_000,
  });
  const names = useMemo(() => new Map((q.data?.agents ?? []).map((a) => [a.id, a.name])), [q.data]);
  const reports = q.data?.reports ?? [];
  const open = reports.find((r) => r.id === openId) ?? null;

  const save = useMutation({
    mutationFn: () => review({ data: { adminToken, reportId: openId!, note: note.trim() || undefined } }),
    onSuccess: () => {
      toast.success("পর্যালোচনা সংরক্ষিত হয়েছে");
      setNote("");
      void qc.invalidateQueries({ queryKey: ["contribution-reports"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const preset = (days: number) => {
    setFrom(dhaka(Date.now() - (days - 1) * 86_400_000));
    setTo(dhaka(Date.now()));
  };

  const exportCsv = () => {
    const head = ["তারিখ", "এজেন্ট", "ধরন", "শব্দ", "বাক্য", "সীমার মধ্যে", "রিপোর্ট", "পর্যালোচনা"];
    const lines = reports.map((r) =>
      [
        r.business_date,
        names.get(r.agent_id) ?? r.agent_id,
        KIND[r.kind as keyof typeof KIND] ?? r.kind,
        r.words,
        r.sentences,
        r.withinLimit ? "হ্যাঁ" : "না",
        r.summary,
        r.reviews.map((v) => `${v.reviewer}${v.note ? `: ${v.note}` : ""}`).join(" | "),
      ]
        .map(csvCell)
        .join(","),
    );
    const blob = new Blob(["\uFEFF" + [head.join(","), ...lines].join("\r\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `contribution-reports_${from}_${to}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const t = q.data?.today;
  const within = reports.filter((r) => r.withinLimit).length;

  return (
    <div className="space-y-5">
      <PageHeader
        icon={<Trophy className="size-5" />}
        title="এজেন্ট অবদান রিপোর্ট"
        description="৫:২০-এর রিপোর্ট — তারিখ ও এজেন্ট অনুযায়ী দেখুন এবং পর্যালোচনা করুন।"
        actions={
          <Button variant="outline" onClick={exportCsv} disabled={!reports.length} className="gap-1.5">
            <Download className="size-4" /> CSV
          </Button>
        }
      />

      <section className="grid gap-3 sm:grid-cols-3" aria-label="আজকের সারাংশ">
        <div className="card-elevated p-4">
          <p className="text-xs text-muted-foreground">আজ জমা / প্রত্যাশিত</p>
          <p className="mt-1 text-2xl font-black tabular-nums">
            {t ? `${bn(t.submitted)} / ${bn(t.expected)}` : "…"}
          </p>
          {t && !t.dueNow && (
            <p className="mt-1 text-[11px] text-muted-foreground">
              {t.friday ? "শুক্রবার — রিপোর্ট নেই" : "৫:২০-এর আগে কোনো রিপোর্ট প্রত্যাশিত নয়"}
            </p>
          )}
        </div>
        <div className="card-elevated p-4">
          <p className="text-xs text-muted-foreground">এখনো জমা দেয়নি</p>
          {t && t.missing.length ? (
            <p className="mt-1 flex items-start gap-1 text-sm font-semibold text-destructive">
              <XCircle className="mt-0.5 size-4 shrink-0" aria-hidden /> {bn(t.missing.length)} জন: {t.missing.join(", ")}
            </p>
          ) : (
            <p className="mt-1 flex items-center gap-1 text-sm font-semibold text-success">
              <CheckCircle2 className="size-4" aria-hidden /> কেউ বাকি নেই
            </p>
          )}
        </div>
        <div className="card-elevated p-4">
          <p className="text-xs text-muted-foreground">শব্দসীমার মধ্যে (এই তালিকায়)</p>
          <p className="mt-1 text-2xl font-black tabular-nums">{bn(within)} / {bn(reports.length)}</p>
        </div>
      </section>

      <section className="card-elevated flex flex-wrap items-end gap-2 p-4" aria-label="ফিল্টার">
        {[1, 7, 30, 90].map((d) => (
          <Button key={d} size="sm" variant="outline" onClick={() => preset(d)}>
            {d === 1 ? "আজ" : `${bn(d)} দিন`}
          </Button>
        ))}
        <label className="text-xs">
          <span className="block text-muted-foreground">শুরু</span>
          <Input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} className="h-9 w-40" />
        </label>
        <label className="text-xs">
          <span className="block text-muted-foreground">শেষ</span>
          <Input type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} className="h-9 w-40" />
        </label>
        <label className="text-xs">
          <span className="block text-muted-foreground">এজেন্ট</span>
          <select value={agentId} onChange={(e) => setAgentId(e.target.value)} className="h-9 rounded-md border border-input bg-background px-2 text-sm">
            <option value="">সবাই</option>
            {(q.data?.agents ?? []).map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
        </label>
        <label className="text-xs">
          <span className="block text-muted-foreground">ধরন</span>
          <select value={kind} onChange={(e) => setKind(e.target.value as typeof kind)} className="h-9 rounded-md border border-input bg-background px-2 text-sm">
            <option value="">সব</option>
            <option value="since_joining">যোগদান থেকে</option>
            <option value="daily">দৈনিক</option>
          </select>
        </label>
      </section>

      {q.isPending ? (
        <div className="grid place-items-center p-10"><Loader2 className="size-6 animate-spin text-primary" /></div>
      ) : q.isError ? (
        <p className="text-sm text-destructive">{(q.error as Error).message}</p>
      ) : reports.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">এই সময়ে কোনো রিপোর্ট নেই।</p>
      ) : (
        <>
          <div className="space-y-2 md:hidden">
            {reports.map((r) => (
              <button key={r.id} type="button" onClick={() => setOpenId(r.id)} className="card-elevated block w-full p-4 text-left">
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate font-semibold">{names.get(r.agent_id) ?? "—"}</p>
                  <ReviewBadge n={r.reviews.length} />
                </div>
                <p className="text-xs text-muted-foreground">{fmtDate(r.business_date)} · {KIND[r.kind as keyof typeof KIND]} · {bn(r.words)} শব্দ · {bn(r.sentences)} বাক্য</p>
                <p className="mt-2 line-clamp-2 text-sm">{r.summary}</p>
              </button>
            ))}
          </div>
          <div className="card-elevated hidden overflow-hidden md:block">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
                <tr>
                  <th className="p-3">তারিখ</th><th className="p-3">এজেন্ট</th><th className="p-3">ধরন</th>
                  <th className="p-3 text-right">শব্দ</th><th className="p-3 text-right">বাক্য</th><th className="p-3">রিপোর্ট</th><th className="p-3">অবস্থা</th><th className="p-3" />
                </tr>
              </thead>
              <tbody>
                {reports.map((r) => (
                  <tr key={r.id} className="border-t border-border/70">
                    <td className="whitespace-nowrap p-3">{fmtDate(r.business_date)}</td>
                    <td className="p-3 font-medium">{names.get(r.agent_id) ?? "—"}</td>
                    <td className="p-3">{KIND[r.kind as keyof typeof KIND]}</td>
                    <td className={`p-3 text-right tabular-nums ${r.withinLimit ? "" : "text-destructive"}`}>{bn(r.words)}</td>
                    <td className="p-3 text-right tabular-nums">{bn(r.sentences)}</td>
                    <td className="max-w-md p-3"><p className="line-clamp-2">{r.summary}</p></td>
                    <td className="p-3"><ReviewBadge n={r.reviews.length} /></td>
                    <td className="p-3">
                      <Button size="sm" variant="ghost" onClick={() => setOpenId(r.id)} className="gap-1"><Eye className="size-3.5" /> দেখুন</Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <Sheet open={Boolean(open)} onOpenChange={(v) => !v && setOpenId(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
          {open && (
            <>
              <SheetHeader>
                <SheetTitle>{names.get(open.agent_id) ?? "এজেন্ট"}</SheetTitle>
                <SheetDescription>
                  {fmtDate(open.business_date)} · {KIND[open.kind as keyof typeof KIND]} · {bn(open.words)} শব্দ · {bn(open.sentences)} বাক্য
                </SheetDescription>
              </SheetHeader>
              <div className="space-y-4 p-4">
                <p className="whitespace-pre-wrap rounded-xl border border-border bg-muted/30 p-3 text-sm leading-6">{open.summary}</p>
                <div className="space-y-2">
                  <label htmlFor="review-note" className="text-sm font-semibold">পর্যালোচনার নোট (ঐচ্ছিক)</label>
                  <Textarea id="review-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} rows={3} />
                  <Button onClick={() => save.mutate()} disabled={save.isPending} className="gap-1.5">
                    {save.isPending ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />} দেখা হয়েছে
                  </Button>
                  <p className="text-[11px] text-muted-foreground">প্রতিটি পর্যালোচনা আলাদাভাবে সংরক্ষিত হয়; মূল রিপোর্ট বা আগের পর্যালোচনা বদলানো যায় না।</p>
                </div>
                {open.reviews.length > 0 && (
                  <ul className="space-y-2">
                    {open.reviews.map((v) => (
                      <li key={v.id} className="rounded-lg border border-border p-2 text-xs">
                        <span className="font-semibold">{v.reviewer}</span> ·{" "}
                        {new Date(v.created_at).toLocaleString("bn-BD", { timeZone: "Asia/Dhaka" })}
                        {v.note && <p className="mt-1 text-sm">{v.note}</p>}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function ReviewBadge({ n }: { n: number }) {
  return n ? (
    <span className="inline-flex items-center gap-1 rounded-full bg-success/10 px-2 py-0.5 text-[11px] font-semibold text-success">
      <CheckCircle2 className="size-3" aria-hidden /> দেখা হয়েছে
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2 py-0.5 text-[11px] font-semibold text-destructive">
      <Eye className="size-3" aria-hidden /> পর্যালোচনা বাকি
    </span>
  );
}
