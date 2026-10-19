/** Bangladesh apartment/plot payment plan: booking down payment, monthly installments, construction milestones, handover balance. */
export type ScheduleInput = {
  totalBdt: number;
  downPaymentPct: number; // e.g. 20
  installmentMonths: number; // e.g. 36
  installmentPct: number; // share paid as monthly installments
  milestones: { label: string; pct: number }[]; // construction-linked
  startDate: string; // YYYY-MM-DD
};
export type ScheduleRow = { kind: "down_payment" | "installment" | "milestone" | "handover"; label: string; amountBdt: number; due: string | null };

export const DEFAULT_MILESTONES = [
  { label: "Piling / পাইলিং", pct: 5 },
  { label: "Roof casting / ছাদ ঢালাই", pct: 10 },
  { label: "Finishing / ফিনিশিং", pct: 5 },
];

function addMonths(iso: string, m: number): string {
  const [y = 1970, mo = 1, d = 1] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, mo - 1 + m, 1));
  const last = new Date(Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth() + 1, 0)).getUTCDate();
  dt.setUTCDate(Math.min(d, last));
  return dt.toISOString().slice(0, 10);
}

export function validateSchedule(i: ScheduleInput): string | null {
  if (!(i.totalBdt > 0)) return "Total price must be above 0";
  if (i.installmentMonths < 0 || i.installmentMonths > 120 || !Number.isInteger(i.installmentMonths)) return "Installment months must be 0–120";
  const parts = [i.downPaymentPct, i.installmentPct, ...i.milestones.map((m) => m.pct)];
  if (parts.some((p) => p < 0 || p > 100)) return "Percentages must be 0–100";
  if (parts.reduce((a, b) => a + b, 0) > 100) return "Percentages exceed 100%";
  if (i.installmentPct > 0 && i.installmentMonths === 0) return "Installment months required";
  return null;
}

/** Rounds to whole taka; the handover row absorbs rounding so rows always sum to the total. */
export function buildSchedule(i: ScheduleInput): ScheduleRow[] {
  const err = validateSchedule(i);
  if (err) throw new Error(err);
  const rows: ScheduleRow[] = [];
  const pct = (p: number) => Math.round((i.totalBdt * p) / 100);
  if (i.downPaymentPct > 0) rows.push({ kind: "down_payment", label: "Down payment / ডাউন পেমেন্ট", amountBdt: pct(i.downPaymentPct), due: i.startDate });
  if (i.installmentPct > 0) {
    const pool = pct(i.installmentPct);
    const each = Math.floor(pool / i.installmentMonths);
    for (let k = 1; k <= i.installmentMonths; k++) {
      rows.push({ kind: "installment", label: `Installment ${k} / কিস্তি ${k}`, amountBdt: k === i.installmentMonths ? pool - each * (k - 1) : each, due: addMonths(i.startDate, k) });
    }
  }
  for (const m of i.milestones) if (m.pct > 0) rows.push({ kind: "milestone", label: m.label, amountBdt: pct(m.pct), due: null });
  const paid = rows.reduce((a, r) => a + r.amountBdt, 0);
  rows.push({ kind: "handover", label: "Handover balance / হস্তান্তর ব্যালেন্স", amountBdt: Math.round(i.totalBdt) - paid, due: null });
  return rows;
}
