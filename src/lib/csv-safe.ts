/**
 * CSV cell that spreadsheets cannot execute: text starting with = + - @ (or a
 * tab / carriage return) gets a leading apostrophe so Excel/Sheets show it as text.
 */
export function safeCsvCell(v: unknown): string {
  let s = v == null ? "" : String(v);
  if (typeof v === "string" && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
