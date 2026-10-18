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

export type DurationSource = "phone_sync" | "web_timer" | "entered" | "whatsapp_entered";

/** Same as pickPhoneMeasuredSeconds, plus when the phone row was synced. */
export function pickPhoneMeasuredCall(
  reportOpenedAt: string | number,
  rows: Array<{ started_at?: string | null; created_at?: string | null; duration_seconds?: number | null; call_source?: string | null }>,
): { seconds: number; syncedAt: string | null } | null {
  const seconds = pickPhoneMeasuredSeconds(reportOpenedAt, rows);
  if (seconds === null) return null;
  const opened = new Date(reportOpenedAt).getTime();
  let best: { gap: number; at: string | null } | null = null;
  for (const row of rows) {
    if (String(row.call_source ?? "").startsWith("web")) continue;
    if (Math.round(plausibleSeconds(row.duration_seconds)) !== seconds) continue;
    const gap = Math.abs(opened - new Date(row.started_at ?? row.created_at ?? "").getTime());
    if (!best || gap < best.gap) best = { gap, at: row.created_at ?? null };
  }
  return { seconds, syncedAt: best?.at ?? null };
}

/** Which input resolveCallDuration actually used. WhatsApp calls are never phone-measured. */
export function resolveDurationSource(input: {
  channel?: string | null;
  phoneSeconds?: number | null;
  storedSeconds?: number | null;
}): DurationSource {
  if (input.channel === "whatsapp") return "whatsapp_entered";
  if (plausibleSeconds(input.phoneSeconds) > 0) return "phone_sync";
  if (plausibleSeconds(input.storedSeconds) > 0) return "web_timer";
  return "entered";
}

export function durationSourceLabel(source: string | null | undefined): string {
  switch (source) {
    case "phone_sync": return "ফোনের কল-হিস্টরি থেকে";
    case "web_timer": return "ওয়েব টাইমার থেকে";
    case "entered": return "এজেন্টের লেখা সময়";
    case "whatsapp_entered": return "WhatsApp কল — এজেন্টের লেখা সময়";
    default: return "উৎস জানা নেই";
  }
}
