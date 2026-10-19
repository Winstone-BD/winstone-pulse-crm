import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Printer } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/crm/AppShell";
import { LangToggle } from "@/components/crm/LangToggle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DHAKA_LOCATIONS, formatArea, formatTaka, isValidBdPhone, kathaToSqft, normalizeBdPhone, toBnDigits } from "@/lib/bd-format";
import { useLang, useT } from "@/lib/i18n";
import { useAdminToken } from "@/lib/local-session";
import { buildSchedule, DEFAULT_MILESTONES, validateSchedule, type ScheduleRow } from "@/lib/payment-schedule";
import { listUnits, saveUnit, UNIT_KINDS, UNIT_STATUSES, type Unit } from "@/lib/unit-inventory.functions";

export const Route = createFileRoute("/unit-board")({
  head: () => ({
    meta: [
      { title: "Unit Inventory & Booking — Winstone Pulse" },
      { name: "description", content: "Live apartment, commercial and plot inventory with BDT payment plans and booking slips." },
      { property: "og:title", content: "Unit Inventory & Booking — Winstone Pulse" },
      { property: "og:description", content: "Available, Booked, Sold, Blocked units with Lakh/Crore payment schedules." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: UnitBoardPage,
});

const STATUS_LABEL = {
  available: { bn: "উপলব্ধ", en: "Available" }, booked: { bn: "বুকড", en: "Booked" },
  sold: { bn: "বিক্রিত", en: "Sold" }, blocked: { bn: "ব্লকড", en: "Blocked" },
} as const;
const STATUS_CLASS = {
  available: "border-success/50 bg-success/10", booked: "border-warning/60 bg-warning/15",
  sold: "border-destructive/50 bg-destructive/10", blocked: "border-border bg-muted text-muted-foreground",
} as const;
const KIND_LABEL = { apartment: { bn: "অ্যাপার্টমেন্ট", en: "Apartment" }, commercial: { bn: "কমার্শিয়াল", en: "Commercial" }, plot: { bn: "প্লট", en: "Plot" } } as const;

function UnitBoardPage() {
  const t = useT();
  const lang = useLang();
  const adminToken = useAdminToken();
  const fetchUnits = useServerFn(listUnits);
  const q = useQuery({ queryKey: ["unit-board", adminToken ? "pin" : "s"], queryFn: () => fetchUnits({ data: { adminToken } }) });
  const [project, setProject] = useState("all");
  const [kind, setKind] = useState("all");
  const [selected, setSelected] = useState<Unit | null>(null);

  const units = useMemo(() => (q.data?.units ?? []).filter((u) => (project === "all" || u.projectId === project) && (kind === "all" || u.kind === kind)), [q.data, project, kind]);
  const counts = UNIT_STATUSES.map((s) => [s, units.filter((u) => u.status === s).length] as const);
  const byProject = useMemo(() => {
    const m = new Map<string, Unit[]>();
    for (const u of units) m.set(u.projectName, [...(m.get(u.projectName) ?? []), u]);
    return [...m.entries()];
  }, [units]);

  return (
    <AppShell>
      <div className="mx-auto max-w-6xl space-y-5 p-4 print:hidden">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold">{t({ bn: "ইউনিট ইনভেন্টরি ও বুকিং", en: "Unit inventory & booking" })}</h1>
            <p className="text-sm text-muted-foreground">{t({ bn: "অ্যাপার্টমেন্ট, কমার্শিয়াল ও প্লটের লাইভ অবস্থা", en: "Live status of apartments, commercial spaces and plots" })}</p>
          </div>
          <LangToggle />
        </div>

        <div className="flex flex-wrap gap-2">
          <select className="h-9 rounded-md border bg-card px-2 text-sm" value={project} onChange={(e) => setProject(e.target.value)} aria-label="Project">
            <option value="all">{t({ bn: "সব প্রজেক্ট", en: "All projects" })}</option>
            {(q.data?.projects ?? []).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <select className="h-9 rounded-md border bg-card px-2 text-sm" value={kind} onChange={(e) => setKind(e.target.value)} aria-label="Type">
            <option value="all">{t({ bn: "সব ধরন", en: "All types" })}</option>
            {UNIT_KINDS.map((k) => <option key={k} value={k}>{t(KIND_LABEL[k])}</option>)}
          </select>
          <div className="flex flex-wrap gap-2 text-xs">
            {counts.map(([s, c]) => <span key={s} className={`rounded-md border px-2 py-1.5 ${STATUS_CLASS[s]}`}>{t(STATUS_LABEL[s])}: {lang === "bn" ? toBnDigits(String(c)) : c}</span>)}
          </div>
        </div>

        {q.isLoading ? <p className="text-sm text-muted-foreground">{t({ bn: "লোড হচ্ছে…", en: "Loading…" })}</p> : null}
        {q.isSuccess && !units.length ? <p className="rounded-lg border bg-card p-4 text-sm text-muted-foreground">{t({ bn: "এখনো কোনো ইউনিট যোগ করা হয়নি।", en: "No units added yet." })}</p> : null}
        {byProject.map(([name, list]) => (
          <section key={name} className="space-y-2">
            <h2 className="text-sm font-medium">{name}</h2>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6">
              {list.sort((a, b) => a.code.localeCompare(b.code)).map((u) => (
                <button key={u.id} type="button" onClick={() => setSelected(u)}
                  className={`rounded-lg border p-2 text-left text-xs ${STATUS_CLASS[u.status]} ${selected?.id === u.id ? "ring-2 ring-ring" : ""}`}>
                  <div className="font-semibold">{u.code}</div>
                  <div>{t(KIND_LABEL[u.kind])}{u.floor ? ` · ${u.floor}` : ""}</div>
                  <div>{formatArea(u.sizeSqft, u.sizeKatha, lang)}</div>
                  <div>{u.priceBdt ? formatTaka(u.priceBdt, lang) : "—"}</div>
                  <div className="mt-1 font-medium">{t(STATUS_LABEL[u.status])}</div>
                </button>
              ))}
            </div>
          </section>
        ))}

        {q.data?.canEdit ? <UnitEditor key={selected?.id ?? "new"} unit={selected} projects={q.data.projects} adminToken={adminToken} onDone={() => setSelected(null)} /> : null}
      </div>
      <PaymentAndSlip unit={selected} />
    </AppShell>
  );
}

function UnitEditor({ unit, projects, adminToken, onDone }: { unit: Unit | null; projects: { id: string; name: string }[]; adminToken: string | null; onDone: () => void }) {
  const t = useT();
  const qc = useQueryClient();
  const save = useServerFn(saveUnit);
  const m = useMutation({
    mutationFn: (d: Parameters<typeof save>[0]["data"]) => save({ data: d }),
    onSuccess: () => { toast.success(t({ bn: "সংরক্ষণ হয়েছে", en: "Saved" })); void qc.invalidateQueries({ queryKey: ["unit-board"] }); onDone(); },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <form className="grid gap-2 rounded-lg border bg-card p-3 sm:grid-cols-4" onSubmit={(e) => {
      e.preventDefault();
      const f = new FormData(e.currentTarget);
      const num = (k: string) => { const v = String(f.get(k) ?? "").trim(); return v === "" ? null : Number(v); };
      const katha = num("katha");
      m.mutate({ adminToken, id: unit?.id ?? null, projectId: String(f.get("project")), code: String(f.get("code")), kind: f.get("kind") as Unit["kind"],
        floor: String(f.get("floor") ?? ""), sizeSqft: num("sqft") ?? (katha ? kathaToSqft(katha) : null), sizeKatha: katha,
        bedrooms: num("bed"), bathrooms: num("bath"), priceBdt: num("priceLakh") != null ? num("priceLakh")! * 100_000 : null, status: f.get("status") as Unit["status"] });
    }}>
      <h3 className="text-sm font-medium sm:col-span-4">{unit ? t({ bn: `ইউনিট ${unit.code} সম্পাদনা`, en: `Edit unit ${unit.code}` }) : t({ bn: "নতুন ইউনিট", en: "New unit" })}</h3>
      <select name="project" required defaultValue={unit?.projectId ?? ""} className="h-9 rounded-md border bg-background px-2 text-sm" aria-label="Project">
        <option value="" disabled>{t({ bn: "প্রজেক্ট", en: "Project" })}</option>
        {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
      </select>
      <Input name="code" required defaultValue={unit?.code} placeholder={t({ bn: "ইউনিট কোড (A-5)", en: "Unit code (A-5)" })} />
      <select name="kind" defaultValue={unit?.kind ?? "apartment"} className="h-9 rounded-md border bg-background px-2 text-sm" aria-label="Type">
        {UNIT_KINDS.map((k) => <option key={k} value={k}>{t(KIND_LABEL[k])}</option>)}
      </select>
      <select name="status" defaultValue={unit?.status ?? "available"} className="h-9 rounded-md border bg-background px-2 text-sm" aria-label="Status">
        {UNIT_STATUSES.map((s) => <option key={s} value={s}>{t(STATUS_LABEL[s])}</option>)}
      </select>
      <Input name="floor" defaultValue={unit?.floor ?? ""} placeholder={t({ bn: "ফ্লোর", en: "Floor" })} />
      <Input name="sqft" type="number" min={0} defaultValue={unit?.sizeSqft ?? ""} placeholder="sq ft" />
      <Input name="katha" type="number" min={0} step="0.01" defaultValue={unit?.sizeKatha ?? ""} placeholder={t({ bn: "কাঠা", en: "Katha" })} />
      <Input name="priceLakh" type="number" min={0} step="0.01" defaultValue={unit?.priceBdt ? unit.priceBdt / 100_000 : ""} placeholder={t({ bn: "দাম (লাখ ৳)", en: "Price (Lakh ৳)" })} />
      <Input name="bed" type="number" min={0} defaultValue={unit?.bedrooms ?? ""} placeholder={t({ bn: "বেড", en: "Beds" })} />
      <Input name="bath" type="number" min={0} defaultValue={unit?.bathrooms ?? ""} placeholder={t({ bn: "বাথ", en: "Baths" })} />
      <div className="flex gap-2 sm:col-span-2">
        <Button type="submit" disabled={m.isPending}>{t({ bn: "সংরক্ষণ", en: "Save" })}</Button>
        {unit ? <Button type="button" variant="outline" onClick={onDone}>{t({ bn: "নতুন", en: "New" })}</Button> : null}
      </div>
    </form>
  );
}

function PaymentAndSlip({ unit }: { unit: Unit | null }) {
  const t = useT();
  const lang = useLang();
  const [lakh, setLakh] = useState("");
  const [down, setDown] = useState(20);
  const [months, setMonths] = useState(36);
  const [instPct, setInstPct] = useState(50);
  const [ms, setMs] = useState(DEFAULT_MILESTONES);
  const [client, setClient] = useState({ name: "", phone: "", location: "" });
  const total = Number(lakh || (unit?.priceBdt ? unit.priceBdt / 100_000 : 0)) * 100_000;
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Dhaka" });
  const input = { totalBdt: total, downPaymentPct: down, installmentMonths: months, installmentPct: instPct, milestones: ms, startDate: today };
  const err = validateSchedule(input);
  const rows: ScheduleRow[] = err ? [] : buildSchedule(input);
  const inst = rows.filter((r) => r.kind === "installment");
  const shown = rows.filter((r) => r.kind !== "installment");
  const phoneOk = !client.phone || isValidBdPhone(client.phone);

  return (
    <div className="mx-auto max-w-6xl space-y-3 p-4 print:max-w-none print:p-0">
      <section className="grid gap-2 rounded-lg border bg-card p-3 sm:grid-cols-4 print:hidden">
        <h2 className="text-sm font-medium sm:col-span-4">{t({ bn: "পেমেন্ট শিডিউল ক্যালকুলেটর", en: "Payment schedule calculator" })}{unit ? ` — ${unit.projectName} ${unit.code}` : ""}</h2>
        <label className="text-xs">{t({ bn: "মোট মূল্য (লাখ ৳)", en: "Total price (Lakh ৳)" })}<Input type="number" min={0} value={lakh || (unit?.priceBdt ? unit.priceBdt / 100_000 : "")} onChange={(e) => setLakh(e.target.value)} /></label>
        <label className="text-xs">{t({ bn: "ডাউন পেমেন্ট %", en: "Down payment %" })}<Input type="number" min={0} max={100} value={down} onChange={(e) => setDown(Number(e.target.value))} /></label>
        <label className="text-xs">{t({ bn: "মাসিক কিস্তি %", en: "Monthly installments %" })}<Input type="number" min={0} max={100} value={instPct} onChange={(e) => setInstPct(Number(e.target.value))} /></label>
        <label className="text-xs">{t({ bn: "কিস্তির মাস", en: "Installment months" })}<Input type="number" min={0} max={120} value={months} onChange={(e) => setMonths(Number(e.target.value))} /></label>
        {ms.map((m, i) => (
          <label key={m.label} className="text-xs">{m.label} %<Input type="number" min={0} max={100} value={m.pct} onChange={(e) => setMs(ms.map((x, j) => (j === i ? { ...x, pct: Number(e.target.value) } : x)))} /></label>
        ))}
        <Input placeholder={t({ bn: "ক্রেতার নাম", en: "Client name" })} value={client.name} onChange={(e) => setClient({ ...client, name: e.target.value })} maxLength={100} />
        <div>
          <Input placeholder="+880 1X…" value={client.phone} onChange={(e) => setClient({ ...client, phone: e.target.value })} aria-invalid={!phoneOk} maxLength={20} />
          {!phoneOk ? <p className="text-xs text-destructive">{t({ bn: "সঠিক বাংলাদেশি মোবাইল নম্বর দিন (+880 1X…)", en: "Enter a valid Bangladesh mobile (+880 1X…)" })}</p> : null}
        </div>
        <select className="h-9 rounded-md border bg-background px-2 text-sm" value={client.location} onChange={(e) => setClient({ ...client, location: e.target.value })} aria-label="Preferred area">
          <option value="">{t({ bn: "পছন্দের এলাকা", en: "Preferred area" })}</option>
          {DHAKA_LOCATIONS.map((l) => <option key={l.key} value={l.key}>{l[lang]}</option>)}
        </select>
        <Button type="button" variant="outline" disabled={!!err || !unit || !client.name.trim() || !phoneOk || !client.phone} onClick={() => window.print()}>
          <Printer className="size-4" /> {t({ bn: "বুকিং স্লিপ প্রিন্ট", en: "Print booking slip" })}
        </Button>
        {err && total > 0 ? <p className="text-xs text-destructive sm:col-span-4">{err}</p> : null}
        {!unit ? <p className="text-xs text-muted-foreground sm:col-span-4">{t({ bn: "স্লিপ প্রিন্ট করতে উপরে একটি ইউনিট বাছাই করুন।", en: "Pick a unit above to print a slip." })}</p> : null}
      </section>

      {rows.length ? (
        <article className="rounded-lg border bg-card p-4 text-sm print:border-0">
          <header className="mb-3 flex items-start justify-between border-b pb-2">
            <div>
              <div className="text-lg font-semibold">WINSTONE PULSE</div>
              <div className="text-xs text-muted-foreground">{t({ bn: "বুকিং সারাংশ স্লিপ", en: "Booking summary slip" })} · {today}</div>
            </div>
            <div className="text-right text-xs">{unit ? <><div className="font-medium">{unit.projectName}</div><div>{unit.code}{unit.floor ? ` · ${unit.floor}` : ""} · {formatArea(unit.sizeSqft, unit.sizeKatha, lang)}</div></> : null}</div>
          </header>
          {client.name ? <p className="mb-2">{t({ bn: "ক্রেতা", en: "Client" })}: <b>{client.name}</b> · {normalizeBdPhone(client.phone) ?? client.phone}{client.location ? ` · ${DHAKA_LOCATIONS.find((l) => l.key === client.location)?.[lang]}` : ""}</p> : null}
          <p className="mb-2">{t({ bn: "মোট চুক্তি মূল্য", en: "Total contract value" })}: <b>{formatTaka(total, lang)}</b></p>
          <table className="w-full text-xs">
            <tbody>
              {shown.slice(0, 1).map((r) => <Row key={r.label} r={r} lang={lang} />)}
              {inst.length ? <tr className="border-t"><td className="py-1">{t({ bn: `মাসিক কিস্তি × ${inst.length}`, en: `Monthly installment × ${inst.length}` })} ({inst[0].due} → {inst.at(-1)!.due})</td><td className="text-right">{formatTaka(inst[0].amountBdt, lang)} / {t({ bn: "মাস", en: "mo" })}</td></tr> : null}
              {shown.slice(1).map((r) => <Row key={r.label} r={r} lang={lang} />)}
            </tbody>
          </table>
          <footer className="mt-10 grid grid-cols-2 gap-8 text-xs">
            <div className="border-t pt-1">{t({ bn: "ক্রেতার স্বাক্ষর", en: "Client signature" })}</div>
            <div className="border-t pt-1">{t({ bn: "অনুমোদনকারী কর্মকর্তা", en: "Authorised officer" })}</div>
          </footer>
          <p className="mt-3 text-[10px] text-muted-foreground">{t({ bn: "এটি একটি সারাংশ; চূড়ান্ত চুক্তি HQ অনুমোদনের পর কার্যকর।", en: "Summary only; final agreement takes effect after HQ approval." })}</p>
        </article>
      ) : null}
    </div>
  );
}

function Row({ r, lang }: { r: ScheduleRow; lang: "bn" | "en" }) {
  return <tr className="border-t"><td className="py-1">{r.label}{r.due ? ` (${r.due})` : ""}</td><td className="text-right">{formatTaka(r.amountBdt, lang)}</td></tr>;
}
