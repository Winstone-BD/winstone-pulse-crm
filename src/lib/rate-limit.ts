/**
 * Best-effort fixed-window limiter (per server instance). It is a flood brake
 * in front of signature checks, not an authority — idempotency, HMAC and the
 * database-backed workflow limits stay the real protection. Stateless worker
 * fleets do not share this map, so never use it as the only security control.
 * No IP allowlists or office-network binding: limits only slow abusive bursts.
 */
export function createRateLimiter(limit: number, windowMs: number) {
  const hits = new Map<string, { start: number; count: number }>();
  const allow = (key: string, now = Date.now()): boolean => {
    const entry = hits.get(key);
    if (!entry || now - entry.start >= windowMs) {
      if (hits.size > 5_000) hits.clear();
      hits.set(key, { start: now, count: 1 });
      return true;
    }
    entry.count += 1;
    return entry.count <= limit;
  };
  /** Whole seconds until this key's window resets (minimum 1). */
  allow.retryAfter = (key: string, now = Date.now()): number => {
    const entry = hits.get(key);
    return entry ? Math.max(1, Math.ceil((entry.start + windowMs - now) / 1000)) : 1;
  };
  return allow;
}

/**
 * Failed-attempt limiter: `check` is read-only, `record` counts a failure.
 * Use for credential endpoints so successful logins on a shared office
 * network never consume the budget — only wrong-password bursts do.
 */
export function createFailureLimiter(limit: number, windowMs: number) {
  const hits = new Map<string, { start: number; count: number }>();
  return {
    check(key: string, now = Date.now()): boolean {
      const entry = hits.get(key);
      return !entry || now - entry.start >= windowMs || entry.count < limit;
    },
    record(key: string, now = Date.now()): void {
      const entry = hits.get(key);
      if (!entry || now - entry.start >= windowMs) {
        if (hits.size > 5_000) hits.clear();
        hits.set(key, { start: now, count: 1 });
        return;
      }
      entry.count += 1;
    },
    /** Whole seconds until this key's window resets (minimum 1). */
    retryAfter(key: string, now = Date.now()): number {
      const entry = hits.get(key);
      return entry ? Math.max(1, Math.ceil((entry.start + windowMs - now) / 1000)) : 1;
    },
  };
}

/**
 * Friendly 429 with a standard Retry-After header. The body never names the
 * limiter, bucket or source key — only when to try again.
 */
export function rateLimitedResponse(retryAfterSec: number, extra: Record<string, unknown> = {}): Response {
  const seconds = Math.max(1, Math.ceil(retryAfterSec));
  const minutes = Math.ceil(seconds / 60);
  const wait = seconds < 60 ? { bn: `${seconds} সেকেন্ড`, en: `${seconds} seconds` } : { bn: `${minutes} মিনিট`, en: `${minutes} minute${minutes > 1 ? "s" : ""}` };
  return new Response(
    JSON.stringify({
      ok: false,
      error: `অনেকবার চেষ্টা হয়েছে — ${wait.bn} পরে আবার চেষ্টা করুন`,
      error_en: `Too many attempts — please try again in ${wait.en}`,
      retry_after: seconds,
      retryable: true,
      ...extra,
    }),
    {
      status: 429,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
        "Retry-After": String(seconds),
      },
    },
  );
}

/**
 * Non-secret bucket key for best-effort public-route limits.
 * Only `cf-connecting-ip` is trusted: Cloudflare (our only edge proxy) sets
 * it and overwrites any client-supplied value. `X-Forwarded-For` and device
 * headers are client-controlled, so they are never used — a spoofed header
 * must not let a caller dodge a limit or frame another IP. Without the
 * trusted header every caller shares one conservative "unknown" bucket.
 */
export function requestSourceKey(request: Request): string {
  const ip = request.headers.get("cf-connecting-ip")?.trim();
  return ip && ip.length <= 64 ? ip : "unknown";
}
