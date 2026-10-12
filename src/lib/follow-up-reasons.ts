import type { Lang } from "@/lib/i18n";

/** Fixed structured follow-up reasons. Must match the DB trigger list. */
export const FOLLOW_UP_REASONS = [
  { code: "callback", label: "Customer callback চেয়েছেন" },
  { code: "price", label: "Price জানতে চেয়েছেন" },
  { code: "project_details", label: "Project details চেয়েছেন" },
  { code: "brochure", label: "Brochure চেয়েছেন" },
  { code: "payment", label: "Payment details চেয়েছেন" },
  { code: "location", label: "Location চেয়েছেন" },
  { code: "family", label: "Family-এর সাথে আলোচনা করবেন" },
  { code: "more_time", label: "আরও সময় প্রয়োজন" },
  { code: "site_visit", label: "Site Visit করতে আগ্রহী" },
  { code: "call_later", label: "পরে কল করতে বলেছেন" },
  { code: "agent_send_info", label: "Agent information পাঠাবে" },
  { code: "other", label: "অন্য কারণ" },
] as const;

/** English labels, same order/codes as FOLLOW_UP_REASONS. */
export const FOLLOW_UP_REASONS_EN = [
  { code: "callback", label: "Customer requested a callback" },
  { code: "price", label: "Asked about price" },
  { code: "project_details", label: "Asked for project details" },
  { code: "brochure", label: "Asked for brochure" },
  { code: "payment", label: "Asked about payment details" },
  { code: "location", label: "Asked for location" },
  { code: "family", label: "Will discuss with family" },
  { code: "more_time", label: "Needs more time" },
  { code: "site_visit", label: "Interested in a site visit" },
  { code: "call_later", label: "Asked to be called later" },
  { code: "agent_send_info", label: "Agent will send information" },
  { code: "other", label: "Other reason" },
] as const;

export type FollowUpReasonCode = (typeof FOLLOW_UP_REASONS)[number]["code"];
export const FOLLOW_UP_REASON_CODES = FOLLOW_UP_REASONS.map((r) => r.code) as [
  FollowUpReasonCode,
  ...FollowUpReasonCode[],
];

/** Bilingual label for a reason, by code. */
export function followUpReasonLabelFor(code: string, lang: Lang): string {
  const list = lang === "bn" ? FOLLOW_UP_REASONS : FOLLOW_UP_REASONS_EN;
  return list.find((r) => r.code === code)?.label ?? code;
}

export function followUpReasonLabel(code: string | null | undefined, fallback?: string | null, lang: Lang = "bn") {
  const hit = (lang === "bn" ? FOLLOW_UP_REASONS : FOLLOW_UP_REASONS_EN).find((r) => r.code === code);
  const otherLabel = lang === "bn" ? "অন্য কারণ" : "Other reason";
  if (hit && code !== "other") return hit.label;
  if (code === "other") return fallback?.trim() ? `${otherLabel} — ${fallback.trim()}` : otherLabel;
  return fallback?.trim() || (lang === "bn" ? "কারণ লেখা হয়নি" : "No reason given");
}
