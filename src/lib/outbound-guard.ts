/**
 * Pure helpers for server-side FCM sends (timeout, redaction, data coercion, dead-token rule).
 * No network, no secrets — safe to unit test.
 */

/** Removes keys/tokens from provider error text and caps its length. */
export function redact(text: string, max = 300): string {
  return String(text ?? "")
    .replace(/(lovc_|fc-|sb_secret_|AIza)[A-Za-z0-9_\-]{6,}/g, "[redacted]")
    .replace(/Bearer\s+[A-Za-z0-9._\-]+/gi, "Bearer [redacted]")
    .replace(/"token"\s*:\s*"[^"]+"/g, '"token":"[redacted]"')
    .replace(/[A-Za-z0-9_\-]{20,}:[A-Za-z0-9_\-]{60,}/g, "[redacted]")
    .slice(0, max);
}

/** fetch with a hard timeout. */
export async function fetchWithTimeout(input: string, init: RequestInit, ms: number) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(input, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(t);
  }
}

/** FCM `data` must be string-to-string. */
export function stringifyData(data: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(data)) {
    if (v === undefined || v === null) continue;
    out[k] = typeof v === "string" ? v : JSON.stringify(v);
  }
  return out;
}

/** Only a truly dead token is revoked; a bad payload must not drop the device. */
export function isDeadTokenResponse(status: number, body: string): boolean {
  // FCM v1 envelope: error.details[].errorCode === "UNREGISTERED" (usually 404),
  // or a 400 INVALID_ARGUMENT whose message names the registration token.
  if (/"errorCode"\s*:\s*"UNREGISTERED"/.test(body)) return status === 404 || status === 400;
  if (status === 400) return /registration token/i.test(body);
  return false;
}
