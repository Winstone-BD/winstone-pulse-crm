/** Device-local dashboard load history (no server upload). */
export type LoadRecord = { at: number; ms: number; steps: { key: string; ms: number }[] };

const KEY = "crm-load-perf";
const MAX = 10;
const listeners = new Set<() => void>();

export function readLoads(): LoadRecord[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]") as LoadRecord[];
  } catch {
    return [];
  }
}

export function recordLoad(rec: LoadRecord) {
  if (typeof window === "undefined") return;
  const next = [rec, ...readLoads()].slice(0, MAX);
  localStorage.setItem(KEY, JSON.stringify(next));
  listeners.forEach((l) => l());
}

export function subscribeLoads(fn: () => void) {
  listeners.add(fn);
  return () => void listeners.delete(fn);
}

export const STEP_LABELS: Record<string, { bn: string; en: string }> = {
  account: { bn: "অ্যাকাউন্ট যাচাই", en: "Account check" },
  snapshot: { bn: "লিড/কল ডেটা", en: "Leads/calls data" },
};
