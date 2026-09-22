/**
 * Floor-wide performance review board (12–22 September 2026).
 *
 * Client-safe, read-only snapshot of the analysis that was produced from the
 * real call, recording and lead-handling data. It is shown as a blocking notice
 * on every desk until the floor opens, so the numbers are frozen on purpose —
 * nothing here writes to or reads from live tables.
 */

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
  verdict: string;
  tone: "good" | "warn" | "bad";
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
    verdict: "১৫৮টি লিড কোনো কল রিপোর্ট ছাড়াই বন্ধ — দ্বিতীয় সবচেয়ে খারাপ।",
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
    verdict: "রেকর্ডিং গড় ১.১ সে., ৫৫টি ভুয়া connected — ফোলানো রিপোর্ট।",
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
    verdict:
      "সবচেয়ে বেশি লিড (২১৩) নিয়ে মাত্র ৩১টি আসল কথা, ১৪৪টি ভুয়া connected, ১০৭টি লিড রিপোর্ট ছাড়া বন্ধ — কাজ না করে ভুয়া রিপোর্ট, সরাসরি লিড নষ্ট।",
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
    verdict: "কোনো লিড নেই, তাই কোনো দায়ও নেই।",
    tone: "good",
  },
];

export const REVIEW_RULES = [
  "১৫ সেকেন্ডের কম কল “connected” হিসেবে গ্রহণ করা হবে না।",
  "submitted কল রিপোর্ট ছাড়া কোনো লিড closed করা যাবে না।",
  "প্রতিটি কলের রেকর্ডিং বাধ্যতামূলক — বন্ধ করা যাবে না।",
  "অস্বাভাবিক কল/রিপোর্ট প্যাটার্ন রিয়েল-টাইমে মনিটর হবে।",
];

export const REVIEW_INSIGHT =
  "১,৩৭১টি লিডে ৫৫৬টি আসল কথা হওয়ার পরেও কারো closed_converted ৫টির বেশি নয় — এটা শুধু এজেন্টের অবহেলা নয়, স্ক্রিপ্ট ও পিচেরও সমস্যা।";
