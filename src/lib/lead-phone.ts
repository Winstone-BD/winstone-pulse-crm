/** Canonical Bangladesh mobile identity shared by every lead write path. */
export function normalizeBangladeshPhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  if (/^8801[3-9]\d{8}$/.test(digits)) return digits;
  if (/^01[3-9]\d{8}$/.test(digits)) return `88${digits}`;
  if (/^1[3-9]\d{8}$/.test(digits)) return `880${digits}`;
  return null;
}

export function extractBangladeshPhones(raw: string): string[] {
  const matches = raw.match(/(?:\+?8801[3-9]\d{8}|01[3-9]\d{8}|1[3-9]\d{8})/g) ?? [];
  return [...new Set(matches.map(normalizeBangladeshPhone).filter((phone): phone is string => !!phone))];
}

export function primaryBangladeshPhone(raw: string): string | null {
  return extractBangladeshPhones(raw)[0] ?? normalizeBangladeshPhone(raw);
}

export function appendCompanyLeadMetadata(input: {
  notes?: string | null;
  outreachEn?: string | null;
  outreachBn?: string | null;
}): string {
  return [
    "Lead Type: Company Lead",
    input.outreachEn?.trim() ? `Outreach EN: ${input.outreachEn.trim()}` : null,
    input.outreachBn?.trim() ? `Outreach BN: ${input.outreachBn.trim()}` : null,
    input.notes?.trim() || null,
  ]
    .filter((value): value is string => !!value)
    .join("\n");
}