/**
 * Winstone OS → CRM bridge: pure signature and schema rules (no database).
 * HMAC-SHA256 over `${timestamp}.${rawBody}`, hex encoded, max 300s skew.
 */
import { z } from "zod";

export const OS_MAX_SKEW_SECONDS = 300;
export const OS_EVENT_TYPES = [
  "booking.created",
  "booking.updated",
  "booking.cancelled",
  "payment.updated",
] as const;

const uuid = z.string().uuid();

export const osEventSchema = z
  .object({
    event_id: z.string().min(1).max(200),
    event_type: z.enum(OS_EVENT_TYPES),
    occurred_at: z.string().datetime({ offset: true }),
    data: z
      .object({
        lead_id: uuid.optional(),
        crm_booking_id: uuid.optional(),
        os_booking_id: z.string().max(200).optional(),
        status: z.string().max(60).optional(),
        amount_usd: z.number().finite().nonnegative().optional(),
        payment_status: z.string().max(60).optional(),
        note: z.string().max(1000).optional(),
      })
      .strict(),
  })
  .strict();

export type OsEvent = z.infer<typeof osEventSchema>;

export const IDEMPOTENCY_KEY_RE = /^[A-Za-z0-9._:-]{8,200}$/;

export type VerifyFailure =
  | "missing_signature"
  | "missing_timestamp"
  | "stale_timestamp"
  | "invalid_signature"
  | "missing_idempotency_key"
  | "invalid_idempotency_key";

export async function hmacHex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function verifyOsRequest(input: {
  secret: string;
  rawBody: string;
  timestamp: string | null;
  signature: string | null;
  idempotencyKey: string | null;
  nowSeconds?: number;
}): Promise<VerifyFailure | null> {
  if (!input.signature) return "missing_signature";
  if (!input.timestamp) return "missing_timestamp";
  const ts = Number(input.timestamp);
  const now = input.nowSeconds ?? Math.floor(Date.now() / 1000);
  if (!/^\d{9,11}$/.test(input.timestamp) || Math.abs(now - ts) > OS_MAX_SKEW_SECONDS) {
    return "stale_timestamp";
  }
  const provided = input.signature.replace(/^sha256=/i, "").toLowerCase();
  const expected = await hmacHex(input.secret, `${input.timestamp}.${input.rawBody}`);
  if (!safeEqual(provided, expected)) return "invalid_signature";
  if (!input.idempotencyKey) return "missing_idempotency_key";
  if (!IDEMPOTENCY_KEY_RE.test(input.idempotencyKey)) return "invalid_idempotency_key";
  return null;
}

export async function sha256Hex(text: string): Promise<string> {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
