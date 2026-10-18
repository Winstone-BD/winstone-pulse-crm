import { plausibleSeconds } from "@/lib/lead-groups";

/**
 * Talk time for a call report. Priority:
 * 1. Duration the phone measured for the call (linked SIM call log / recording).
 * 2. Duration stored when the call ended, if plausible.
 * 3. What the agent typed in the report form.
 * Time spent filling out the report is never counted.
 */
export function resolveCallDuration(input: {
  phoneSeconds?: number | null | undefined;
  storedSeconds?: number | null | undefined;
  enteredSeconds?: number | null | undefined;
}): number {
  const phone = plausibleSeconds(input.phoneSeconds);
  if (phone > 0) return Math.round(phone);
  const stored = plausibleSeconds(input.storedSeconds);
  if (stored > 0) return Math.round(stored);
  return Math.round(plausibleSeconds(input.enteredSeconds));
}

/** Web stopwatch (dial → "end" click) is only kept when it looks like a real call. */
export function webStopwatchSeconds(startedAt: number | null | undefined, now: number): number {
  if (!startedAt) return 0;
  return plausibleSeconds(Math.floor((now - startedAt) / 1000));
}

/**
 * A web "Call" button report has no linked phone row. When the Android app
 * synced the same call from the phone's call log (same agent + lead), use the
 * phone's own measured time. Only phone rows that started within the window
 * before the report was opened count; the closest one wins.
 */
export const PHONE_MATCH_WINDOW_MS = 3 * 60 * 60 * 1000;
export function pickPhoneMeasuredSeconds(
  reportOpenedAt: string | number,
  rows: Array<{ started_at?: string | null; created_at?: string | null; duration_seconds?: number | null; call_source?: string | null }>,
): number | null {
  const opened = new Date(reportOpenedAt).getTime();
  if (!Number.isFinite(opened)) return null;
  let best: { gap: number; seconds: number } | null = null;
  for (const row of rows) {
    if (String(row.call_source ?? "").startsWith("web")) continue;
    const at = new Date(row.started_at ?? row.created_at ?? "").getTime();
    if (!Number.isFinite(at)) continue;
    const gap = opened - at;
    if (gap < -5 * 60 * 1000 || gap > PHONE_MATCH_WINDOW_MS) continue;
    const seconds = plausibleSeconds(row.duration_seconds);
    if (seconds <= 0) continue;
    if (!best || Math.abs(gap) < best.gap) best = { gap: Math.abs(gap), seconds: Math.round(seconds) };
  }
  return best?.seconds ?? null;
}
