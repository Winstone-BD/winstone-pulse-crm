/**
 * Server-only: sends ONE service-bill alert through the official Hostinger
 * Mail API (https://api.mail.hostinger.com, POST /api/v1/mailboxes/{id}/send)
 * from the fixed mailbox info@winstonebd.com. The bearer token is
 * NOTIFY_EMAIL_API_KEY; the mailbox resource id is resolved via GET /api/v1/me,
 * so no relay URL or sender secret is needed. Used only for service-bill
 * alerts; sign-in codes and password resets stay on the managed email system.
 * There is deliberately no managed-email fallback for these alerts.
 */
import { MAINTENANCE_FEE_LABEL } from "@/lib/maintenance-rules";

export const HOSTINGER_MAIL_API = "https://api.mail.hostinger.com";
/** Fixed business sender mailbox — not a secret. */
export const SERVICE_BILL_SENDER = "info@winstonebd.com";

export type HostingerServiceBillPayload = {
  to: string[];
  displayName: string;
  subject: string;
  text: string;
};

export function buildHostingerServiceBillPayload(input: {
  recipient: string;
  stage: string;
  reviewUrl?: string;
}): HostingerServiceBillPayload {
  const reviewLine = input.reviewUrl ? `\n\nReview securely: ${input.reviewUrl}` : "";
  return {
    to: [input.recipient],
    displayName: "Winstone IT Team",
    subject: `Service-Bill Alert: ${input.stage} - Winstone CRM`,
    text: `WINSTONE CRM — SERVICE BILL ALERT\n\nStatus: ${input.stage}\nAmount: ${MAINTENANCE_FEE_LABEL}\n\nThis notice requires authorized human review. It does not execute or approve a payment.${reviewLine}`,
  };
}

function token(): string | null {
  return process.env["NOTIFY_EMAIL_API_KEY"]?.trim() || null;
}

export function hostingerConfigured(): boolean {
  return Boolean(token());
}

/** Resolves the resource id of info@winstonebd.com that this token may manage. */
async function senderMailboxId(apiKey: string): Promise<string> {
  const res = await fetch(`${HOSTINGER_MAIL_API}/api/v1/me`, {
    headers: { Authorization: `Bearer ${apiKey}`, Accept: "application/json" },
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error(`Hostinger Mail API account check responded ${res.status}`);
  const body = (await res.json()) as {
    data?: { mailboxes?: Array<{ resourceId?: string; address?: string }> };
  };
  const box = body.data?.mailboxes?.find(
    (m) => m.address?.trim().toLowerCase() === SERVICE_BILL_SENDER,
  );
  if (!box?.resourceId) throw new Error(`Hostinger token cannot send as ${SERVICE_BILL_SENDER}`);
  return box.resourceId;
}

/** Read-only readiness probe (no email sent). */
export async function hostingerReadiness(): Promise<{ ok: boolean; reason?: string }> {
  const apiKey = token();
  if (!apiKey) return { ok: false, reason: "NOTIFY_EMAIL_API_KEY" };
  try {
    await senderMailboxId(apiKey);
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: e instanceof Error ? e.message : "unreachable" };
  }
}

/** Confirmed contract: OS relay at NOTIFY_EMAIL_ENDPOINT (https only), Bearer NOTIFY_EMAIL_API_KEY. */
export function relayEndpoint(): string | null {
  const ep = process.env["NOTIFY_EMAIL_ENDPOINT"]?.trim() ?? "";
  return /^https:\/\/[^\s]+$/.test(ep) ? ep : null;
}

export function senderAddress(): string {
  const s = process.env["HOSTINGER_SENDER_EMAIL"]?.trim().toLowerCase();
  return s === SERVICE_BILL_SENDER ? s : SERVICE_BILL_SENDER;
}

async function sendViaRelay(endpoint: string, apiKey: string, to: string, stage: string, key: string) {
  const p = buildHostingerServiceBillPayload({
    recipient: to,
    stage,
    reviewUrl: "https://crm.winstonebd.com/service-bill-unlock",
  });
  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      "Idempotency-Key": key,
    },
    body: JSON.stringify({ from: senderAddress(), to: p.to, subject: p.subject, text: p.text, idempotency_key: key }),
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`Email relay responded ${res.status}`);
}

export async function sendViaHostinger(
  to: string,
  stage: string,
  idempotencyKey: string,
): Promise<void> {
  const apiKey = token();
  if (!apiKey) throw new Error("Service-bill email is not configured (NOTIFY_EMAIL_API_KEY REQUIRED)");
  const relay = relayEndpoint();
  if (relay) return sendViaRelay(relay, apiKey, to, stage, idempotencyKey);
  const mailboxId = await senderMailboxId(apiKey);
  const payload = buildHostingerServiceBillPayload({
    recipient: to,
    stage,
    reviewUrl: "https://crm.winstonebd.com/service-bill-unlock",
  });
  const res = await fetch(
    `${HOSTINGER_MAIL_API}/api/v1/mailboxes/${encodeURIComponent(mailboxId)}/send`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(15000),
    },
  );
  if (!res.ok) {
    const err = (await res.json().catch(() => null)) as { code?: string; error?: string } | null;
    const notAllowed = /allow list/i.test(err?.error ?? "");
    throw new Error(
      notAllowed
        ? "Hostinger refused: recipient is not on the mailbox allow list"
        : `Hostinger Mail API send responded ${res.status}${err?.code ? ` (${err.code})` : ""}`,
    );
  }
}
