import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, Circle, ClipboardCheck, Clock } from "lucide-react";

import { getAdminToken } from "@/lib/local-session";
import { getHandoverSignals } from "@/lib/handover.functions";

type Item = { label: string; state: "done" | "pending" | "todo"; note?: string };

/** Handover checklist: ticks come only from saved records; documents/payments are reminders to verify. */
export function HandoverChecklist({ leadId }: { leadId: string }) {
  const run = useServerFn(getHandoverSignals);
  const q = useQuery({ queryKey: ["handover", leadId], queryFn: () => run({ data: { token: getAdminToken(), leadId } }) });
  const s = q.data;
  if (q.isError) return <p className="text-xs text-destructive">হস্তান্তর তথ্য লোড হয়নি।</p>;
  if (!s) return null;
  const b = s.booking;
  const approved = b?.approval === "approved";
  const stage = approved ? 4 : b ? 3 : s.visitCompleted ? 2 : s.visitScheduled ? 1 : 0;
  const stages = ["আগ্রহ", "সাইট ভিজিট", "ভিজিট সম্পন্ন", "বুকিং", "HQ অনুমোদিত"];
  const groups: { title: string; items: Item[] }[] = [
    { title: "অগ্রগতি", items: [
      { label: "কল রিপোর্ট জমা", state: s.reported ? "done" : "todo" },
      { label: "সাইট ভিজিট নির্ধারিত", state: s.visitScheduled ? "done" : "todo" },
      { label: "সাইট ভিজিট সম্পন্ন", state: s.visitCompleted ? "done" : s.visitScheduled ? "pending" : "todo" },
      { label: "বুকিং রেকর্ড", state: b ? "done" : "todo", note: b?.project ?? undefined },
      { label: "HQ বুকিং অনুমোদন", state: approved ? "done" : b ? "pending" : "todo", note: b && !approved ? `অবস্থা: ${b.approval}` : undefined },
    ]},
    { title: "প্রয়োজনীয় নথি (গ্রাহকের কাছ থেকে যাচাই করুন)", items: stage >= 2 ? [
      { label: "জাতীয় পরিচয়পত্র (NID) কপি", state: "todo" },
      { label: "পাসপোর্ট সাইজ ছবি", state: "todo" },
      { label: "TIN সার্টিফিকেট (প্রযোজ্য হলে)", state: "todo" },
      { label: "নমিনির NID ও ছবি", state: "todo" },
    ] : [] },
    { title: "পেমেন্ট (অফিসের রসিদ দিয়ে যাচাই)", items: b ? [
      { label: "বুকিং মানি", state: approved ? "done" : "pending", note: approved ? "HQ অনুমোদিত" : "HQ যাচাইয়ের অপেক্ষায়" },
      { label: "ডাউন পেমেন্ট — প্রকল্পের শর্ত অনুযায়ী", state: "todo" },
      { label: "কিস্তির সূচি গ্রাহককে বুঝিয়ে দেওয়া", state: "todo" },
    ] : [] },
  ];
  const next = [
    "লিডকে কল করে প্রয়োজন জেনে রিপোর্ট জমা দিন",
    "সাইট ভিজিট সম্পন্ন করে ফলাফল সংরক্ষণ করুন",
    "নথি সংগ্রহ করে বুকিং রেকর্ড করুন",
    "HQ অনুমোদনের অপেক্ষা করুন; গ্রাহককে কোনো নিশ্চয়তা দেবেন না",
    "ডাউন পেমেন্ট ও চুক্তির জন্য অফিস অ্যাপয়েন্টমেন্ট ঠিক করুন",
  ][stage];
  const Icon = ({ st }: { st: Item["state"] }) =>
    st === "done" ? <CheckCircle2 className="size-4 text-primary" /> : st === "pending" ? <Clock className="size-4 text-muted-foreground" /> : <Circle className="size-4 text-muted-foreground" />;

  return (
    <section className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center gap-2 text-sm font-semibold text-primary"><ClipboardCheck className="size-4" /> হস্তান্তর চেকলিস্ট</div>
      <ol className="mt-3 flex flex-wrap gap-1 text-xs" aria-label="ক্রেতার অগ্রগতি">
        {stages.map((t, i) => (
          <li key={t} className={`rounded-full border px-2 py-0.5 ${i <= stage ? "border-primary/40 bg-primary/10 text-primary" : "border-border text-muted-foreground"}`}>{t}</li>
        ))}
      </ol>
      <p className="mt-3 text-sm"><span className="text-muted-foreground">পরের পদক্ষেপ: </span>{next}</p>
      {groups.filter((g) => g.items.length).map((g) => (
        <div key={g.title} className="mt-3">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">{g.title}</p>
          <ul className="mt-1 space-y-1 text-sm">
            {g.items.map((it) => (
              <li key={it.label} className="flex items-start gap-2"><Icon st={it.state} /><span>{it.label}{it.note ? <span className="text-muted-foreground"> · {it.note}</span> : null}</span></li>
            ))}
          </ul>
        </div>
      ))}
      <p className="mt-3 text-xs text-muted-foreground">টিক শুধু সংরক্ষিত CRM রেকর্ড থেকে আসে; নথি ও পেমেন্ট নিজে যাচাই করুন।</p>
    </section>
  );
}
