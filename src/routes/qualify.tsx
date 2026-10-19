import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Copy, Flame } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/crm/AppShell";
import { LangToggle } from "@/components/crm/LangToggle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { DHAKA_LOCATIONS, isValidBdPhone, normalizeBdPhone } from "@/lib/bd-format";
import { useLang, useT } from "@/lib/i18n";
import { executiveSummary, nextQuestions, qualifyConversation, scoreQualification, sortByPriority } from "@/lib/lead-qualification";
import { useAdminToken } from "@/lib/local-session";
import { whatsappQualificationFeed } from "@/lib/unit-inventory.functions";

export const Route = createFileRoute("/qualify")({
  head: () => ({
    meta: [
      { title: "WhatsApp Lead Qualification — Winstone Pulse" },
      { name: "description", content: "Bangla, English and Banglish WhatsApp enquiries scored with budget, area, bed/bath and timeline." },
      { property: "og:title", content: "WhatsApp Lead Qualification — Winstone Pulse" },
      { property: "og:description", content: "Hot-lead priority and executive summaries for agents." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: QualifyPage,
});

const TEMP_CLASS = { hot: "border-destructive/50 bg-destructive/10", warm: "border-warning/60 bg-warning/15", cold: "border-border bg-muted" } as const;

function QualifyPage() {
  const t = useT();
  const lang = useLang();
  const adminToken = useAdminToken();
  const feed = useServerFn(whatsappQualificationFeed);
  const q = useQuery({ queryKey: ["wa-qualify", adminToken ? "pin" : "s"], queryFn: () => feed({ data: { adminToken } }) });
  const rows = useMemo(() => sortByPriority((q.data?.rows ?? []).map((r) => {
    const qual = qualifyConversation(r.messages);
    return { ...r, qual, score: scoreQualification(qual) };
  })), [q.data]);

  return (
    <AppShell>
      <div className="mx-auto max-w-5xl space-y-5 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold">{t({ bn: "WhatsApp লিড কোয়ালিফিকেশন", en: "WhatsApp lead qualification" })}</h1>
            <p className="text-sm text-muted-foreground">{t({ bn: "গত ৩০ দিনের গ্রাহক বার্তা থেকে স্কোর; হট লিড সবার উপরে। কিছুই নিজে থেকে পাঠানো হয় না।", en: "Scored from the last 30 days of customer messages; hot leads first. Nothing is sent automatically." })}</p>
          </div>
          <LangToggle />
        </div>

        <IntakeForm />

        {q.isLoading ? <p className="text-sm text-muted-foreground">{t({ bn: "লোড হচ্ছে…", en: "Loading…" })}</p> : null}
        {q.isSuccess && !rows.length ? <p className="rounded-lg border bg-card p-4 text-sm text-muted-foreground">{t({ bn: "গত ৩০ দিনে কোনো গ্রাহক WhatsApp বার্তা সিঙ্ক হয়নি।", en: "No customer WhatsApp messages synced in the last 30 days." })}</p> : null}
        <ul className="space-y-2">
          {rows.map((r) => (
            <li key={r.leadId} className={`rounded-lg border p-3 text-sm ${TEMP_CLASS[r.score.temperature]}`}>
              <div className="flex items-center justify-between gap-2">
                <Link to="/live-leads" className="font-medium underline-offset-2 hover:underline">{r.name}</Link>
                {r.score.priority ? <span className="inline-flex items-center gap-1 text-xs font-semibold text-destructive"><Flame className="size-3" />{t({ bn: "হট — আগে কল", en: "Hot — call first" })}</span> : null}
              </div>
              <ul className="mt-1 list-disc pl-4 text-xs">{executiveSummary(r.qual, lang).map((l) => <li key={l}>{l}</li>)}</ul>
              <Questions items={nextQuestions(r.qual, lang)} />
            </li>
          ))}
        </ul>
      </div>
    </AppShell>
  );
}

function Questions({ items }: { items: string[] }) {
  const t = useT();
  if (!items.length) return null;
  return (
    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
      <span className="text-muted-foreground">{t({ bn: "পরের প্রশ্ন:", en: "Ask next:" })}</span>
      <Button size="sm" variant="outline" onClick={() => { void navigator.clipboard.writeText(items.join("\n")); toast.success(t({ bn: "কপি হয়েছে", en: "Copied" })); }}>
        <Copy className="size-3" /> {items.length}
      </Button>
      <span className="text-muted-foreground">{items[0]}</span>
    </div>
  );
}

/** Client intake: paste an enquiry (Bangla/English/Banglish) to preview qualification before logging it. */
function IntakeForm() {
  const t = useT();
  const lang = useLang();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [area, setArea] = useState("");
  const [text, setText] = useState("");
  const qual = useMemo(() => {
    const loc = DHAKA_LOCATIONS.find((l) => l.key === area);
    return qualifyConversation([text, loc ? loc.en : ""]);
  }, [text, area]);
  const score = scoreQualification(qual);
  const phoneOk = !phone || isValidBdPhone(phone);
  return (
    <section className="grid gap-2 rounded-lg border bg-card p-3 sm:grid-cols-3">
      <h2 className="text-sm font-medium sm:col-span-3">{t({ bn: "ক্লায়েন্ট ইনটেক", en: "Client intake" })}</h2>
      <Input placeholder={t({ bn: "নাম", en: "Name" })} value={name} onChange={(e) => setName(e.target.value)} maxLength={100} />
      <div>
        <Input placeholder="+880 1X…" value={phone} onChange={(e) => setPhone(e.target.value)} aria-invalid={!phoneOk} maxLength={20} />
        {!phoneOk ? <p className="text-xs text-destructive">{t({ bn: "সঠিক বাংলাদেশি মোবাইল নম্বর দিন", en: "Enter a valid Bangladesh mobile" })}</p> : phone ? <p className="text-xs text-muted-foreground">{normalizeBdPhone(phone)}</p> : null}
      </div>
      <select className="h-9 rounded-md border bg-background px-2 text-sm" value={area} onChange={(e) => setArea(e.target.value)} aria-label="Area">
        <option value="">{t({ bn: "পছন্দের এলাকা", en: "Preferred area" })}</option>
        {DHAKA_LOCATIONS.map((l) => <option key={l.key} value={l.key}>{l[lang]}</option>)}
      </select>
      <Textarea className="sm:col-span-3" rows={3} maxLength={2000} value={text} onChange={(e) => setText(e.target.value)}
        placeholder={t({ bn: "গ্রাহকের বার্তা লিখুন বা পেস্ট করুন (যেমন: ১.৫ কোটি বাজেট, ৩ বেড, এখনই)", en: "Type or paste the enquiry (e.g. 1.5 koti budget, 3 bed, ekhoni)" })} />
      {text || area ? (
        <div className={`rounded-md border p-2 text-xs sm:col-span-3 ${TEMP_CLASS[score.temperature]}`}>
          <ul className="list-disc pl-4">{executiveSummary(qual, lang).map((l) => <li key={l}>{l}</li>)}</ul>
          <Questions items={nextQuestions(qual, lang)} />
        </div>
      ) : null}
      <p className="text-xs text-muted-foreground sm:col-span-3">{t({ bn: "নতুন লিড LeadHub-এর মাধ্যমে যোগ ও বণ্টন হয়; এখানে শুধু প্রিভিউ।", en: "New leads are added and assigned through LeadHub; this is a preview only." })}</p>
    </section>
  );
}
