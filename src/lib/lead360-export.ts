/** Pure builder for HQ Lead 360 filtered exports (CSV + print-ready HTML). */
export type ExportRow = {
  id: string; name: string | null; phone: string; source: string | null; referenceBy: string | null;
  calls: number; connected: number; followUps: number; nextFollowUpAt: string | null; fuState: string;
  lastReportAt: string | null; lastReportNote: string | null;
};
export type ExportFilter = { label: string; value: string };

const COLS: Array<[keyof ExportRow, string]> = [
  ["id", "Lead ID"], ["name", "Name"], ["phone", "Phone"], ["source", "Source"], ["referenceBy", "Reference"],
  ["calls", "Calls"], ["connected", "Connected"], ["followUps", "Follow-ups"], ["nextFollowUpAt", "Next follow-up"], ["fuState", "Follow-up state"],
  ["lastReportAt", "Last report date"], ["lastReportNote", "Last report description"],
];

/** Neutralises spreadsheet formulas and quotes every cell. */
export function csvCell(v: unknown) {
  let t = v == null ? "" : String(v);
  if (/^[=+\-@\t\r]/.test(t)) t = `'${t}`;
  return `"${t.replace(/"/g, '""')}"`;
}
const esc = (v: unknown) => String(v ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

export function buildLead360Export(rows: ExportRow[], filters: ExportFilter[], now: Date) {
  const generatedAt = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Dhaka", dateStyle: "medium", timeStyle: "short" }).format(now) + " (Asia/Dhaka)";
  const filterText = filters.length ? filters.map((f) => `${f.label}: ${f.value}`).join("; ") : "None (all leads)";
  const csv = [
    csvCell("Winstone CRM — Lead 360 filtered export"),
    `${csvCell("Generated at")},${csvCell(generatedAt)}`,
    `${csvCell("Active filters")},${csvCell(filterText)}`,
    `${csvCell("Total rows")},${csvCell(rows.length)}`,
    "",
    COLS.map(([, h]) => csvCell(h)).join(","),
    ...rows.map((r) => COLS.map(([k]) => csvCell(r[k])).join(",")),
  ].join("\n");
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Lead 360 export</title>
<style>body{font-family:"Noto Sans Bengali",system-ui,sans-serif;margin:16px;font-size:11px}h1{font-size:16px;margin:0 0 4px}
p{margin:2px 0}table{border-collapse:collapse;width:100%;margin-top:10px}th,td{border:1px solid #ccc;padding:3px 5px;text-align:left}
th{background:#f3f3f3}@media print{@page{size:A4 landscape;margin:10mm}}</style></head><body>
<h1>Winstone CRM — Lead 360 filtered export</h1>
<p><b>Generated at:</b> ${esc(generatedAt)}</p><p><b>Active filters:</b> ${esc(filterText)}</p><p><b>Total rows:</b> ${rows.length}</p>
<table><thead><tr>${COLS.map(([, h]) => `<th>${esc(h)}</th>`).join("")}</tr></thead><tbody>
${rows.map((r) => `<tr>${COLS.map(([k]) => `<td>${esc(r[k])}</td>`).join("")}</tr>`).join("\n")}
</tbody></table><script>window.onload=()=>window.print()</script></body></html>`;
  return { csv, html, generatedAt, total: rows.length };
}
