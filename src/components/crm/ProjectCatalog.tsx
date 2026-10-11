import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Building2, MessageSquareText, Plus, TrendingUp } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useAdminToken } from "@/lib/local-session";
import { useLang } from "@/lib/i18n";
import {
  addProjectNote, addSalesUpdate, INTERESTS, leadProjectActivity, listProjectNotes, listProjects, PARTIES, saveProject,
  type CatalogProject,
} from "@/lib/projects.functions";

const L = {
  catalog: { bn: "প্রজেক্ট ক্যাটালগ ও মূল্য", en: "Project catalog & pricing" },
  hqOnly: { bn: "শুধু HQ/IT মূল্য বদলাতে পারে", en: "Only HQ/IT can change prices" },
  add: { bn: "নতুন প্রজেক্ট", en: "New project" },
  edit: { bn: "সম্পাদনা", en: "Edit" },
  save: { bn: "সংরক্ষণ", en: "Save" },
  cancel: { bn: "বাতিল", en: "Cancel" },
  empty: { bn: "এখনো কোনো প্রজেক্ট যোগ হয়নি — HQ যোগ করবে।", en: "No projects yet — HQ will add them." },
  loading: { bn: "লোড হচ্ছে…", en: "Loading…" },
  notes: { bn: "আলোচনার নোট", en: "Discussion notes" },
  noNotes: { bn: "কোনো নোট নেই", en: "No notes" },
  sales: { bn: "প্রজেক্ট ও বিক্রির আপডেট", en: "Project & sales update" },
  pick: { bn: "প্রজেক্ট নির্বাচন করুন", en: "Select project" },
  offered: { bn: "ক্লায়েন্টকে বলা মূল্য (৳, ঐচ্ছিক)", en: "Price quoted to client (৳, optional)" },
  clientNote: { bn: "ক্লায়েন্টের সঙ্গে আলোচনা (ঐচ্ছিক)", en: "Client discussion (optional)" },
  submit: { bn: "আপডেট দিন", en: "Submit update" },
  history: { bn: "আগের আপডেট", en: "Earlier updates" },
} as const;
const FIELDS: Array<[keyof CatalogProject, { bn: string; en: string }]> = [
  ["location", { bn: "লোকেশন", en: "Location" }],
  ["price_per_sqft", { bn: "প্রতি বর্গফুট (৳)", en: "Per sqft (৳)" }],
  ["unit_sizes", { bn: "ইউনিট সাইজ", en: "Unit sizes" }],
  ["total_price", { bn: "মোট মূল্য", en: "Total price" }],
  ["down_payment", { bn: "ডাউন পেমেন্ট", en: "Down payment" }],
  ["installment_plan", { bn: "কিস্তি", en: "Installments" }],
  ["parking_charge", { bn: "পার্কিং", en: "Parking" }],
  ["extra_charges", { bn: "অতিরিক্ত চার্জ", en: "Extra charges" }],
  ["notes", { bn: "অন্যান্য", en: "Other" }],
];
const INTEREST_L: Record<string, { bn: string; en: string } | undefined> = {
  interested: { bn: "আগ্রহী", en: "Interested" }, negotiating: { bn: "দরকষাকষি", en: "Negotiating" }, not_now: { bn: "এখন না", en: "Not now" },
};
const PARTY_L: Record<string, { bn: string; en: string } | undefined> = {
  client: { bn: "ক্লায়েন্ট", en: "Client" }, land_owner: { bn: "জমির মালিক", en: "Land owner" }, flat_seller: { bn: "ফ্ল্যাট বিক্রেতা", en: "Flat seller" },
};
const when = (iso: string) => new Date(iso).toLocaleString("bn-BD", { timeZone: "Asia/Dhaka", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
const money = (n: number) => `৳${n.toLocaleString("en-IN")}`;

function useT() {
  const lang = useLang();
  return (x: { bn: string; en: string }) => (lang === "en" ? x.en : x.bn);
}

export function useProjects() {
  const adminToken = useAdminToken();
  const fn = useServerFn(listProjects);
  return useQuery({ queryKey: ["project-catalog", adminToken ? "pin" : "s"], queryFn: () => fn({ data: { adminToken } }), staleTime: 60_000 });
}

function ProjectForm({ initial, onDone }: { initial: Partial<CatalogProject> | null; onDone: () => void }) {
  const t = useT();
  const adminToken = useAdminToken();
  const qc = useQueryClient();
  const save = useServerFn(saveProject);
  const [f, setF] = useState<Record<string, string | undefined>>(() =>
    Object.fromEntries(["name", ...FIELDS.map(([k]) => k)].map((k) => [k, initial?.[k as keyof CatalogProject] == null ? "" : String(initial[k as keyof CatalogProject])])),
  );
  const [status, setStatus] = useState(initial?.status ?? "active");
  const m = useMutation({
    mutationFn: () => {
      const s = (k: string) => f[k]?.trim() || null;
      const ppsf = f["price_per_sqft"]?.trim() ? Number(f["price_per_sqft"]) : null;
      if (ppsf != null && !Number.isFinite(ppsf)) throw new Error("বর্গফুট মূল্য সংখ্যা হতে হবে");
      return save({ data: { adminToken, id: initial?.id ?? null, name: f["name"] ?? "", status: status as "active" | "archived", price_per_sqft: ppsf,
        location: s("location"), unit_sizes: s("unit_sizes"), total_price: s("total_price"), down_payment: s("down_payment"),
        installment_plan: s("installment_plan"), parking_charge: s("parking_charge"), extra_charges: s("extra_charges"), notes: s("notes") } });
    },
    onSuccess: () => { toast.success("সংরক্ষিত"); qc.invalidateQueries({ queryKey: ["project-catalog"] }); onDone(); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "ব্যর্থ"),
  });
  return (
    <form className="grid gap-2 rounded-xl border border-border bg-muted/40 p-3 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); m.mutate(); }}>
      <label className="text-xs sm:col-span-2">নাম / Name<Input required value={f["name"]} onChange={(e) => setF({ ...f, name: e.target.value })} /></label>
      {FIELDS.map(([k, lbl]) => (
        <label key={k} className="text-xs">{t(lbl)}
          <Input inputMode={k === "price_per_sqft" ? "decimal" : undefined} value={f[k] ?? ""} onChange={(e) => setF({ ...f, [k]: e.target.value })} />
        </label>
      ))}
      <label className="text-xs">Status
        <select className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="active">active</option><option value="archived">archived</option>
        </select>
      </label>
      <div className="flex gap-2 sm:col-span-2">
        <Button type="submit" disabled={m.isPending}>{t(L.save)}</Button>
        <Button type="button" variant="ghost" onClick={onDone}>{t(L.cancel)}</Button>
      </div>
    </form>
  );
}

function NotesBlock({ project, canEdit }: { project: CatalogProject; canEdit: boolean }) {
  const t = useT();
  const adminToken = useAdminToken();
  const qc = useQueryClient();
  const list = useServerFn(listProjectNotes);
  const add = useServerFn(addProjectNote);
  const q = useQuery({ queryKey: ["project-notes", project.id], queryFn: () => list({ data: { adminToken, projectId: project.id } }) });
  const [party, setParty] = useState<"land_owner" | "flat_seller">("land_owner");
  const [note, setNote] = useState("");
  const m = useMutation({
    mutationFn: () => add({ data: { adminToken, projectId: project.id, party, note } }),
    onSuccess: () => { setNote(""); qc.invalidateQueries({ queryKey: ["project-notes", project.id] }); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "ব্যর্থ"),
  });
  return (
    <div className="mt-2 space-y-2 border-t border-border pt-2">
      <p className="flex items-center gap-1 text-xs font-semibold"><MessageSquareText className="size-3.5" />{t(L.notes)}</p>
      {q.isLoading ? <p className="text-xs text-muted-foreground" role="status">{t(L.loading)}</p> : null}
      {q.data && !q.data.length ? <p className="text-xs text-muted-foreground">{t(L.noNotes)}</p> : null}
      <ul className="max-h-48 space-y-1 overflow-y-auto">
        {(q.data ?? []).map((n) => (
          <li key={n.id} className="rounded-md bg-muted/50 px-2 py-1 text-xs">
            <span className="font-semibold">{t(PARTY_L[n.party] ?? PARTY_L["client"]!)}</span> · {n.created_by} · <span className="tabular text-muted-foreground">{when(n.created_at)}</span>
            <p className="whitespace-pre-wrap">{n.note}</p>
          </li>
        ))}
      </ul>
      {canEdit ? (
        <form className="flex flex-col gap-1.5 sm:flex-row" onSubmit={(e) => { e.preventDefault(); if (note.trim().length >= 2) m.mutate(); }}>
          <select aria-label="party" className="h-9 rounded-md border border-input bg-background px-2 text-xs" value={party} onChange={(e) => setParty(e.target.value as typeof party)}>
            <option value="land_owner">{t(PARTY_L["land_owner"]!)}</option><option value="flat_seller">{t(PARTY_L["flat_seller"]!)}</option>
          </select>
          <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="মালিকের সঙ্গে আলোচনা…" maxLength={1000} />
          <Button type="submit" size="sm" disabled={m.isPending}>{t(L.save)}</Button>
        </form>
      ) : null}
    </div>
  );
}

export function ProjectCatalogPanel() {
  const t = useT();
  const q = useProjects();
  const [editing, setEditing] = useState<Partial<CatalogProject> | null | "new">(null);
  const [open, setOpen] = useState<string | null>(null);
  const canEdit = q.data?.canEdit ?? false;
  return (
    <section className="space-y-3 rounded-2xl border border-border bg-card p-4" aria-labelledby="catalog-h">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="catalog-h" className="flex items-center gap-2 text-base font-bold"><Building2 className="size-4 text-primary" />{t(L.catalog)}</h2>
        {canEdit ? <Button size="sm" onClick={() => setEditing("new")}><Plus className="size-4" />{t(L.add)}</Button> : <span className="text-xs text-muted-foreground">{t(L.hqOnly)}</span>}
      </div>
      {editing ? <ProjectForm initial={editing === "new" ? null : editing} onDone={() => setEditing(null)} /> : null}
      {q.isLoading ? <p role="status" className="text-sm text-muted-foreground">{t(L.loading)}</p> : null}
      {q.isError ? <p role="alert" className="text-sm text-destructive">{(q.error as Error).message}</p> : null}
      {q.data && !q.data.projects.length ? <p className="text-sm text-muted-foreground">{t(L.empty)}</p> : null}
      <div className="grid gap-3 md:grid-cols-2">
        {(q.data?.projects ?? []).map((p) => (
          <article key={p.id} className="rounded-xl border border-border p-3 text-sm">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="font-semibold">{p.name}{p.status === "archived" ? <span className="ml-2 text-xs text-muted-foreground">(archived)</span> : null}</h3>
                <p className="text-[11px] text-muted-foreground">{p.updated_by} · {when(p.updated_at)}</p>
              </div>
              {canEdit ? <Button size="sm" variant="ghost" onClick={() => setEditing(p)}>{t(L.edit)}</Button> : null}
            </div>
            <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
              {FIELDS.filter(([k]) => p[k] != null && p[k] !== "").map(([k, lbl]) => (
                <div key={k} className="min-w-0"><dt className="text-muted-foreground">{t(lbl)}</dt><dd className="break-words font-medium">{k === "price_per_sqft" ? money(Number(p[k])) : String(p[k])}</dd></div>
              ))}
            </dl>
            <Button size="sm" variant="link" className="px-0" onClick={() => setOpen(open === p.id ? null : p.id)}>{t(L.notes)}</Button>
            {open === p.id ? <NotesBlock project={p} canEdit={canEdit} /> : null}
          </article>
        ))}
      </div>
    </section>
  );
}

/** Lead-level: pick a project during the call and log interest, quoted price and client notes. */
export function LeadProjectSales({ leadId }: { leadId: string }) {
  const t = useT();
  const adminToken = useAdminToken();
  const qc = useQueryClient();
  const projects = useProjects();
  const actFn = useServerFn(leadProjectActivity);
  const addU = useServerFn(addSalesUpdate);
  const addN = useServerFn(addProjectNote);
  const act = useQuery({ queryKey: ["lead-project-activity", leadId], queryFn: () => actFn({ data: { adminToken, leadId } }) });
  const [projectId, setProjectId] = useState("");
  const [interest, setInterest] = useState<(typeof INTERESTS)[number]>("interested");
  const [price, setPrice] = useState("");
  const [note, setNote] = useState("");
  const active = (projects.data?.projects ?? []).filter((p) => p.status === "active");
  const chosen = active.find((p) => p.id === projectId);
  const name = new Map((projects.data?.projects ?? []).map((p) => [p.id, p.name]));
  const m = useMutation({
    mutationFn: async () => {
      const offered = price.trim() ? Number(price.replace(/,/g, "")) : null;
      if (offered != null && (!Number.isFinite(offered) || offered <= 0)) throw new Error("মূল্য সঠিক সংখ্যা দিন");
      await addU({ data: { adminToken, leadId, projectId, interest, offeredPrice: offered, note: null } });
      if (note.trim().length >= 2) await addN({ data: { adminToken, projectId, party: "client", leadId, note: note.trim() } });
    },
    onSuccess: () => { toast.success("আপডেট সংরক্ষিত"); setPrice(""); setNote(""); qc.invalidateQueries({ queryKey: ["lead-project-activity", leadId] }); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "ব্যর্থ"),
  });
  const updates = act.data?.updates ?? [];
  const notes = act.data?.notes ?? [];
  return (
    <section className="space-y-2 rounded-2xl border border-border bg-card p-3 text-sm" aria-labelledby={`ps-${leadId}`}>
      <h3 id={`ps-${leadId}`} className="flex items-center gap-1.5 text-xs font-semibold"><TrendingUp className="size-3.5 text-primary" />{t(L.sales)}</h3>
      {projects.isLoading ? <p role="status" className="text-xs text-muted-foreground">{t(L.loading)}</p> : null}
      {projects.data && !active.length ? <p className="text-xs text-muted-foreground">{t(L.empty)}</p> : null}
      {active.length ? (
        <form className="space-y-2" onSubmit={(e) => { e.preventDefault(); if (projectId) m.mutate(); }}>
          <select aria-label={t(L.pick)} required className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm" value={projectId} onChange={(e) => setProjectId(e.target.value)}>
            <option value="">{t(L.pick)}</option>
            {active.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          {chosen ? (
            <dl className="grid grid-cols-2 gap-x-3 gap-y-1 rounded-md bg-muted/50 p-2 text-xs">
              {FIELDS.filter(([k]) => chosen[k] != null && chosen[k] !== "").map(([k, lbl]) => (
                <div key={k}><dt className="text-muted-foreground">{t(lbl)}</dt><dd className="break-words font-medium">{k === "price_per_sqft" ? money(Number(chosen[k])) : String(chosen[k])}</dd></div>
              ))}
            </dl>
          ) : null}
          <div className="flex flex-wrap gap-1.5" role="radiogroup">
            {INTERESTS.map((i) => (
              <Button key={i} type="button" size="sm" variant={interest === i ? "default" : "outline"} role="radio" aria-checked={interest === i} onClick={() => setInterest(i)}>{t(INTEREST_L[i]!)}</Button>
            ))}
          </div>
          <Input inputMode="numeric" placeholder={t(L.offered)} value={price} onChange={(e) => setPrice(e.target.value)} />
          <Textarea rows={2} placeholder={t(L.clientNote)} maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)} />
          <Button type="submit" size="sm" disabled={!projectId || m.isPending}>{t(L.submit)}</Button>
        </form>
      ) : null}
      {updates.length || notes.length ? (
        <div className="space-y-1 border-t border-border pt-2">
          <p className="text-[11px] font-semibold text-muted-foreground">{t(L.history)}</p>
          <ul className="max-h-56 space-y-1 overflow-y-auto text-xs">
            {updates.map((u) => (
              <li key={u.id} className="rounded-md bg-muted/50 px-2 py-1">
                <span className="font-semibold">{name.get(u.project_id) ?? "—"}</span> · {t(INTEREST_L[u.interest] ?? INTEREST_L["interested"]!)}
                {u.offered_price != null ? <> · {money(Number(u.offered_price))}</> : null} · {u.created_by} · <span className="tabular text-muted-foreground">{when(u.created_at)}</span>
              </li>
            ))}
            {notes.map((n) => (
              <li key={n.id} className="rounded-md border border-border px-2 py-1">
                <span className="font-semibold">{name.get(n.project_id) ?? "—"}</span> · {t(PARTY_L[n.party] ?? PARTY_L["client"]!)} · <span className="tabular text-muted-foreground">{when(n.created_at)}</span>
                <p className="whitespace-pre-wrap">{n.note}</p>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
