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

/* ---------------- Unified bridge envelope (RFC v2) ---------------- */

export const OS_V2_EVENT_TYPES = ["lead_ingested", "site_visit.requested", "enquiry.submitted"] as const;

/** Polymorphic envelope. Detected by the presence of `payload` (legacy uses `data`). */
export const osEnvelopeSchema = z
  .object({
    event_id: z.string().min(1).max(200),
    event_type: z.string().min(1).max(60),
    idempotency_key: z.string().regex(IDEMPOTENCY_KEY_RE).optional(),
    occurred_at: z.string().datetime({ offset: true }),
    payload: z.record(z.string(), z.unknown()),
  })
  .strict();
export type OsEnvelope = z.infer<typeof osEnvelopeSchema>;

const BD_CANONICAL = /^8801[3-9]\d{8}$/;

export const leadIngestedSchema = z
  .object({
    external_lead_id: z.string().trim().min(1).max(200),
    source: z.string().trim().min(1).max(40),
    contact: z
      .object({
        name: z.string().trim().min(1).max(120),
        phone: z.string().trim().min(6).max(24),
        email: z.string().trim().email().max(200).nullable().optional(),
        city: z.string().trim().max(120).nullable().optional(),
      })
      .strict(),
    qualification: z
      .object({
        project_interest: z.string().trim().max(200).nullable().optional(),
        intent_level: z.string().trim().max(40).nullable().optional(),
        budget_range: z.string().trim().max(120).nullable().optional(),
        ai_confidence_score: z.number().min(0).max(1).nullable().optional(),
        score_category: z.string().trim().max(40).nullable().optional(),
        call_summary: z.string().trim().max(2000).nullable().optional(),
      })
      .strict()
      .optional(),
    metadata: z
      .object({
        campaign_id: z.string().trim().max(200).nullable().optional(),
        operator_id: z.string().trim().max(200).nullable().optional(),
      })
      .passthrough()
      .optional(),
  })
  .strict();
export type LeadIngested = z.infer<typeof leadIngestedSchema>;

/** Returns canonical 8801XXXXXXXXX or null when not a Bangladesh mobile. */
export function canonicalBdPhone(raw: string): string | null {
  const d = raw.replace(/\D/g, "");
  const c = /^01[3-9]\d{8}$/.test(d) ? `88${d}` : /^1[3-9]\d{8}$/.test(d) ? `880${d}` : d;
  return BD_CANONICAL.test(c) ? c : null;
}

/** Knowledge Hub (winstonebd.com) site-visit request — a request only, never a confirmed visit. */
export const visitRequestedSchema = z
  .object({
    request_id: z.string().trim().min(1).max(200),
    name: z.string().trim().min(1).max(120),
    phone: z.string().trim().min(6).max(24),
    project: z.string().trim().max(200).nullable().optional(),
    preferred_date: z.string().trim().max(40).nullable().optional(),
    preferred_time: z.string().trim().max(40).nullable().optional(),
    visitors: z.number().int().min(1).max(50).nullable().optional(),
    notes: z.string().trim().max(1000).nullable().optional(),
  })
  .strict();
export type VisitRequested = z.infer<typeof visitRequestedSchema>;

/** Knowledge Hub buyer-portal enquiry — lands as an unassigned LeadHub lead. */
export const enquirySubmittedSchema = z
  .object({
    request_id: z.string().trim().min(1).max(200),
    name: z.string().trim().min(1).max(120),
    phone: z.string().trim().min(6).max(24),
    project: z.string().trim().max(200).nullable().optional(),
    property_type: z.enum(["flat", "land", "commercial", "duplex", "other"]).nullable().optional(),
    budget_min_bdt: z.number().int().min(0).max(100_000_000_000).nullable().optional(),
    budget_max_bdt: z.number().int().min(0).max(100_000_000_000).nullable().optional(),
    facing: z.enum(["north", "south", "east", "west", "north_east", "north_west", "south_east", "south_west"]).nullable().optional(),
    amenities: z.array(z.string().trim().min(1).max(60)).max(20).optional(),
    message: z.string().trim().max(1000).nullable().optional(),
    page_url: z.string().trim().url().max(500).nullable().optional(),
    utm_source: z.string().trim().max(100).nullable().optional(),
    utm_medium: z.string().trim().max(100).nullable().optional(),
    utm_campaign: z.string().trim().max(200).nullable().optional(),
  })
  .strict()
  .refine((p) => p.budget_min_bdt == null || p.budget_max_bdt == null || p.budget_min_bdt <= p.budget_max_bdt, { path: ["budget_max_bdt"] });
export type EnquirySubmitted = z.infer<typeof enquirySubmittedSchema>;

export type V2Parse =
  | { ok: true; kind: "lead_ingested"; envelope: OsEnvelope; lead: LeadIngested; phone: string }
  | { ok: true; kind: "site_visit.requested"; envelope: OsEnvelope; visit: VisitRequested; phone: string }
  | { ok: true; kind: "enquiry.submitted"; envelope: OsEnvelope; enquiry: EnquirySubmitted; phone: string }
  | { ok: false; status: 422; error: string; issues?: string[] };

/** Envelope + discriminator + payload validation. All failures are 422 (non-retryable). */
export function parseV2Envelope(raw: unknown): V2Parse {
  const env = osEnvelopeSchema.safeParse(raw);
  if (!env.success) return { ok: false, status: 422, error: "invalid_envelope", issues: env.error.issues.map((i) => i.path.join(".")) };
  if (env.data.event_type === "enquiry.submitted") {
    const e = enquirySubmittedSchema.safeParse(env.data.payload);
    if (!e.success) return { ok: false, status: 422, error: "invalid_payload", issues: e.error.issues.map((i) => i.path.join(".")) };
    const ep = canonicalBdPhone(e.data.phone);
    if (!ep) return { ok: false, status: 422, error: "invalid_phone", issues: ["phone"] };
    return { ok: true, kind: "enquiry.submitted", envelope: env.data, enquiry: e.data, phone: ep };
  }
  if (env.data.event_type === "site_visit.requested") {
    const v = visitRequestedSchema.safeParse(env.data.payload);
    if (!v.success) return { ok: false, status: 422, error: "invalid_payload", issues: v.error.issues.map((i) => i.path.join(".")) };
    const vp = canonicalBdPhone(v.data.phone);
    if (!vp) return { ok: false, status: 422, error: "invalid_phone", issues: ["phone"] };
    return { ok: true, kind: "site_visit.requested", envelope: env.data, visit: v.data, phone: vp };
  }
  if (env.data.event_type !== "lead_ingested") return { ok: false, status: 422, error: "unsupported_event_type" };
  const lead = leadIngestedSchema.safeParse(env.data.payload);
  if (!lead.success) return { ok: false, status: 422, error: "invalid_payload", issues: lead.error.issues.map((i) => i.path.join(".")) };
  const phone = canonicalBdPhone(lead.data.contact.phone);
  if (!phone) return { ok: false, status: 422, error: "invalid_phone", issues: ["contact.phone"] };
  return { ok: true, kind: "lead_ingested", envelope: env.data, lead: lead.data, phone };
}

/** Constant-time check of `Authorization: Bearer <secret>`. */
export function verifyBearer(secret: string, header: string | null): boolean {
  if (!header?.startsWith("Bearer ")) return false;
  const token = header.slice(7).trim();
  return safeEqual(token, secret);
}
