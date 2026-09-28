/**
 * Compact pre-call brief (one line + one opener). Pure and deterministic — the
 * fallback when AI is unavailable, and the only facts the AI may rephrase.
 * Fields that are missing are simply left out; nothing is invented.
 */

export type BriefFacts = {
  name: string;
  referenceBy: string | null;
  source: string | null;
  temperature: string | null;
  grade: string | null;
  attempts: number;
  lastCallAt: string | null;
  requirement: string | null;
  interest: string | null;
  customerResponse: string | null;
  lastNextAction: string | null;
  lastCategory: string | null;
  lastSummary: string | null;
  followUpAt: string | null;
  followUpOverdue: boolean;
  inventoryMatch: string | null;
};

export type QuickBrief = { line: string; opener: string; source: "ai" | "rules" };

const TEMP: Record<string, string> = { hot: "HOT", warm: "WARM", cold: "COLD" };
const INTEREST: Record<string, string> = { high: "আগ্রহ বেশি", medium: "মাঝারি আগ্রহ", low: "আগ্রহ কম", fake: "ভুয়া সন্দেহ" };

function dhakaShort(iso: string): string {
  return new Intl.DateTimeFormat("bn-BD", { day: "numeric", month: "short", timeZone: "Asia/Dhaka" }).format(new Date(iso));
}

export function ruleBrief(f: BriefFacts): QuickBrief {
  const who: string[] = [];
  if (f.requirement) who.push(f.requirement);
  if (f.temperature && TEMP[f.temperature]) who.push(`${TEMP[f.temperature]}${f.grade ? `/${f.grade}` : ""}`);
  if (f.interest && INTEREST[f.interest]) who.push(INTEREST[f.interest]!);
  if (f.referenceBy) who.push(`রেফারেন্স: ${f.referenceBy}`);

  const context: string[] = [];
  if (f.attempts === 0 && !f.lastCallAt) context.push("প্রথম কল");
  else if (f.lastCallAt) context.push(`শেষ কল ${dhakaShort(f.lastCallAt)}${f.customerResponse ? ` (${f.customerResponse})` : ""}`);
  if (f.followUpAt) context.push(`${f.followUpOverdue ? "মেয়াদোত্তীর্ণ ফলো-আপ" : "ফলো-আপ"} ${dhakaShort(f.followUpAt)}`);

  const next =
    f.lastNextAction
      ? `আজ: ${f.lastNextAction}`
      : f.attempts === 0 && !f.lastCallAt
        ? "আজ: প্রয়োজন ও বাজেট জেনে নিন"
        : f.followUpOverdue
          ? "আজ: দেরির জন্য দুঃখপ্রকাশ করে আগের আলোচনা এগিয়ে নিন"
          : "আজ: আগ্রহ নিশ্চিত করে পরের ধাপ ঠিক করুন";

  const line = [who.join(", "), context.join("; "), next].filter(Boolean).join(" · ");
  const opener = f.lastCallAt
    ? `আসসালামু আলাইকুম${f.name ? `, ${f.name}` : ""}। Winstone Properties থেকে বলছি — আগের আলোচনার সূত্রে ফোন করলাম, এক মিনিট কথা বলা যাবে?`
    : `আসসালামু আলাইকুম${f.name ? `, ${f.name}` : ""}। Winstone Properties থেকে বলছি${f.referenceBy ? ` — ${f.referenceBy}-এর মাধ্যমে আপনার কথা জেনেছি` : ""}। দুই মিনিট সময় হবে?`;
  return { line, opener, source: "rules" };
}

/** Keep AI output one short line; reject anything empty or rambling. */
export function clampBrief(text: unknown, max = 220): string | null {
  if (typeof text !== "string") return null;
  const one = text.replace(/\s+/g, " ").trim();
  if (one.length < 8) return null;
  return one.length > max ? `${one.slice(0, max - 1)}…` : one;
}
