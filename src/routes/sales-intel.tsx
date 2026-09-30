import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Lightbulb } from "lucide-react";
import { useState } from "react";

import { AppShell } from "@/components/crm/AppShell";
import {
  EffectivenessPanel,
  FactsBoard,
  PitchHistoryPanel,
  PitchLibraryAdmin,
  PitchbookWorkspace,
  VersionHistoryPanel,
} from "@/components/crm/sales-intel/SalesIntelPanels";
import { useAdminToken } from "@/lib/local-session";
import { PAGE_SECTIONS, sectionSearch, useSection } from "@/lib/page-sections";
import { siWhoAmI } from "@/lib/sales-intel.functions";
import { FACT_CATEGORIES, SI_DOC_VERSION, type FactCategory } from "@/lib/sales-intel-rules";

export const Route = createFileRoute("/sales-intel")({
  validateSearch: sectionSearch,
  head: () => ({
    meta: [
      { title: "Sales Intelligence — Winstone CRM" },
      { name: "description", content: "AI Sales Brief, Smart Pitchbook, verified market facts, permanent pitch history and pitch effectiveness inside Winstone CRM." },
      { property: "og:title", content: "Sales Intelligence — Winstone CRM" },
      { property: "og:description", content: "Grounded sales briefs and objection handling from verified facts and real lead history." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SalesIntelPage,
});

function SalesIntelPage() {
  const adminToken = useAdminToken();
  const who = useServerFn(siWhoAmI);
  const me = useQuery({ queryKey: ["si-who", adminToken], queryFn: () => who({ data: { adminToken } }) });
  const [section, setSection] = useSection("/sales-intel");
  const [cat, setCat] = useState<FactCategory | null>(null);
  const scope = me.data?.scope ?? "none";
  const isHq = scope === "authority";

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-7xl space-y-4 px-3 py-5 sm:px-5">
        <header className="flex flex-wrap items-center gap-3">
          <span className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary"><Lightbulb className="size-5" /></span>
          <div className="min-w-0">
            <h1 className="text-xl font-bold sm:text-2xl">Sales Intelligence</h1>
            <p className="text-xs text-muted-foreground">Canonical lead data + verified facts only · {SI_DOC_VERSION}</p>
          </div>
        </header>
        <nav className="flex gap-1 overflow-x-auto pb-1 lg:hidden">
          {PAGE_SECTIONS["/sales-intel"].map((s) => (
            <button key={s.key} onClick={() => setSection(s.key)} className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium ${section === s.key ? "bg-primary text-primary-foreground" : "bg-muted"}`}>{s.label}</button>
          ))}
        </nav>

        {me.isLoading && <p className="text-sm text-muted-foreground">লোড হচ্ছে…</p>}
        {!me.isLoading && scope === "none" && <p className="rounded-2xl border border-border bg-card p-5 text-sm">Sales Intelligence দেখতে সাইন ইন করুন (এজেন্ট) অথবা HQ/IT PIN দিন।</p>}

        {scope !== "none" && section === "pitchbook" && (isHq
          ? <p className="rounded-2xl border border-border bg-card p-5 text-sm text-muted-foreground">Smart Pitchbook নির্ধারিত এজেন্টের জন্য — HQ প্রতিটি লিডের পিচ ইতিহাস Lead 360 ও Pitch History-তে দেখতে পারে।</p>
          : <PitchbookWorkspace />)}
        {scope !== "none" && section === "history" && <PitchHistoryPanel />}
        {scope !== "none" && section === "market" && (
          <>
            <div className="flex flex-wrap gap-2">
              <button onClick={() => setCat(null)} className={`rounded-full px-3 py-1.5 text-xs font-medium ${cat === null ? "bg-primary text-primary-foreground" : "bg-muted"}`}>সব</button>
              {FACT_CATEGORIES.map((c) => (
                <button key={c.code} onClick={() => setCat(c.code)} className={`rounded-full px-3 py-1.5 text-xs font-medium ${cat === c.code ? "bg-primary text-primary-foreground" : "bg-muted"}`}>{c.label}</button>
              ))}
            </div>
            <FactsBoard category={cat} admin={false} />
          </>
        )}
        {scope !== "none" && section === "effectiveness" && <EffectivenessPanel />}
        {scope !== "none" && section === "admin" && (isHq ? (
          <div className="space-y-4">
            {me.data?.readOnly && <p className="rounded-xl bg-warning/15 p-3 text-sm text-warning">Executive HQ ভিউ সেশন: দেখা যাবে, কিন্তু যাচাই/প্রকাশ করতে IT PIN প্রয়োজন।</p>}
            <FactsBoard category={null} admin />
            <PitchLibraryAdmin />
            <VersionHistoryPanel />
          </div>
        ) : <p className="rounded-2xl border border-border bg-card p-5 text-sm text-muted-foreground">Knowledge Admin শুধু HQ/IT-এর জন্য। এজেন্টরা প্রকাশিত তথ্য ব্যবহার করেন, বদলাতে পারেন না।</p>)}
      </div>
    </AppShell>
  );
}
