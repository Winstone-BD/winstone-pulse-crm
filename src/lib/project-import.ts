/**
 * Pure, browser-safe helpers for bulk-importing the HQ project catalog from
 * CSV/Excel. Only maps columns; the server re-validates every row.
 */
export const IMPORT_FIELDS = [
  "name", "location", "status", "price_per_sqft", "unit_sizes", "total_price",
  "down_payment", "installment_plan", "parking_charge", "extra_charges", "notes",
] as const;
export type ImportField = (typeof IMPORT_FIELDS)[number];
export type ImportRow = Partial<Record<ImportField, string>>;
export const MAX_IMPORT_ROWS = 300;

/** Header aliases (English + Bengali), compared case/space-insensitively. */
const ALIASES: Record<ImportField, string[]> = {
  name: ["name", "project", "project name", "নাম", "প্রজেক্ট", "প্রজেক্টের নাম"],
  location: ["location", "area", "address", "লোকেশন", "এলাকা", "ঠিকানা"],
  status: ["status", "অবস্থা", "স্ট্যাটাস"],
  price_per_sqft: ["price_per_sqft", "price per sqft", "per sqft", "sqft price", "প্রতি বর্গফুট", "বর্গফুট মূল্য"],
  unit_sizes: ["unit_sizes", "unit sizes", "sizes", "ইউনিট সাইজ", "সাইজ"],
  total_price: ["total_price", "total price", "price", "মোট মূল্য", "মূল্য"],
  down_payment: ["down_payment", "down payment", "ডাউন পেমেন্ট"],
  installment_plan: ["installment_plan", "installment plan", "installments", "কিস্তি"],
  parking_charge: ["parking_charge", "parking", "পার্কিং"],
  extra_charges: ["extra_charges", "extra charges", "অতিরিক্ত চার্জ"],
  notes: ["notes", "note", "other", "অন্যান্য", "নোট"],
};
const key = (s: string) => s.toLowerCase().replace(/[\s_\-]+/g, " ").trim();

export function mapHeader(h: string): ImportField | null {
  const k = key(h);
  for (const f of IMPORT_FIELDS) if (ALIASES[f].some((a) => key(a) === k)) return f;
  return null;
}

/** RFC-4180-ish CSV parser (quotes, escaped quotes, CRLF, BOM). */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], cell = "", q = false;
  const s = text.replace(/^\uFEFF/, "");
  for (let i = 0; i < s.length; i++) {
    const ch = s[i]!;
    if (q) {
      if (ch === '"' && s[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') q = false;
      else cell += ch;
    } else if (ch === '"') q = true;
    else if (ch === ",") { row.push(cell); cell = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && s[i + 1] === "\n") i++;
      row.push(cell); rows.push(row); row = []; cell = "";
    } else cell += ch;
  }
  if (cell !== "" || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

/** Turn a sheet (first row = headers) into import rows. Unknown columns are reported, not guessed. */
export function sheetToRows(sheet: unknown[][]): { rows: ImportRow[]; unknownHeaders: string[]; missingName: boolean } {
  const [head = [], ...body] = sheet;
  const cols = head.map((h) => mapHeader(String(h ?? "")));
  const unknownHeaders = head.map(String).filter((h, i) => h.trim() && !cols[i]);
  const rows = body
    .map((r) => {
      const o: ImportRow = {};
      cols.forEach((f, i) => {
        const v = r[i];
        if (f && v != null && String(v).trim() !== "") o[f] = String(v).trim();
      });
      return o;
    })
    .filter((o) => Object.keys(o).length > 0);
  return { rows, unknownHeaders, missingName: !cols.includes("name") };
}

/** "৳1,25,000" / "1250000" → number; anything else → null (never guessed). */
export function parsePrice(v: string | undefined): number | null | "invalid" {
  if (v == null || v.trim() === "") return null;
  const bn = "০১২৩৪৫৬৭৮৯";
  const d = v.replace(/[০-৯]/g, (c) => String(bn.indexOf(c))).replace(/[৳,\s]|tk|taka/gi, "");
  if (!/^\d+(\.\d+)?$/.test(d)) return "invalid";
  return Number(d);
}
