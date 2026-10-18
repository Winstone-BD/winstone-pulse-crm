/**
 * Best-effort fixed-window limiter (per server instance). It is a flood brake
 * in front of signature checks, not an authority — idempotency, HMAC and the
 * database-backed workflow limits stay the real protection. Stateless worker
 * fleets do not share this map, so never use it as the only security control.
 */
export function createRateLimiter(limit: number, windowMs: number) {
  const hits = new Map<string, { start: number; count: number }>();
  return (key: string, now = Date.now()): boolean => {
    const entry = hits.get(key);
    if (!entry || now - entry.start >= windowMs) {
      if (hits.size > 5_000) hits.clear();
      hits.set(key, { start: now, count: 1 });
      return true;
    }
    entry.count += 1;
    return entry.count <= limit;
  };
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
  };
}

/** A non-secret request bucket key suitable for best-effort public-route limits. */
export function requestSourceKey(request: Request): string {
  return (
    request.headers.get("cf-connecting-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-device-id") ??
    "unknown"
  );
}
