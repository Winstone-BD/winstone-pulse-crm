/**
 * Canonical contact-close ("no further follow-up") reasons. One list used by
 * the report form, server validation, Lead 360, follow-up history and exports.
 * `not_connected` is system-set for calls that never connected.
 */
export const CONTACT_CLOSE_REASONS = [
  { code: "not_interested", label: "Customer Not Interested" },
  { code: "info_completed", label: "Information Completed" },
  { code: "converted", label: "Converted / Closed" },
  { code: "wrong_number", label: "Wrong Number" },
  { code: "duplicate", label: "Duplicate" },
  { code: "no_contact", label: "Customer Requested No Further Contact" },
  { code: "other", label: "Other" },
] as const;

export const SYSTEM_CLOSE_REASONS = [{ code: "not_connected", label: "Call not connected — retry queue" }] as const;

export type ContactCloseReasonCode =
  | (typeof CONTACT_CLOSE_REASONS)[number]["code"]
  | (typeof SYSTEM_CLOSE_REASONS)[number]["code"];

const ALL = [...CONTACT_CLOSE_REASONS, ...SYSTEM_CLOSE_REASONS] as readonly { code: string; label: string }[];

export function isContactCloseReason(code: string | null | undefined): code is ContactCloseReasonCode {
  return Boolean(code) && ALL.some((r) => r.code === code);
}

/** Display label; legacy free-text values are shown as-is, never rewritten. */
export function contactCloseReasonLabel(code: string | null | undefined, note?: string | null) {
  if (!code) return null;
  const hit = ALL.find((r) => r.code === code);
  if (!hit) return code;
  return code === "other" && note?.trim() ? `Other — ${note.trim()}` : hit.label;
}
