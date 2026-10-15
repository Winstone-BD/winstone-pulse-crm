import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Copy, Loader2, MessageSquareText, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { getAdminToken } from "@/lib/local-session";
import { matchProjects, parseBDT, taka } from "@/lib/project-match";
import {
  draftFollowupPair, getProjectCatalog, listSalesDrafts, saveSalesDraftEdit,
} from "@/lib/sales-drafts.functions";

const copy = (t: string) => { void navigator.clipboard.writeText(t); toast.success("কপি হয়েছে"); };

/** Project matching (app-computed Taka), AI WhatsApp+SMS pair, and saved draft history. */
export function SalesToolkit({ leadId }: { leadId: string }) {
  return (
    <div className="space-y-4">
      <ProjectMatcher />
      <FollowupPair leadId={leadId} />
      <DraftHistory />
    </div>
  );
}

function ProjectMatcher() {
  const load = useServerFn(getProjectCatalog);
  const [open, setOpen] = useState(false);
  const [budget, setBudget] = useState("");
  const [area, setArea] = useState("");
  const [units, setUnits] = useState(1);
  const [months, setMonths] = useState(0);
  const catalog = useQuery({ queryKey: ["sales", "catalog"], queryFn: () => load({ data: { token: getAdminToken() } }), enabled: open });
  const maxBudget = parseBDT(budget);
  const matches = useMemo(
    () => matchProjects({ maxBudget, area, units, months }, catalog.data ?? []).slice(0, 5),
    [catalog.data, maxBudget, area, units, months],
  );

  return (
    <section className="rounded-xl border border-border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-sm font-semibold"><Search className="size-4 text-primary" /> প্রকল্প মিলান</p>
        {!open && <Button size="sm" variant="outline" onClick={() => setOpen(true)}>খুলুন</Button>}
      </div>
      {open && (
        <>
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="text-xs">বাজেট (যেমন 85 lakh, 1.2 crore)
              <Input value={budget} onChange={(e) => setBudget(e.target.value)} />
              <span className="text-muted-foreground">{budget ? (maxBudget ? taka(maxBudget) : "বুঝতে পারিনি") : ""}</span>
            </label>
            <label className="text-xs">এলাকা<Input value={area} onChange={(e) => setArea(e.target.value)} /></label>
            <label className="text-xs">ইউনিট<Input type="number" min={1} value={units} onChange={(e) => setUnits(Number(e.target.value) || 1)} /></label>
            <label className="text-xs">কিস্তি (মাস)<Input type="number" min={0} value={months} onChange={(e) => setMonths(Number(e.target.value) || 0)} /></label>
          </div>
          {catalog.isLoading && <Loader2 className="size-4 animate-spin" />}
          {catalog.error && <p className="text-xs text-destructive">{(catalog.error as Error).message}</p>}
          {catalog.data?.length === 0 && <p className="text-xs text-muted-foreground">প্রকল্প তালিকা খালি।</p>}
          <ul className="space-y-2">
            {matches.map((m) => (
              <li key={m.id} className="rounded-lg border border-border p-3 text-xs space-y-1">
                <p className="text-sm font-medium">{m.name} <span className="text-muted-foreground">· {m.location || "—"}</span></p>
                <p>মোট: {taka(m.total)} · ডাউন পেমেন্ট: {taka(m.downPayment)} · বাকি: {taka(m.balance)}</p>
                {m.monthly !== null && <p>মাসিক কিস্তি ({m.months} মাস): {taka(m.monthly)}</p>}
                <p>{m.budgetOk === true ? "✓ বাজেটে মেলে" : m.budgetOk === false ? "✗ বাজেটের বেশি" : "বাজেট মেলানো যায়নি"}{m.areaOk ? "" : " · এলাকা ভিন্ন"}</p>
                {m.warnings.map((w) => <p key={w} className="text-destructive">{w}</p>)}
              </li>
            ))}
          </ul>
          <p className="text-xs text-muted-foreground">সব হিসাব অ্যাপ করে, AI নয়। দাম ও শর্ত গ্রাহককে বলার আগে ম্যানেজমেন্ট থেকে নিশ্চিত করুন।</p>
        </>
      )}
    </section>
  );
}

function FollowupPair({ leadId }: { leadId: string }) {
  const run = useServerFn(draftFollowupPair);
  const qc = useQueryClient();
  const m = useMutation({
    mutationFn: () => run({ data: { token: getAdminToken(), leadId } }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["sales", "drafts"] }),
    onError: (e) => toast.error(e instanceof Error ? e.message : String(e)),
  });
  const d = m.data;
  return (
    <section className="rounded-xl border border-border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-sm font-semibold"><MessageSquareText className="size-4 text-primary" /> AI WhatsApp + SMS খসড়া</p>
        <Button size="sm" variant="outline" disabled={m.isPending} onClick={() => m.mutate()}>
          {m.isPending && <Loader2 className="size-4 animate-spin" />}{d ? "আবার লিখুন" : "খসড়া লিখুন"}
        </Button>
      </div>
      {d && (
        <div className="space-y-2 text-sm">
          {d.flagged && <p className="text-xs text-destructive">নোটে সন্দেহজনক নির্দেশ ছিল — AI সেটি মানেনি।</p>}
          {[["WhatsApp", d.whatsapp], ["SMS", d.sms]].map(([label, text]) => (
            <div key={label} className="rounded-lg border border-border p-3">
              <div className="flex items-center justify-between"><span className="text-xs text-muted-foreground">{label}</span>
                <Button size="sm" variant="ghost" onClick={() => copy(text!)}><Copy className="size-4" /></Button></div>
              <p className="whitespace-pre-wrap">{text}</p>
            </div>
          ))}
          <p className="text-xs">পরের ফলো-আপ: {d.when}</p>
        </div>
      )}
      <p className="text-xs text-muted-foreground">শুধু খসড়া — কিছু পাঠানো হয় না। খসড়া ইতিহাসে সেভ থাকে।</p>
    </section>
  );
}

function DraftHistory() {
  const list = useServerFn(listSalesDrafts);
  const save = useServerFn(saveSalesDraftEdit);
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<{ id: string; text: string } | null>(null);
  const q = useQuery({ queryKey: ["sales", "drafts"], queryFn: () => list({ data: { token: getAdminToken() } }), enabled: open });
  const m = useMutation({
    mutationFn: (e: { id: string; text: string }) => save({ data: { token: getAdminToken(), ...e } }),
    onSuccess: () => { setEditing(null); toast.success("এডিট সেভ হয়েছে"); void qc.invalidateQueries({ queryKey: ["sales", "drafts"] }); },
    onError: (e) => toast.error(e instanceof Error ? e.message : String(e)),
  });
  return (
    <section className="rounded-xl border border-border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold">খসড়া ইতিহাস</p>
        <Button size="sm" variant="outline" onClick={() => setOpen((o) => !o)}>{open ? "বন্ধ" : "দেখুন"}</Button>
      </div>
      {open && q.isLoading && <Loader2 className="size-4 animate-spin" />}
      {open && q.error && <p className="text-xs text-destructive">{(q.error as Error).message}</p>}
      {open && q.data?.length === 0 && <p className="text-xs text-muted-foreground">এখনো কোনো খসড়া নেই।</p>}
      {open && (
        <ul className="space-y-2">
          {q.data?.map((r) => (
            <li key={r.id} className="rounded-lg border border-border p-3 text-xs space-y-2">
              <p className="text-muted-foreground">{r.leadName} · {new Date(r.created_at).toLocaleString("en-GB", { timeZone: "Asia/Dhaka" })}
                {r.edited_at ? " · এডিট হয়েছে" : ""}{r.injection_flagged ? " · ⚠ সন্দেহজনক নোট" : ""}</p>
              {editing?.id === r.id ? (
                <>
                  <Textarea rows={8} value={editing.text} onChange={(e) => setEditing({ id: r.id, text: e.target.value })} />
                  <Button size="sm" disabled={m.isPending} onClick={() => m.mutate(editing)}>সেভ</Button>
                </>
              ) : (
                <>
                  <p className="whitespace-pre-wrap text-sm">{r.edited_output ?? r.ai_output}</p>
                  <div className="flex gap-2">
                    <Button size="sm" variant="ghost" onClick={() => copy(r.edited_output ?? r.ai_output)}><Copy className="size-4" /> কপি</Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditing({ id: r.id, text: r.edited_output ?? r.ai_output })}>এডিট</Button>
                  </div>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
