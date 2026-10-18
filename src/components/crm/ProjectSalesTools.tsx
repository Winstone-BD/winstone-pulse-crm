import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Download, FileSpreadsheet, Filter, Upload } from "lucide-react";

import { EmptyState, ErrorState, LoadingState } from "@/components/crm/DataState";
import { Button } from "@/components/ui/button";
import { useAdminToken } from "@/lib/local-session";
import { useT } from "@/lib/i18n";
import { MAX_IMPORT_ROWS, parseCsv, parsePrice, sheetToRows, type ImportRow } from "@/lib/project-import";
import { importProjects, INTERESTS, salesUpdatesReport } from "@/lib/projects.functions";

const INTEREST: Record<string, { bn: string; en: string; cls: string }> = {
  interested: { bn: "আগ্রহী", en: "Interested", cls: "border-success/40 bg-success/10 text-success" },
  negotiating: { bn: "দরকষাকষি", en: "Negotiating", cls: "border-warning/40 bg-warning/10 text-foreground" },
  not_now: { bn: "এখন না", en: "Not now", cls: "border-destructive/30 bg-destructive/10 text-destructive" },
};
const money = (n: number) => `৳${n.toLocaleString("en-IN")}`;
const when = (iso: string) => new Date(iso).toLocaleString("bn-BD", { timeZone: "Asia/Dhaka", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
const sel = "h-9 rounded-md border border-input bg-background px-2 text-sm";

/* ---------------- Report ---------------- */

export function ProjectSalesReport() {
  const t = useT();
  const adminToken = useAdminToken();
  const fn = useServerFn(salesUpdatesReport);
  const [f, setF] = useState({ from: "", to: "", projectId: "", agentId: "", interest: "" });
  const q = useQuery({
    queryKey: ["project-sales-report", adminToken ? "pin" : "s", f],
    queryFn: () => fn({ data: {
      adminToken, from: f.from || null, to: f.to || null, projectId: f.projectId || null,
      agentId: f.agentId || null, interest: (f.interest || null) as (typeof INTERESTS)[number] | null,
    } }),
  });
  const rows = q.data?.rows ?? [];
  const summary = useMemo(() => {
    const priced = rows.filter((r) => r.offered_price != null).map((r) => Number(r.offered_price));
    return {
      total: rows.length,
      byInterest: Object.fromEntries(INTERESTS.map((i) => [i, rows.filter((r) => r.interest === i).length])),
      avg: priced.length ? Math.round(priced.reduce((a, b) => a + b, 0) / priced.length) : null,
    };
  }, [rows]);

  const csv = () => {
    const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const lines = [["date", "project", "agent", "lead", "interest", "quoted_price", "note"].join(",")]
      .concat(rows.map((r) => [r.created_at, r.project_name, r.agent_name, r.lead_name, r.interest, r.offered_price ?? "", r.note ?? ""].map(esc).join(",")));
    const url = URL.createObjectURL(new Blob(["\uFEFF" + lines.join("\n")], { type: "text/csv" }));
    const a = document.createElement("a"); a.href = url; a.download = "project-sales-updates.csv"; a.click(); URL.revokeObjectURL(url);
  };

  return (
    <section className="space-y-3 rounded-2xl border border-border bg-card p-4" aria-labelledby="psr-h">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="psr-h" className="flex items-center gap-2 text-base font-bold"><Filter className="size-4 text-primary" aria-hidden />
          {t({ bn: "প্রজেক্ট বিক্রির আপডেট রিপোর্ট", en: "Project sales update report" })}</h2>
        <Button size="sm" variant="outline" onClick={csv} disabled={!rows.length}><Download className="size-4" aria-hidden />CSV</Button>
      </div>
      <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-5">
        <label className="text-xs">{t({ bn: "শুরু", en: "From" })}<input type="date" className={`${sel} w-full`} value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} /></label>
        <label className="text-xs">{t({ bn: "শেষ", en: "To" })}<input type="date" className={`${sel} w-full`} value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} /></label>
        <label className="text-xs">{t({ bn: "প্রজেক্ট", en: "Project" })}
          <select className={`${sel} w-full`} value={f.projectId} onChange={(e) => setF({ ...f, projectId: e.target.value })}>
            <option value="">{t({ bn: "সব", en: "All" })}</option>
            {(q.data?.projects ?? []).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select></label>
        {q.data?.scope === "authority" ? (
          <label className="text-xs">{t({ bn: "এজেন্ট", en: "Agent" })}
            <select className={`${sel} w-full`} value={f.agentId} onChange={(e) => setF({ ...f, agentId: e.target.value })}>
              <option value="">{t({ bn: "সব", en: "All" })}</option>
              {q.data.agents.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select></label>
        ) : null}
        <label className="text-xs">{t({ bn: "ক্লায়েন্টের আগ্রহ", en: "Client interest" })}
          <select className={`${sel} w-full`} value={f.interest} onChange={(e) => setF({ ...f, interest: e.target.value })}>
            <option value="">{t({ bn: "সব", en: "All" })}</option>
            {INTERESTS.map((i) => <option key={i} value={i}>{t(INTEREST[i]!)}</option>)}
          </select></label>
      </div>

      {q.isLoading ? <LoadingState /> : null}
      {q.isError ? <ErrorState onRetry={() => void q.refetch()} message={(q.error as Error).message} /> : null}
      {q.data && !rows.length ? <EmptyState>{t({ bn: "এই ফিল্টারে কোনো বিক্রির আপডেট নেই।", en: "No sales updates for these filters." })}</EmptyState> : null}

      {rows.length ? (
        <>
          <dl className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            <Kpi l={t({ bn: "মোট আপডেট", en: "Updates" })} v={String(summary.total)} />
            {INTERESTS.map((i) => <Kpi key={i} l={t(INTEREST[i]!)} v={String(summary.byInterest[i] ?? 0)} />)}
            <Kpi l={t({ bn: "গড় বলা মূল্য", en: "Avg quoted" })} v={summary.avg == null ? "—" : money(summary.avg)} />
          </dl>
          <ul className="space-y-2 md:hidden">
            {rows.map((r) => (
              <li key={r.id} className="rounded-xl border border-border p-3 text-sm">
                <div className="flex items-start justify-between gap-2"><span className="font-semibold">{r.project_name}</span><Interest i={r.interest} /></div>
                <p className="text-xs text-muted-foreground">{r.lead_name} · {r.agent_name} · <time dateTime={r.created_at}>{when(r.created_at)}</time></p>
                {r.offered_price != null ? <p className="tabular text-xs font-medium">{money(Number(r.offered_price))}</p> : null}
                {r.note ? <p className="mt-1 text-xs">{r.note}</p> : null}
              </li>
            ))}
          </ul>
          <div className="table-scroll hidden md:block">
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-muted-foreground"><tr>
                {[t({ bn: "সময়", en: "When" }), t({ bn: "প্রজেক্ট", en: "Project" }), t({ bn: "এজেন্ট", en: "Agent" }), t({ bn: "লিড", en: "Lead" }), t({ bn: "আগ্রহ", en: "Interest" }), t({ bn: "বলা মূল্য", en: "Quoted" }), t({ bn: "নোট", en: "Note" })].map((h) => <th key={h} scope="col" className="px-2 py-2 font-medium">{h}</th>)}
              </tr></thead>
              <tbody>{rows.map((r) => (
                <tr key={r.id} className="border-t border-border align-top">
                  <td className="tabular whitespace-nowrap px-2 py-2 text-xs"><time dateTime={r.created_at}>{when(r.created_at)}</time></td>
                  <td className="px-2 py-2 font-medium">{r.project_name}</td>
                  <td className="px-2 py-2">{r.agent_name}</td>
                  <td className="px-2 py-2">{r.lead_name}</td>
                  <td className="px-2 py-2"><Interest i={r.interest} /></td>
                  <td className="tabular px-2 py-2">{r.offered_price != null ? money(Number(r.offered_price)) : "—"}</td>
                  <td className="max-w-[260px] px-2 py-2 text-xs">{r.note ?? "—"}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
          {rows.length >= 1000 ? <p className="text-xs text-muted-foreground">{t({ bn: "সর্বশেষ ১০০০টি দেখানো হচ্ছে — তারিখ দিয়ে সীমিত করুন।", en: "Showing latest 1000 — narrow by date." })}</p> : null}
        </>
      ) : null}
    </section>
  );
}

function Kpi({ l, v }: { l: string; v: string }) {
  return <div className="rounded-xl border border-border p-2"><dt className="text-xs text-muted-foreground">{l}</dt><dd className="tabular text-lg font-semibold">{v}</dd></div>;
}
function Interest({ i }: { i: string }) {
  const t = useT();
  const s = INTEREST[i];
  return <span className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold ${s?.cls ?? "border-border"}`}>{s ? t(s) : i}</span>;
}

/* ---------------- Import (HQ/IT) ---------------- */

export function ProjectImportPanel() {
  const t = useT();
  const adminToken = useAdminToken();
  const qc = useQueryClient();
  const fn = useServerFn(importProjects);
  const input = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<{ rows: ImportRow[]; unknown: string[]; problems: string[] } | null>(null);

  const read = async (file: File) => {
    try {
      let sheet: unknown[][];
      if (/\.xlsx$/i.test(file.name)) {
        const { default: readXlsx } = await import("read-excel-file");
        sheet = (await readXlsx(file)) as unknown[][];
      } else if (/\.csv$/i.test(file.name)) {
        sheet = parseCsv(await file.text());
      } else throw new Error(t({ bn: "শুধু .csv বা .xlsx ফাইল", en: "Only .csv or .xlsx files" }));
      const { rows, unknownHeaders, missingName } = sheetToRows(sheet);
      const problems: string[] = [];
      if (missingName) problems.push(t({ bn: "‘name’ / ‘নাম’ কলাম নেই", en: "Missing ‘name’ column" }));
      if (rows.length > MAX_IMPORT_ROWS) problems.push(t({ bn: `একবারে সর্বোচ্চ ${MAX_IMPORT_ROWS}টি সারি`, en: `Max ${MAX_IMPORT_ROWS} rows per import` }));
      rows.forEach((r, i) => { if (parsePrice(r.price_per_sqft) === "invalid") problems.push(`${t({ bn: "সারি", en: "Row" })} ${i + 2}: price_per_sqft`); });
      setPreview({ rows, unknown: unknownHeaders, problems });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "ফাইল পড়া যায়নি");
    }
  };

  const m = useMutation({
    mutationFn: () => fn({ data: { adminToken, rows: preview!.rows.map((r) => ({
      ...r, status: r.status?.toLowerCase() === "archived" ? "archived" : "active", price_per_sqft: parsePrice(r.price_per_sqft) as number | null,
    })) } }),
    onSuccess: (res) => {
      const c = (o: string) => res.results.filter((r) => r.outcome === o).length;
      toast.success(t({ bn: `নতুন ${c("created")}, হালনাগাদ ${c("updated")}, ত্রুটি ${c("error")}`, en: `Created ${c("created")}, updated ${c("updated")}, errors ${c("error")}` }));
      qc.invalidateQueries({ queryKey: ["project-catalog"] });
      setPreview({ ...preview!, problems: res.results.filter((r) => r.outcome === "error").map((r) => `${t({ bn: "সারি", en: "Row" })} ${r.row} (${r.name || "—"}): ${r.error}`) });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "ইমপোর্ট ব্যর্থ"),
  });

  const blocked = !preview || !preview.rows.length || preview.problems.length > 0 && !m.isSuccess;
  return (
    <section className="space-y-3 rounded-2xl border border-border bg-card p-4" aria-labelledby="pi-h">
      <h2 id="pi-h" className="flex items-center gap-2 text-base font-bold"><FileSpreadsheet className="size-4 text-primary" aria-hidden />
        {t({ bn: "CSV/Excel থেকে প্রজেক্ট ইমপোর্ট", en: "Import projects from CSV/Excel" })}</h2>
      <p className="text-xs text-muted-foreground">
        {t({ bn: "প্রথম সারিতে কলামের নাম: name, location, status, price_per_sqft, unit_sizes, total_price, down_payment, installment_plan, parking_charge, extra_charges, notes (বাংলা নামও চলবে)। একই নামের প্রজেক্ট থাকলে হালনাগাদ হবে, কিছু মুছবে না।",
             en: "First row = headers: name, location, status, price_per_sqft, unit_sizes, total_price, down_payment, installment_plan, parking_charge, extra_charges, notes. Same-name projects are updated; nothing is deleted." })}
      </p>
      <input ref={input} type="file" accept=".csv,.xlsx" className="sr-only" aria-label="file" onChange={(e) => { const f = e.target.files?.[0]; if (f) void read(f); e.target.value = ""; }} />
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" onClick={() => input.current?.click()}><Upload className="size-4" aria-hidden />{t({ bn: "ফাইল বাছুন", en: "Choose file" })}</Button>
        {preview ? <Button size="sm" disabled={blocked || m.isPending} onClick={() => m.mutate()}>{t({ bn: `${preview.rows.length}টি সারি ইমপোর্ট`, en: `Import ${preview.rows.length} rows` })}</Button> : null}
      </div>
      {preview?.unknown.length ? <p className="text-xs text-muted-foreground">{t({ bn: "উপেক্ষিত কলাম:", en: "Ignored columns:" })} {preview.unknown.join(", ")}</p> : null}
      {preview?.problems.length ? (
        <ul role="alert" className="space-y-0.5 rounded-lg border border-destructive/30 bg-destructive/5 p-2 text-xs text-destructive">
          {preview.problems.slice(0, 20).map((p) => <li key={p}>{p}</li>)}
        </ul>
      ) : null}
      {preview?.rows.length ? (
        <div className="table-scroll max-h-64">
          <table className="w-full text-xs">
            <thead className="text-left text-muted-foreground"><tr>{["name", "location", "price_per_sqft", "total_price", "status"].map((h) => <th key={h} scope="col" className="px-2 py-1">{h}</th>)}</tr></thead>
            <tbody>{preview.rows.slice(0, 50).map((r, i) => (
              <tr key={i} className="border-t border-border">{(["name", "location", "price_per_sqft", "total_price", "status"] as const).map((k) => <td key={k} className="px-2 py-1">{r[k] ?? "—"}</td>)}</tr>
            ))}</tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}
