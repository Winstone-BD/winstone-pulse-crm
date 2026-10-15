/**
 * Pure guards for server-side outbound calls (Firecrawl, Maps, FCM).
 * No network, no secrets — safe to unit test.
 */

const DEFAULT_ALLOWED = ["winstonebd.com"];

function isPrivateIpv4(host: string) {
  const m = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m) return false;
  return true; // any IPv4 literal is refused; only names on the allowlist pass
}

/**
 * SSRF guard: https only, default port, no credentials, no IP literals,
 * no internal names, and the host must be on (or under) the allowlist.
 */
export function checkOutboundUrl(
  raw: string,
  allowed: string[] = DEFAULT_ALLOWED,
): { ok: true; url: string } | { ok: false; reason: string } {
  if (typeof raw !== "string" || raw.length > 2048) return { ok: false, reason: "invalid_url" };
  let u: URL;
  try {
    u = new URL(raw.trim());
  } catch {
    return { ok: false, reason: "invalid_url" };
  }
  if (u.protocol !== "https:") return { ok: false, reason: "https_only" };
  if (u.username || u.password) return { ok: false, reason: "credentials_in_url" };
  if (u.port && u.port !== "443") return { ok: false, reason: "port_not_allowed" };
  const host = u.hostname.toLowerCase().replace(/\.$/, "");
  if (!host || host.startsWith("[") || host.includes(":") || isPrivateIpv4(host) || /^\d+$/.test(host) || /^0x/i.test(host)) {
    return { ok: false, reason: "ip_literal_not_allowed" };
  }
  if (host === "localhost" || /\.(local|internal|localhost|lan|home|corp)$/.test(host) || !host.includes(".")) {
    return { ok: false, reason: "internal_host" };
  }
  const ok = allowed.some((d) => host === d || host.endsWith(`.${d}`));
  if (!ok) return { ok: false, reason: "host_not_allowlisted" };
  return { ok: true, url: u.toString() };
}

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
  if (status === 404) return true;
  if (status === 400) return /UNREGISTERED|registration[- ]token|message\.token/i.test(body);
  return false;
}
