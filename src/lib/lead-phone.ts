/** Canonical international phone identity shared by every lead write path. */
export function normalizeBangladeshPhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  if (/^8801[3-9]\d{8}$/.test(digits)) return digits;
  if (/^01[3-9]\d{8}$/.test(digits)) return `88${digits}`;
  if (/^1[3-9]\d{8}$/.test(digits)) return `880${digits}`;
  const trimmed = raw.trim();
  if (/^\+[1-9][\d() .-]{7,20}$/.test(trimmed) && /^[1-9]\d{7,14}$/.test(digits)) return digits;
  if (/^00[1-9][\d() .-]{7,20}$/.test(trimmed)) {
    const international = digits.replace(/^00/, "");
    if (/^[1-9]\d{7,14}$/.test(international)) return international;
  }
  return null;
}

export function extractBangladeshPhones(raw: string): string[] {
  const matches = raw.match(/(?:\+?8801[3-9]\d{8}|01[3-9]\d{8}|1[3-9]\d{8})/g) ?? [];
  const phones = matches.map(normalizeBangladeshPhone).filter((phone): phone is string => !!phone);
  const whole = normalizeBangladeshPhone(raw);
  if (whole) phones.push(whole);
  return [...new Set(phones)];
}

export function primaryBangladeshPhone(raw: string): string | null {
  return extractBangladeshPhones(raw)[0] ?? normalizeBangladeshPhone(raw);
}

export function appendCompanyLeadMetadata(input: {
  notes?: string | null | undefined;
  outreachEn?: string | null | undefined;
  outreachBn?: string | null | undefined;
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