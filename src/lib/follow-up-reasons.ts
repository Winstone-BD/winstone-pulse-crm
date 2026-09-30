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

export type FollowUpReasonCode = (typeof FOLLOW_UP_REASONS)[number]["code"];
export const FOLLOW_UP_REASON_CODES = FOLLOW_UP_REASONS.map((r) => r.code) as [
  FollowUpReasonCode,
  ...FollowUpReasonCode[],
];

export function followUpReasonLabel(code: string | null | undefined, fallback?: string | null) {
  const hit = FOLLOW_UP_REASONS.find((r) => r.code === code);
  if (hit && code !== "other") return hit.label;
  if (code === "other") return fallback?.trim() ? `অন্য কারণ — ${fallback.trim()}` : "অন্য কারণ";
  return fallback?.trim() || "কারণ লেখা হয়নি";
}
