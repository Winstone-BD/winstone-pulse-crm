/**
 * Shared, browser-safe labels for the Sales Team Admin support desk.
 * Server logic lives in team-support.server.ts; UI imports only this file.
 */

export const SUPPORT_CATEGORIES = [
  { key: "crm_problem", label: "CRM সমস্যা" },
  { key: "android_app", label: "অ্যান্ড্রয়েড অ্যাপ সমস্যা" },
  { key: "call_problem", label: "কল সমস্যা" },
  { key: "lead_problem", label: "লিড সমস্যা" },
  { key: "login_problem", label: "লগইন সমস্যা" },
  { key: "system_down", label: "সিস্টেম কাজ করছে না" },
  { key: "technical", label: "কারিগরি সমস্যা" },
  { key: "customer_issue", label: "কাস্টমার/লিড ইস্যু" },
  { key: "workflow", label: "কাজের ধরন/নিয়ম" },
  { key: "complaint", label: "অভিযোগ" },
  { key: "requirement", label: "প্রয়োজন/অনুরোধ" },
  { key: "other", label: "অন্য কিছু" },
] as const;

export const SUPPORT_PRIORITIES = ["low", "normal", "high", "critical"] as const;
export const SUPPORT_STATUSES = ["open", "acknowledged", "in_progress", "resolved", "closed"] as const;

export type SupportPriority = (typeof SUPPORT_PRIORITIES)[number];
export type SupportStatus = (typeof SUPPORT_STATUSES)[number];

export const PRIORITY_LABELS: Record<SupportPriority, string> = {
  low: "কম",
  normal: "স্বাভাবিক",
  high: "জরুরি",
  critical: "অতি জরুরি",
};

export const STATUS_LABELS: Record<SupportStatus, string> = {
  open: "নতুন",
  acknowledged: "দেখা হয়েছে",
  in_progress: "কাজ চলছে",
  resolved: "সমাধান হয়েছে",
  closed: "বন্ধ",
};

export function categoryLabel(key: string): string {
  return SUPPORT_CATEGORIES.find((c) => c.key === key)?.label ?? key;
}

