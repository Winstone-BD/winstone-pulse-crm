import { plausibleSeconds } from "@/lib/lead-groups";

/**
 * Talk time for a call report. Priority:
 * 1. Duration the phone measured for the call (linked SIM call log / recording).
 * 2. Duration stored when the call ended, if plausible.
 * 3. What the agent typed in the report form.
 * Time spent filling out the report is never counted.
 */
export function resolveCallDuration(input: {
  phoneSeconds?: number | null;
  storedSeconds?: number | null;
  enteredSeconds?: number | null;
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
