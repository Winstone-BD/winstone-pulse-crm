/**
 * Server-only: sends ONE service-bill alert through the Hostinger
 * relay configured by NOTIFY_EMAIL_ENDPOINT / NOTIFY_EMAIL_API_KEY /
 * HOSTINGER_SENDER_EMAIL. Used only for service-bill alerts; sign-in codes and
 * password resets stay on the managed email system.
 * Returns false when not configured so callers can fall back.
 */
import { MAINTENANCE_FEE_LABEL } from "@/lib/maintenance-rules";

export type HostingerServiceBillPayload = {
  sender: string;
  recipient: string;
  subject: string;
  body: string;
};

export function buildHostingerServiceBillPayload(input: {
  sender: string;
  recipient: string;
  stage: string;
}): HostingerServiceBillPayload {
  return {
    sender: input.sender,
    recipient: input.recipient,
    subject: `Service-Bill Alert: ${input.stage} - Winstone CRM`,
    body: `This is a service-bill alert for Winstone CRM at ${input.stage}. The required fee is ${MAINTENANCE_FEE_LABEL}.`,
  };
}

export function hostingerConfigured(): boolean {
  return Boolean(
    process.env["NOTIFY_EMAIL_ENDPOINT"] &&
      process.env["NOTIFY_EMAIL_API_KEY"] &&
      process.env["HOSTINGER_SENDER_EMAIL"],
  );
}

export async function sendViaHostinger(
  to: string,
  stage: string,
  idempotencyKey: string,
): Promise<void> {
  const endpoint = process.env["NOTIFY_EMAIL_ENDPOINT"]!;
  const apiKey = process.env["NOTIFY_EMAIL_API_KEY"]!;
  const from = process.env["HOSTINGER_SENDER_EMAIL"]!;
  const payload = buildHostingerServiceBillPayload({ sender: from, recipient: to, stage });

  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      "Idempotency-Key": idempotencyKey,
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`Hostinger relay responded ${res.status}`);
}
