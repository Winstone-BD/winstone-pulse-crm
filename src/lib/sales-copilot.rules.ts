/**
 * Sales Copilot, Objection Library and Property Match — pure rules shared by
 * server, UI and tests. No market numbers live here: every fact and every
 * property comes from verified `market_facts` rows passed in by the caller.
 * Missing data is always surfaced as "not recorded", never guessed.
 */

import { OBJECTIONS, type ObjectionCode } from "@/lib/sales-intel-rules";

// ---------------- Languages ----------------
export const COPILOT_LANGUAGES = [
  { code: "bn", label: "বাংলা" },
  { code: "bnlish", label: "Banglish" },
  { code: "en", label: "English" },
] as const;
export type CopilotLanguage = (typeof COPILOT_LANGUAGES)[number]["code"];
export const COPILOT_LANGUAGE_CODES = COPILOT_LANGUAGES.map((l) => l.code) as [CopilotLanguage, ...CopilotLanguage[]];
export const languageLabel = (code: string) => COPILOT_LANGUAGES.find((l) => l.code === code)?.label ?? code;
export const isCopilotLanguage = (v: unknown): v is CopilotLanguage =>
  COPILOT_LANGUAGE_CODES.includes(v as CopilotLanguage);
export const normalizeLanguage = (v: unknown): CopilotLanguage => (isCopilotLanguage(v) ? v : "bn");

// ---------------- Objection library ----------------
/**
 * Approved starting content per objection: customer intent read, questions to
 * ask, and the next action. Bengali only; contains no numbers and no market
 * facts — HQ may still override responses through published pitch templates.
 */
export const OBJECTION_LIBRARY: Record<ObjectionCode, { intent: string; questions: string[]; nextAction: string }> = {
  price_high: {
    intent: "গ্রাহক দামকে মূল বাধা মনে করছেন — মূল্য প্রত্যাশা ও সম্ভাব্য ক্রয়ক্ষমতা যাচাই দরকার।",
    questions: [
      "আপনি কোন বাজেট বা মূল্য-সীমার ভেতরে থাকতে চান, এক লাইনে বলবেন?",
      "দাম ছাড়া আর কোন বিষয় (লোকেশন, সাইজ) সিদ্ধান্তে জরুরি?",
    ],
    nextAction: "গ্রাহকের বাজেট-সীমা রেকর্ড করুন, তারপর মিল থাকলে যাচাইকৃত তথ্য দিয়ে উপস্থাপন করুন।",
  },
  loan_rate_high: {
    intent: "গ্রাহক ঋণের শর্তে অস্বস্তিতে আছেন — বর্তমান লোন-পরিবেশের যাচাইকৃত তথ্য দরকার।",
    questions: [
      "আপনি কি লোন নিয়েই কিনবেন, নাকি আগে স্কিম জানতে চান?",
      "মাসিক কিস্তি সম্পর্কে আপনার অস্বস্তির সীমা কত?",
    ],
    nextAction: "প্রকাশিত ফাইন্যান্স তথ্য ছাড়া সুদের হার বলবেন না — যাচাইকৃত তথ্য না থাকলে পরে জানাবেন।",
  },
  market_may_fall: {
    intent: "গ্রাহক দাম কমার সম্ভাবনার জন্য অপেক্ষা করছেন — বাজার-মনোভাব বোঝা দরকার।",
    questions: [
      "আপনি ঠিক কী দেখলে কেনার সিদ্ধান্ত নেবেন?",
      "অপেক্ষায় থাকলে আপনার জন্য কী ঝুঁকি সবচেয়ে চিন্তার?",
    ],
    nextAction: "ব্যক্তিগত অনুমান দেবেন না — প্রকাশিত বাজার-তথ্য আছে কি দেখে তা দিন, না হলে বিনীতভাবে বলুন এখনো প্রকাশিত হয়নি।",
  },
  family_discuss: {
    intent: "গ্রাহক পরিবারের সম্মতি চান — সিদ্ধান্ত-গ্রহণকারী কে তা জানা দরকার।",
    questions: [
      "সিদ্ধান্তে পরিবারে কার মত সবচেয়ে গুরুত্বপূর্ণ?",
      "পরিবারের সদস্যদের সাথে যে তথ্যগুলো শেয়ার করবেন সেগুলো কী হতে চান?",
    ],
    nextAction: "সিদ্ধান্তকারীকে বসিয়ে পরের কল বা সাক্ষাৎ ঠিক করুন; ফলো-আপ দিনে তারিখ নিশ্চিত করুন।",
  },
  not_ready: {
    intent: "গ্রাহক এখন প্রস্তুত নন — প্রস্তুতির আসল কারণ ও সময়সীমা জানা দরকার।",
    questions: [
      "কী কারণে এখন প্রস্তুত নন — বাজেট, সিদ্ধান্ত, নাকি অন্য কিছু?",
      "কত সময় পরে আবার কথা বলতে সুবিধা হবে?",
    ],
    nextAction: "সময়-সীমা রেকর্ড করে ফলো-আপ দিন; তার আগে বারবার চাপ দেবেন না।",
  },
  more_info: {
    intent: "গ্রাহক বিস্তারিত তথ্য চান — প্রয়োজন নিশ্চিত করে সঠিক তথ্য দরকার।",
    questions: [
      "কোন তথ্যগুলো সবচেয়ে আগে দরকার — প্ল্যান, মূল্য, নাকি ডেলিভারি?",
      "ইমেইল/WhatsApp-এ পাঠানো ভালো হবে নাকি কলে?",
    ],
    nextAction: "প্রয়োজনের তালিকা রেকর্ড করুন; শুধু যাচাইকৃত তথ্যই পাঠান, অনুমান নয়।",
  },
  comparing: {
    intent: "গ্রাহক অন্য প্রজেক্টের সাথে তুলনা করছেন — কী ভিত্তিতে তুলনা করছেন জানা দরকার।",
    questions: [
      "আপনি অন্য প্রজেক্টে কী বিষয় ভালো পাচ্ছেন বলে মনে করছেন?",
      "আপনার জন্য কোন তিনটি বিষয় সিদ্ধান্ত নির্ধারণ করবে?",
    ],
    nextAction: "অন্য প্রজেক্ট নিয়ে মিথ্যা বলবেন না — আপনার যাচাইকৃত তথ্য থেকে সুবিধাগুলো স্পষ্ট করে দেখান।",
  },
  lower_budget: {
    intent: "গ্রাহকের বাজেট তার প্রত্যাশার তুলনায় কম — বাস্তব বাজেট-সীমা জানা দরকার।",
    questions: [
      "আপনার আসল বাজেট-সীমা কত, একবার বলবেন?",
      "সেই সীমার ভেতরে সাইজ ছোট করতে রাজি তো?",
    ],
    nextAction: "বাজেট রেকর্ড করুন; মিল থাকলে মিলিয়ে উপস্থাপন করুন, না হলে সৎভাবে বলুন মিল নেই।",
  },
  location: {
    intent: "গ্রাহক লোকেশন নিয়ে অস্বস্তিতে আছেন — পছন্দের এলাকা ও কারণ জানা দরকার।",
    questions: [
      "আপনার পছন্দের এলাকা কোনটি, আর কেন?",
      "অফিস বা স্কুল-কলেজের কাছে থাকা কতটা জরুরি?",
    ],
    nextAction: "পছন্দের এলাকা রেকর্ড করুন; সেই এলাকার যাচাইকৃত তথ্য আছে কি দেখে দেখান।",
  },
  payment: {
    intent: "গ্রাহক পেমেন্ট/কিস্তি নিয়ে চিন্তিত — প্রস্তাবিত কাঠামো ও নিজের অবস্থা জানা দরকার।",
    questions: [
      "আপনার জন্য কোন কিস্তি-কাঠামো সবচেয়ে সুবিধাজনক?",
      "এককালীন পেমেন্ট সম্ভব, নাকি ধাপে ধাপে চান?",
    ],
    nextAction: "পেমেন্ট-পছন্দ রেকর্ড করুন; নিশ্চিত প্রস্তাব ছাড়া প্রতিশ্রুতি দেবেন না।",
  },
  trust: {
    intent: "গ্রাহক ডেভেলপার/কোম্পানির বিশ্বাসযোগ্যতা নিয়ে প্রশ্ন করছেন — প্রমাণ দরকার।",
    questions: [
      "বিশ্বাসের বিষয়ে আপনার মূল দুশ্চিন্তা কোনটি?",
      "পাশের প্রজেক্টে কোম্পানির কাজ দেখেছেন কি?",
    ],
    nextAction: "শুধু নিশ্চিত রেকর্ড (প্রজেক্ট, সম্পন্ন ডেলিভারি) দেখান — নিশ্চিত নয় এমন প্রতিশ্রুতি দেবেন না।",
  },
  ready_property: {
    intent: "গ্রাহক এখন থেকেই ব্যবহারযোগ্য (রেডি) প্রপার্টি চান — প্রস্তুতির অবস্থা জানা দরকার।",
    questions: [
      "এখনই সরে যেতে চান, নাকি কয়েক মাসের মধ্যে?",
      "রেডি ফ্ল্যাটে আপনার সাইজ-প্রয়োজন কত?",
    ],
    nextAction: "রেডি-স্ট্যাটাস সংরক্ষিত প্রপার্টি তথ্য থাকলেই দেখান; না হলে স্পষ্ট বলুন এখন যাচাইকৃত রেডি অপশন নেই।",
  },
  other: {
    intent: "অন্য বিষয় — আপত্তির আসল কারণ গ্রাহকের নিজের ভাষায় রেকর্ড করা দরকার।",
    questions: [
      "আপনার মূল দুশ্চিন্তাটি এক লাইনে বলবেন?",
      "সেটি সমাধান হলে পরের ধাপ কী হবে মনে করেন?",
    ],
    nextAction: "আপত্তিটি রেকর্ড করে সঠিক তথ্য দিয়ে পরের কল ঠিক করুন।",
  },
};

/** Guard: every objection code must have library content with no invented facts. */
export function assertObjectionLibraryComplete() {
  for (const o of OBJECTIONS) {
    const e = OBJECTION_LIBRARY[o.code];
    if (!e?.intent?.trim() || e.questions.length === 0 || !e.nextAction?.trim()) {
      throw new Error(`objection library missing entry for ${o.code}`);
    }
  }
}

// ---------------- Copilot response ----------------
export type CopilotFact = {
  id: string;
  category: string;
  geography: string | null;
  metric: string;
  value: string;
  unit: string | null;
  sourceName: string;
  sourceUrl: string | null;
  effectiveDate: string;
  eligibility: string;
  version: number;
};

export type CopilotMatch = {
  fact: CopilotFact;
  score: number;
  why: string[];
};

export type CopilotResponse = {
  language: CopilotLanguage;
  /** INTERPRETATION — rule-based reading of the objection (no numbers). */
  intent: string;
  /** FACT layer context handed to the UI (records + verified facts). */
  factIds: string[];
  /** RECOMMENDATION — grounded reply or approved template fallback. */
  response: { text: string; grounded: boolean; aiNote: string | null; templateId: string | null };
  /** The one question to ask next. */
  nextQuestion: string;
  /** Rule-based next action. */
  nextAction: string;
  /** Verified property matches (empty = no verified match found). */
  propertyMatches: CopilotMatch[];
};

/** Numbers a string may contain under the grounding contract (Bengali → ASCII). */
const BN_DIGITS = "০১২৩৪৫৬৭৮৯";
const toAsciiDigits = (s: string) => s.replace(/[০-৯]/g, (d) => String(BN_DIGITS.indexOf(d)));
const numSet = (pool: string) => new Set((pool.match(/\d+(?:[.,]\d+)?/g) ?? []).map((n) => n.replace(/,/g, "").replace(/\.0+$/, "")));

/** Same numeric grounding rule as validateGrounding, reusable for any text. */
export function numbersGrounded(text: string, pool: string): boolean {
  const allowed = numSet(pool);
  for (const n of (toAsciiDigits(text).match(/\d+(?:[.,]\d+)?/g) ?? []).map((n) => n.replace(/,/g, ""))) {
    if (!allowed.has(n)) return false;
  }
  return true;
}

/**
 * Validates the AI's structured copilot output. Numbers in response,
 * next_question and next_action must all come from the provided pool
 * (lead context + cited facts). Unknown shapes fall back to the template.
 */
export function parseCopilotAi(
  raw: string,
  allowedFactIds: string[],
  pool: string,
): { intent: string | null; response: string; factIds: string[]; nextQuestion: string | null; nextAction: string | null } | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof parsed !== "object" || parsed === null) return null;
  const o = parsed as Record<string, unknown>;
  const response = typeof o["response"] === "string" ? o["response"].trim() : "";
  if (!response) return null;
  const factIds = Array.isArray(o["fact_ids"]) ? o["fact_ids"].map(String).filter((id) => allowedFactIds.includes(id)) : [];
  const pieces = [response];
  const nextQuestion = typeof o["next_question"] === "string" && o["next_question"].trim() ? o["next_question"].trim() : null;
  const nextAction = typeof o["next_action"] === "string" && o["next_action"].trim() ? o["next_action"].trim() : null;
  if (nextQuestion) pieces.push(nextQuestion);
  if (nextAction) pieces.push(nextAction);
  for (const p of pieces) if (!numbersGrounded(p, pool)) return null;
  return {
    intent: typeof o["intent"] === "string" && o["intent"].trim() ? o["intent"].trim() : null,
    response,
    factIds,
    nextQuestion,
    nextAction,
  };
}

export function copilotPromptInstruction(language: CopilotLanguage): string {
  const lang =
    language === "en"
      ? "Reply in English."
      : language === "bnlish"
        ? "Reply in Banglish — Bengali conversation written in Latin script."
        : "Reply in Bengali.";
  return `${lang} Use ONLY the verified facts and lead context provided. Never invent prices, rates, availability, legal claims, project specs or customer facts. Any number you write must appear in a cited fact or the context. Return JSON {"intent":string|null,"response":string,"fact_ids":string[],"next_question":string,"next_action":string|null}.`;
}

// ---------------- Property match ----------------
const STOP = new Set(["ও", "এবং", "the", "and", "for", "with", "near", "of", "a", "an", "in", "on", "at", "to"]);

const tokens = (s: string | null | undefined) =>
  (s ?? "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .split(" ")
    .filter((w) => w.length >= 3 && !STOP.has(w));

function overlap(a: string[] | null | undefined, b: string | null | undefined): string[] {
  const bs = new Set(tokens(b));
  return [...new Set(tokens(a))].filter((t) => bs.has(t));
}

export type PropertyCandidateInput = Pick<
  CopilotFact,
  "id" | "category" | "geography" | "metric" | "value" | "unit" | "sourceName" | "sourceUrl" | "effectiveDate" | "eligibility" | "version"
> & { notes?: string | null };

/**
 * Deterministic match of verified property facts against what the lead told us.
 * Only authoritative/review-due candidates are passed in by the caller — this
 * function never invents and never scores an unknown value. Returns [] when
 * nothing matches: the UI shows "No verified match found".
 */
export function buildPropertyMatch(input: { leadArea: string | null; leadAddress: string | null; requirement: string | null; candidates: PropertyCandidateInput[] }): CopilotMatch[] {
  const out: CopilotMatch[] = [];
  for (const f of input.candidates) {
    const geo = overlap([input.leadArea, input.leadAddress].filter(Boolean).join(" "), f.geography);
    const need = overlap(input.requirement, `${f.metric} ${f.notes ?? ""}`);
    if (geo.length === 0 && need.length === 0) continue;
    const why = [
      geo.length ? `এলাকা মিলেছে: ${geo.slice(0, 3).join(", ")}` : null,
      need.length ? `প্রয়োজনের সঙ্গে মিল: ${need.slice(0, 4).join(", ")}` : null,
    ].filter((x): x is string => Boolean(x));
    out.push({
      fact: { id: f.id, category: f.category, geography: f.geography, metric: f.metric, value: f.value, unit: f.unit, sourceName: f.sourceName, sourceUrl: f.sourceUrl, effectiveDate: f.effectiveDate, eligibility: f.eligibility, version: f.version },
      score: geo.length * 2 + need.length,
      why,
    });
  }
  return out.sort((a, b) => b.score - a.score || a.fact.id.localeCompare(b.fact.id)).slice(0, 5);
}
