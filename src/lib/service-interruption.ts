/** Temporary CRM closure starts at 11:30 AM Asia/Dhaka on 30 September 2026. */
export const CRM_CLOSURE_START_MS = Date.parse("2026-09-30T05:30:00.000Z");

export function isCrmClosureActive(now = Date.now()) {
  return now >= CRM_CLOSURE_START_MS;
}