import { EXTRACT_FIELDS, type ExtractFieldKey } from "@/lib/agent-templates";

export function selectedBuyerFields<T>(fields: Partial<Record<ExtractFieldKey, T>> | null, selected: ExtractFieldKey[]) {
  const result: Partial<Record<ExtractFieldKey, T>> = {};
  for (const key of EXTRACT_FIELDS) {
    const field = fields?.[key];
    if (selected.includes(key) && field !== undefined) result[key] = field;
  }
  return result;
}