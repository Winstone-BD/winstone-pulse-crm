/** Bangladesh real-estate formats: Taka in Lakh/Crore, sq ft ↔ Katha, +880 phones, Dhaka areas. */
export type Lang = "bn" | "en";

export const LAKH = 100_000;
export const CRORE = 10_000_000;
/** Standard Dhaka conversion: 1 Katha = 720 sq ft. */
export const SQFT_PER_KATHA = 720;

const BN_DIGITS = "০১২৩৪৫৬৭৮৯";
export const toBnDigits = (s: string) => s.replace(/\d/g, (d) => BN_DIGITS[Number(d)]);
export const fromBnDigits = (s: string) => s.replace(/[০-৯]/g, (d) => String(BN_DIGITS.indexOf(d)));

const trim = (n: number) => String(Math.round(n * 100) / 100);

/** ৳1.75 Cr / ৳85 L / ৳50,000 (English) or ৳১.৭৫ কোটি / ৳৮৫ লাখ (Bangla). */
export function formatTaka(amount: number, lang: Lang = "en"): string {
  if (!Number.isFinite(amount)) return "—";
  const sign = amount < 0 ? "-" : "";
  const a = Math.abs(amount);
  let out: string;
  if (a >= CRORE) out = `${trim(a / CRORE)} ${lang === "bn" ? "কোটি" : "Cr"}`;
  else if (a >= LAKH) out = `${trim(a / LAKH)} ${lang === "bn" ? "লাখ" : "L"}`;
  else out = formatIndianGrouping(Math.round(a));
  return `${sign}৳${lang === "bn" ? toBnDigits(out) : out}`;
}

/** 12,34,56,789 style grouping used in Bangladesh. */
export function formatIndianGrouping(n: number): string {
  const s = String(Math.trunc(Math.abs(n)));
  if (s.length <= 3) return s;
  const last3 = s.slice(-3);
  const rest = s.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ",");
  return `${rest},${last3}`;
}

export const sqftToKatha = (sqft: number) => Math.round((sqft / SQFT_PER_KATHA) * 100) / 100;
export const kathaToSqft = (katha: number) => Math.round(katha * SQFT_PER_KATHA);

export function formatArea(sqft: number | null, katha: number | null, lang: Lang = "en"): string {
  const parts: string[] = [];
  if (sqft) parts.push(`${formatIndianGrouping(sqft)} ${lang === "bn" ? "বর্গফুট" : "sq ft"}`);
  if (katha) parts.push(`${trim(katha)} ${lang === "bn" ? "কাঠা" : "Katha"}`);
  const s = parts.join(" · ") || "—";
  return lang === "bn" ? toBnDigits(s) : s;
}

/** Normalises BD mobile numbers to +8801XXXXXXXXX; returns null when invalid. Operators 013–019. */
export function normalizeBdPhone(raw: string): string | null {
  const digits = fromBnDigits(raw).replace(/[\s\-().]/g, "").replace(/^\+/, "");
  let local: string;
  if (/^8801\d{9}$/.test(digits)) local = digits.slice(2);
  else if (/^01\d{9}$/.test(digits)) local = digits;
  else if (/^1\d{9}$/.test(digits)) local = `0${digits}`;
  else return null;
  if (!/^01[3-9]\d{8}$/.test(local)) return null;
  return `+88${local}`;
}
export const isValidBdPhone = (raw: string) => normalizeBdPhone(raw) !== null;

export const DHAKA_LOCATIONS = [
  { key: "gulshan", en: "Gulshan", bn: "গুলশান" },
  { key: "banani", en: "Banani", bn: "বনানী" },
  { key: "dhanmondi", en: "Dhanmondi", bn: "ধানমন্ডি" },
  { key: "uttara", en: "Uttara", bn: "উত্তরা" },
  { key: "bashundhara", en: "Bashundhara", bn: "বসুন্ধরা" },
  { key: "purbachal", en: "Purbachal", bn: "পূর্বাচল" },
  { key: "mirpur", en: "Mirpur", bn: "মিরপুর" },
] as const;
export type DhakaLocationKey = (typeof DHAKA_LOCATIONS)[number]["key"];
