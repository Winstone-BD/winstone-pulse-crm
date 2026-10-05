/**
 * CRM → Winstone OS booking dispatch: pure rules (no I/O), shared by server and tests.
 *
 * Wire format v1 (POST JSON to OS_BOOKING_ENDPOINT):
 *   headers: content-type: application/json
 *            x-idempotency-key: <sync event key>
 *            x-winstone-timestamp: <unix seconds>
 *            x-winstone-signature: sha256=<hex HMAC-SHA256(CRM_BRIDGE_SECRET, `${ts}.${body}`)>
 *            x-winstone-api-version: 1
 *   body: { event_id, event_type: "booking.created|booking.updated|booking.cancelled",
 *           idempotency_key, occurred_at, source: "winstone_crm",
 *           data: { booking_id, lead_id, project, area, amount_usd, booked_at, status } }
 */

export const OS_OUTBOUND_PREFIX = "crm_to_os_";
export const MAX_ATTEMPTS = 5;
/** Wait before attempt n+1 (index = attempts already made − 1): 1m, 5m, 15m, 1h, 4h. */
export const BACKOFF_MS = [60_000, 300_000, 900_000, 3_600_000, 14_400_000];

export type DispatchOutcome = "sent" | "retry" | "dead";

/** 2xx and 409 (already received) are success; 400/422 are permanent; everything else retries. */
export function classifyResponse(status: number | null): DispatchOutcome {
  if (status === null) return "retry"; // network error / timeout
  if ((status >= 200 && status < 300) || status === 409) return "sent";
  if (status === 400 || status === 422 || status === 413) return "dead";
  return "retry"; // 401/403 auth outage, 429, 5xx
}

/** Next status after an attempt, given attempts made including this one. */
export function nextStatus(outcome: DispatchOutcome, attempts: number): "sent" | "failed" | "dead" {
  if (outcome === "sent") return "sent";
  if (outcome === "dead" || attempts >= MAX_ATTEMPTS) return "dead";
  return "failed";
}

/** Is a failed row due for another try? */
export function isDue(row: { status: string; retry_count: number; processed_at: string | null }, now = Date.now()) {
  if (row.status === "queued") return true;
  if (row.status !== "failed") return false;
  if (row.retry_count >= MAX_ATTEMPTS) return false;
  const last = row.processed_at ? new Date(row.processed_at).getTime() : 0;
  const wait = BACKOFF_MS[Math.max(0, Math.min(row.retry_count - 1, BACKOFF_MS.length - 1))]!;
  return now - last >= wait;
}

export function buildEnvelope(row: {
  id: string;
  idempotency_key: string | null;
  event_type: string;
  created_at: string;
  payload: unknown;
}) {
  return {
    event_id: row.id,
    event_type: row.event_type.replace(OS_OUTBOUND_PREFIX, ""),
    idempotency_key: row.idempotency_key ?? row.id,
    occurred_at: row.created_at,
    source: "winstone_crm",
    data: row.payload ?? {},
  };
}

export function validEndpoint(raw: string | undefined): string | null {
  if (!raw) return null;
  try {
    const u = new URL(raw.trim());
    return u.protocol === "https:" ? u.toString() : null;
  } catch {
    return null;
  }
}
