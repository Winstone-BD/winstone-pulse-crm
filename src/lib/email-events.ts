import { z } from "zod";
import { sha256Hex, verifyBearer } from "@/lib/os-bridge";

/** Hostinger Mail webhook contract: Bearer <webhook secret>, event message.received. */
export const EMAIL_EVENT_MAX_BYTES = 256_000;
export const EMAIL_EVENT_TYPES = ["message.received"] as const;

const eventSchema = z
  .object({
    event: z.string().min(1).max(64).optional(),
    type: z.string().min(1).max(64).optional(),
    id: z.union([z.string(), z.number()]).optional(),
    data: z.record(z.string(), z.unknown()).optional(),
  })
  .passthrough();

export type EmailEventCheck =
  | { ok: true; eventType: string; eventKey: string; mailbox: string | null; payloadHash: string }
  | { ok: false; status: number; error: string };

function pickString(obj: Record<string, unknown> | undefined, keys: string[]): string | null {
  for (const k of keys) {
    const v = obj?.[k];
    if (typeof v === "string" && v.length > 0 && v.length <= 320) return v;
    if (typeof v === "number") return String(v);
  }
  return null;
}

export async function checkEmailEvent(input: {
  secret: string | undefined;
  authorization: string | null;
  rawBody: string;
}): Promise<EmailEventCheck> {
  if (!input.secret) return { ok: false, status: 503, error: "receiver_not_configured" };
  if (!input.authorization) return { ok: false, status: 401, error: "missing_authorization" };
  if (!verifyBearer(input.secret, input.authorization))
    return { ok: false, status: 401, error: "invalid_authorization" };
  if (input.rawBody.length > EMAIL_EVENT_MAX_BYTES)
    return { ok: false, status: 413, error: "payload_too_large" };
  let parsed: unknown;
  try {
    parsed = JSON.parse(input.rawBody);
  } catch {
    return { ok: false, status: 400, error: "invalid_json" };
  }
  const ev = eventSchema.safeParse(parsed);
  if (!ev.success) return { ok: false, status: 422, error: "invalid_event" };
  const eventType = ev.data.event ?? ev.data.type ?? "";
  if (!(EMAIL_EVENT_TYPES as readonly string[]).includes(eventType))
    return { ok: false, status: 422, error: "unsupported_event_type" };
  const payloadHash = await sha256Hex(input.rawBody);
  const data = ev.data.data;
  const msgId = pickString(data, ["messageId", "message_id", "uid", "id"]) ??
    (ev.data.id != null ? String(ev.data.id) : null);
  const mailbox = pickString(data, ["mailbox", "to"]);
  // Stable key: provider message id when present, else the body hash (exact retries collapse).
  const eventKey = `hostinger:${eventType}:${msgId ?? payloadHash}`;
  return { ok: true, eventType, eventKey, mailbox, payloadHash };
}
