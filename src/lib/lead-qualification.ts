/**
 * WhatsApp lead qualification — deterministic, no AI credit, works on Bangla, English and Banglish.
 * Extracts budget (Lakh/Crore), location, bed/bath, timeline; scores like the reference
 * real-estate-ai-lead-agent (engagement → probability → hot/warm/cold). Only facts found in the
 * customer's own words are returned; nothing is invented.
 */
import { CRORE, DHAKA_LOCATIONS, LAKH, fromBnDigits, formatTaka, type DhakaLocationKey, type Lang } from "./bd-format";

export type Timeline = "immediate" | "within_3_months" | "within_6_months" | "later";
export type Qualification = {
  budgetBdt: number | null;
  location: DhakaLocationKey | null;
  bedrooms: number | null;
  bathrooms: number | null;
  timeline: Timeline | null;
  wantsVisit: boolean;
};
export type QualificationScore = {
  engagement: number; probability: number; temperature: "hot" | "warm" | "cold";
  urgency: "high" | "medium" | "low"; priority: boolean; missing: (keyof Qualification)[];
};

const LOCATION_ALIASES: Record<DhakaLocationKey, string[]> = {
  gulshan: ["gulshan", "গুলশান"], banani: ["banani", "বনানী"], dhanmondi: ["dhanmondi", "dhanmandi", "ধানমন্ডি"],
  uttara: ["uttara", "উত্তরা"], bashundhara: ["bashundhara", "basundhara", "বসুন্ধরা"],
  purbachal: ["purbachal", "পূর্বাচল"], mirpur: ["mirpur", "মিরপুর"],
};

const num = (s: string | undefined) => Number((s ?? "0").replace(/,/g, ""));


export function extractQualification(text: string): Qualification {
  const t = fromBnDigits(text).toLowerCase();
  // Budget: "1.5 crore", "৮০ লাখ", "80 lakh", "80L", "1.2cr", "koti"
  let budgetBdt: number | null = null;
  const cr = t.match(/(\d+(?:\.\d+)?)\s*(?:crore|cr\b|koti|কোটি)/);
  const lk = t.match(/(\d+(?:\.\d+)?)\s*(?:lakh|lac|lakhs|l\b|লাখ|লক্ষ)/);
  if (cr) budgetBdt = num(cr[1]) * CRORE;
  else if (lk) budgetBdt = num(lk[1]) * LAKH;

  let location: DhakaLocationKey | null = null;
  for (const l of DHAKA_LOCATIONS) if (LOCATION_ALIASES[l.key].some((a) => t.includes(a))) { location = l.key; break; }

  const bed = t.match(/(\d+)\s*(?:bed|bedroom|br\b|bhk|beds|বেড|রুম)/);
  const bath = t.match(/(\d+)\s*(?:bath|bathroom|washroom|toilet|বাথ|বাথরুম|টয়লেট)/);

  let timeline: Timeline | null = null;
  if (/(immediate|urgent|asap|ekhoni|ekhuni|এখনই|এখনি|this month|ei mash|এই মাসে|ready)/.test(t)) timeline = "immediate";
  else if (/((?:1|2|3|one|two|three)\s*(?:month|mash|মাস))|(\b3 months?\b)/.test(t)) timeline = "within_3_months";
  else if (/((?:4|5|6|six)\s*(?:month|mash|মাস))|(\bsix months?\b)/.test(t)) timeline = "within_6_months";
  else if (/(next year|1 year|ek bochor|বছর|later|pore|পরে)/.test(t)) timeline = "later";

  const wantsVisit = /(site visit|visit|dekhte|দেখতে|ভিজিট|সাইট)/.test(t);
  return {
    budgetBdt, location,
    bedrooms: bed ? Math.min(20, num(bed[1])) : null,
    bathrooms: bath ? Math.min(20, num(bath[1])) : null,
    timeline, wantsVisit,
  };
}

/** Merge many customer messages; later messages override earlier facts. */
export function qualifyConversation(messages: string[]): Qualification {
  const out: Qualification = { budgetBdt: null, location: null, bedrooms: null, bathrooms: null, timeline: null, wantsVisit: false };
  for (const m of messages) {
    const q = extractQualification(m);
    out.budgetBdt = q.budgetBdt ?? out.budgetBdt;
    out.location = q.location ?? out.location;
    out.bedrooms = q.bedrooms ?? out.bedrooms;
    out.bathrooms = q.bathrooms ?? out.bathrooms;
    out.timeline = q.timeline ?? out.timeline;
    out.wantsVisit ||= q.wantsVisit;
  }
  return out;
}

const CORE: (keyof Qualification)[] = ["budgetBdt", "location", "bedrooms", "bathrooms", "timeline"];
const TIMELINE_WEIGHT: Record<Timeline, number> = { immediate: 60, within_3_months: 45, within_6_months: 30, later: 10 };

export function scoreQualification(q: Qualification): QualificationScore {
  const missing = CORE.filter((k) => q[k] == null);
  const filled = CORE.length - missing.length;
  const engagement = Math.min(100, filled * 18 + (q.wantsVisit ? 10 : 0));
  const timeWeight = q.timeline ? TIMELINE_WEIGHT[q.timeline] : 10;
  const probability = Math.min(98, Math.round(engagement * 0.5 + timeWeight * 0.5 + (q.wantsVisit ? 10 : 0)));
  const temperature = probability >= 70 ? "hot" : probability >= 45 ? "warm" : "cold";
  const urgency = q.wantsVisit || q.timeline === "immediate" ? "high" : q.budgetBdt && q.location ? "medium" : "low";
  return { engagement, probability, temperature, urgency, priority: temperature === "hot", missing };
}

const QUESTIONS: Record<keyof Qualification, { bn: string; en: string }> = {
  budgetBdt: { bn: "আপনার বাজেট কত লাখ বা কোটি টাকা?", en: "What is your budget in Lakh or Crore taka?" },
  location: { bn: "কোন এলাকায় চাইছেন? (গুলশান, বনানী, ধানমন্ডি, উত্তরা, বসুন্ধরা, পূর্বাচল, মিরপুর)", en: "Which area do you prefer? (Gulshan, Banani, Dhanmondi, Uttara, Bashundhara, Purbachal, Mirpur)" },
  bedrooms: { bn: "কয়টি বেডরুম দরকার?", en: "How many bedrooms do you need?" },
  bathrooms: { bn: "কয়টি বাথরুম দরকার?", en: "How many bathrooms do you need?" },
  timeline: { bn: "কবে নাগাদ কিনতে চান?", en: "When are you planning to buy?" },
  wantsVisit: { bn: "সাইট ভিজিট করতে চান?", en: "Would you like a site visit?" },
};

/** Next questions for the agent to ask (agent copies/sends them; never auto-sent). */
export function nextQuestions(q: Qualification, lang: Lang): string[] {
  return scoreQualification(q).missing.map((k) => QUESTIONS[k][lang]);
}

const TIMELINE_LABEL: Record<Timeline, { bn: string; en: string }> = {
  immediate: { bn: "এখনই", en: "Immediate" }, within_3_months: { bn: "৩ মাসের মধ্যে", en: "Within 3 months" },
  within_6_months: { bn: "৬ মাসের মধ্যে", en: "Within 6 months" }, later: { bn: "পরে", en: "Later" },
};

/** Short executive summary for agents, built only from extracted facts. */
export function executiveSummary(q: Qualification, lang: Lang): string[] {
  const s = scoreQualification(q);
  const loc = q.location ? DHAKA_LOCATIONS.find((l) => l.key === q.location)![lang] : null;
  const L = (bn: string, en: string) => (lang === "bn" ? bn : en);
  const lines = [
    L(`তাপমাত্রা: ${s.temperature.toUpperCase()} · সম্ভাবনা ${s.probability}%`, `Temperature: ${s.temperature.toUpperCase()} · ${s.probability}% likely`),
  ];
  const facts = [
    q.budgetBdt ? L(`বাজেট ${formatTaka(q.budgetBdt, "bn")}`, `Budget ${formatTaka(q.budgetBdt, "en")}`) : null,
    loc ? L(`এলাকা ${loc}`, `Area ${loc}`) : null,
    q.bedrooms != null ? L(`${q.bedrooms} বেড`, `${q.bedrooms} bed`) : null,
    q.bathrooms != null ? L(`${q.bathrooms} বাথ`, `${q.bathrooms} bath`) : null,
    q.timeline ? TIMELINE_LABEL[q.timeline][lang] : null,
  ].filter(Boolean);
  lines.push(facts.length ? facts.join(" · ") : L("এখনো কোনো তথ্য পাওয়া যায়নি", "No details captured yet"));
  if (q.wantsVisit) lines.push(L("গ্রাহক সাইট ভিজিট চাইছেন", "Customer asked about a site visit"));
  if (s.priority) lines.push(L("হট লিড — আগে কল করুন", "Hot lead — call first"));
  return lines;
}

/** Hot first, then probability, then newest. */
export function sortByPriority<T extends { score: QualificationScore; lastAt: string }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => Number(b.score.priority) - Number(a.score.priority) || b.score.probability - a.score.probability || b.lastAt.localeCompare(a.lastAt));
}
