// Project matching + Taka math, adapted from AgentForge's deterministic engine.
// The app does all arithmetic; AI never computes or invents figures.

export const VERIFY = "তথ্য যাচাই প্রয়োজন";

/** Parses "85 lakh", "1.2 crore", "৳ 45,00,000", "8500000" into whole taka. */
export function parseBDT(input: string | null | undefined): number | null {
  if (!input) return null;
  const s = input.toLowerCase().replace(/[৳,\s]/g, "").replace(/tk\.?|taka|টাকা/g, "")
    .replace(/[০-৯]/g, (d) => String("০১২৩৪৫৬৭৮৯".indexOf(d)));
  const m = s.match(/^([\d.]+)(lakh|lac|লাখ|crore|cr|কোটি)?$/);
  if (!m) return null;
  const n = Number(m[1]);
  if (!Number.isFinite(n) || n <= 0) return null;
  const mult = m[2] ? (/^(crore|cr|কোটি)$/.test(m[2]) ? 1e7 : 1e5) : 1;
  return Math.round(n * mult);
}

export type CatalogRow = {
  id: string; name: string; location: string | null; status: string;
  total_price: string | null; down_payment: string | null; installment_plan: string | null;
};
export type BuyerNeed = { maxBudget: number | null; area: string; units: number; months: number };
export type Match = {
  id: string; name: string; location: string; areaOk: boolean; budgetOk: boolean | null;
  unitPrice: number | null; total: number | null; downPayment: number | null;
  balance: number | null; months: number; monthly: number | null; warnings: string[]; rank: number;
};

function downPaymentOf(raw: string | null, total: number | null): number | null {
  if (!raw) return null;
  const pct = raw.match(/([\d.]+)\s*%/);
  if (pct) return total === null ? null : Math.round((total * Number(pct[1])) / 100);
  return parseBDT(raw);
}
function maxMonths(plan: string | null): number | null {
  const m = plan?.match(/(\d+)\s*(month|months|mo|মাস)/i);
  return m ? Number(m[1]) : null;
}

export function evaluate(need: BuyerNeed, p: CatalogRow): Match {
  const units = Math.max(1, Math.floor(need.units || 1));
  const unitPrice = parseBDT(p.total_price);
  const total = unitPrice === null ? null : unitPrice * units;
  const downPayment = downPaymentOf(p.down_payment, total);
  const balance = total === null ? null : Math.max(0, total - (downPayment ?? 0));
  const cap = maxMonths(p.installment_plan);
  const months = need.months > 0 && cap ? Math.min(Math.floor(need.months), cap) : 0;
  const monthly = balance !== null && months > 0 ? Math.round(balance / months) : null;
  const warnings: string[] = [];
  if (unitPrice === null) warnings.push(`দাম: ${VERIFY}`);
  if (!p.down_payment || (downPayment === null && unitPrice !== null)) warnings.push(`ডাউন পেমেন্ট: ${VERIFY}`);
  if (need.maxBudget === null) warnings.push(`গ্রাহকের বাজেট: ${VERIFY}`);
  if (need.months > 0 && !cap) warnings.push(`কিস্তির মেয়াদ: ${VERIFY}`);
  else if (cap && need.months > cap) warnings.push(`সর্বোচ্চ ${cap} মাস কিস্তি`);
  const norm = (s: string) => s.toLowerCase().trim();
  const loc = p.location ?? "";
  const areaOk = !need.area.trim() || (loc !== "" && (norm(loc).includes(norm(need.area)) || norm(need.area).includes(norm(loc))));
  const budgetOk = total === null || need.maxBudget === null ? null : total <= need.maxBudget;
  const rank = (areaOk ? 2 : 0) + (budgetOk === true ? 3 : budgetOk === null ? 1 : 0);
  return { id: p.id, name: p.name, location: loc, areaOk, budgetOk, unitPrice, total, downPayment, balance, months, monthly, warnings, rank };
}

export function matchProjects(need: BuyerNeed, rows: CatalogRow[]): Match[] {
  return rows.map((p) => evaluate(need, p)).sort((a, b) => b.rank - a.rank || a.name.localeCompare(b.name));
}

export const taka = (n: number | null) => (n === null ? VERIFY : `৳${n.toLocaleString("en-IN")}`);
