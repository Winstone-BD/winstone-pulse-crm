/**
 * Floor-wide performance intelligence snapshot (12–22 September 2026).
 *
 * Client-safe, read-only. Shown as a blocking board on every desk until the
 * floor opens. The numbers are frozen on purpose — nothing here reads or writes
 * live tables. Three separate signals are kept apart so the board reviews data
 * patterns instead of accusing a person:
 *   activity  → how much work happened (real conversations, talk time)
 *   evidence  → how much of it is provable (recordings, submitted reports)
 *   integrity → whether the pattern is unusual (<15s connections, no-report closes)
 */

export type SmartStatus = "healthy" | "review" | "evidence_gap" | "critical";

export type ReviewRow = {
  rank: number | null;
  name: string;
  employeeId: string;
  leads: number;
  /** Calls of 60 seconds or more — an actual conversation. */
  realConversations: number;
  talkTime: string;
  /** Average recording length in seconds. */
  avgRecordingSeconds: number;
  /** "Connected" reports shorter than 15 seconds. */
  fakeConnected: number;
  /** Leads closed with no submitted call report. */
  closedWithoutReport: number;
  smartStatus: SmartStatus;
  /** Machine-read pattern note, English, no accusation. */
  insight: string;
  verdict: string;
  tone: "good" | "warn" | "bad";
};

export const SMART_STATUS_LABEL: Record<SmartStatus, { en: string; bn: string }> = {
  healthy: { en: "Healthy", bn: "স্বাভাবিক" },
  review: { en: "Review", bn: "রিভিউ দরকার" },
  evidence_gap: { en: "Evidence Gap", bn: "প্রমাণ কম" },
  critical: { en: "Critical Pattern", bn: "গুরুতর প্যাটার্ন" },
};

export const REVIEW_PERIOD = "১২ – ২২ সেপ্টেম্বর ২০২৬";

export const REVIEW_TOTALS = {
  leads: 1371,
  realConversations: 556,
  talkTime: "৪০ ঘ. ১৯ মি.",
  recordings: 7014,
  fakeConnected: 356,
  closedWithoutReport: 289,
  converted: "≤ ৫ (প্রতি এজেন্ট)",
};

export const REVIEW_ROWS: ReviewRow[] = [
  {
    rank: 1,
    name: "Monisha Biswas",
    employeeId: "WIN2604",
    leads: 155,
    realConversations: 121,
    talkTime: "৮ ঘ. ০০ মি.",
    avgRecordingSeconds: 20.1,
    fakeConnected: 14,
    closedWithoutReport: 0,
    smartStatus: "healthy",
    insight: "Highest verified conversation rate with full report coverage. Allocation can grow.",
    verdict: "সেরা কাজ — কোনো বড় অভিযোগ নেই, আরও লিড দেওয়া যায়।",
    tone: "good",
  },
  {
    rank: 2,
    name: "Debbroto Kumar Chakroborty",
    employeeId: "WIN2605",
    leads: 201,
    realConversations: 102,
    talkTime: "৮ ঘ. ৩৮ মি.",
    avgRecordingSeconds: 16.1,
    fakeConnected: 25,
    closedWithoutReport: 0,
    smartStatus: "healthy",
    insight: "Strong talk time and complete evidence. Lead backlog is the only open item.",
    verdict: "ভালো কথার সময়, তবে ১১৮টি লিড এখনো বাকি।",
    tone: "good",
  },
  {
    rank: 3,
    name: "Sabbir Ahmmed",
    employeeId: "WIN905201",
    leads: 230,
    realConversations: 84,
    talkTime: "৪ ঘ. ৩৪ মি.",
    avgRecordingSeconds: 7.4,
    fakeConnected: 51,
    closedWithoutReport: 9,
    smartStatus: "review",
    insight: "Moderate activity with short average recordings and a few closures lacking reports.",
    verdict: "৫১টি ছোট কল, ৯টি লিড রিপোর্ট ছাড়া বন্ধ — অসম্পূর্ণ কাজ।",
    tone: "warn",
  },
  {
    rank: 4,
    name: "Mst. Soniya Yeasmin",
    employeeId: "WIN2601",
    leads: 236,
    realConversations: 77,
    talkTime: "৫ ঘ. ৫১ মি.",
    avgRecordingSeconds: 1.2,
    fakeConnected: 41,
    closedWithoutReport: 158,
    smartStatus: "critical",
    insight:
      "Large lead volume closed without call reports plus near-zero recording length. Evidence verification required before closure.",
    verdict: "১৫৮টি লিড কোনো কল রিপোর্ট ছাড়াই বন্ধ — রিপোর্ট যাচাই ছাড়া লিড বন্ধ করা হয়েছে।",
    tone: "bad",
  },
  {
    rank: 5,
    name: "Srijonee Sarowar",
    employeeId: "WIN2603",
    leads: 192,
    realConversations: 72,
    talkTime: "৬ ঘ. ০৮ মি.",
    avgRecordingSeconds: 0,
    fakeConnected: 26,
    closedWithoutReport: 0,
    smartStatus: "evidence_gap",
    insight: "Reported activity looks normal, but only 2 recordings exist — coverage cannot be verified.",
    verdict: "কথার সংখ্যা ঠিক, কিন্তু মাত্র ২টি রেকর্ডিং — কাজের প্রমাণ নেই।",
    tone: "warn",
  },
  {
    rank: 6,
    name: "Mst. Nazrin Akter",
    employeeId: "WIN2602",
    leads: 144,
    realConversations: 69,
    talkTime: "৫ ঘ. ৩৩ মি.",
    avgRecordingSeconds: 1.1,
    fakeConnected: 55,
    closedWithoutReport: 0,
    smartStatus: "critical",
    insight:
      "High short-call volume against 1.1s average recording length. Reported connections do not match evidence.",
    verdict: "রেকর্ডিং গড় ১.১ সে., ৫৫টি ছোট connected — রিপোর্ট আর প্রমাণ মিলছে না।",
    tone: "bad",
  },
  {
    rank: 7,
    name: "Elias Zayed",
    employeeId: "WIN2606",
    leads: 213,
    realConversations: 31,
    talkTime: "১ ঘ. ৩৫ মি.",
    avgRecordingSeconds: 3.5,
    fakeConnected: 144,
    closedWithoutReport: 107,
    smartStatus: "critical",
    insight:
      "High lead allocation + low verified conversation activity + unusually high short-call volume. Review required.",
    verdict:
      "সবচেয়ে বেশি লিড (২১৩) নিয়ে মাত্র ৩১টি আসল কথা, ১৪৪টি <১৫ সে. connected, ১০৭টি লিড রিপোর্ট ছাড়া বন্ধ।",
    tone: "bad",
  },
  {
    rank: null,
    name: "Abu Haidar (Sell Team Admin)",
    employeeId: "WIN2607",
    leads: 0,
    realConversations: 0,
    talkTime: "০ মি.",
    avgRecordingSeconds: 0,
    fakeConnected: 0,
    closedWithoutReport: 0,
    smartStatus: "healthy",
    insight: "No leads allocated in this window — nothing to review.",
    verdict: "কোনো লিড নেই, তাই কোনো দায়ও নেই।",
    tone: "good",
  },
];

/** Cards rendered with the biggest signals first. */
export const SMART_CARD_IDS = ["WIN2606", "WIN2601", "WIN2602"];

export type ReviewAlert = {
  kind: "performance" | "integrity";
  employeeId: string;
  name: string;
  signal: string;
  severity: "HIGH" | "MEDIUM";
  lines: string[];
  action: string;
};

export const REVIEW_ALERTS: ReviewAlert[] = [
  {
    kind: "performance",
    employeeId: "WIN2606",
    name: "Elias Zayed",
    signal: "144 calls under 15 seconds",
    severity: "HIGH",
    lines: ["213 assigned leads", "31 verified conversations", "107 closed without report"],
    action: "Review Evidence",
  },
  {
    kind: "integrity",
    employeeId: "WIN2601",
    name: "Mst. Soniya Yeasmin",
    signal: "158 leads closed without call report",
    severity: "HIGH",
    lines: ["236 assigned leads", "77 verified conversations", "1.2s average recording"],
    action: "Report verification before closure",
  },
  {
    kind: "integrity",
    employeeId: "WIN2603",
    name: "Srijonee Sarowar",
    signal: "Only 2 recordings against 192 leads",
    severity: "MEDIUM",
    lines: ["192 assigned leads", "72 verified conversations", "0s average recording"],
    action: "Recording coverage check",
  },
];

export const REVIEW_RULES = [
  "১৫ সেকেন্ডের কম কল “connected” হিসেবে গ্রহণ করা হবে না।",
  "submitted কল রিপোর্ট ছাড়া কোনো লিড closed করা যাবে না।",
  "রেকর্ডিং না থাকলে লিড বন্ধ করা যাবে না।",
  "অস্বাভাবিক প্যাটার্ন ধরা পড়লে IT/HQ রিভিউ হবে।",
];

export const REVIEW_RULES_EN = [
  "<15s → Not Connected",
  "No Call Report → Cannot Close",
  "No Recording → Closure Blocked",
  "Anomaly Detected → IT/HQ Review",
];

export const REVIEW_INSIGHT =
  "১,৩৭১টি লিডে ৫৫৬টি আসল কথা হওয়ার পরেও কারো closed_converted ৫টির বেশি নয় — এটা শুধু এজেন্টের অবহেলা নয়, স্ক্রিপ্ট ও পিচেরও সমস্যা।";
