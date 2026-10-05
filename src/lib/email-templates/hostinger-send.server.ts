/**
 * Server-only: sends ONE service-bill alert through the Hostinger
 * relay configured by NOTIFY_EMAIL_ENDPOINT / NOTIFY_EMAIL_API_KEY /
 * HOSTINGER_SENDER_EMAIL. Used only for service-bill alerts; sign-in codes and
 * password resets stay on the managed email system.
 * There is deliberately no managed-email fallback for these alerts.
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
  const endpoint = process.env["NOTIFY_EMAIL_ENDPOINT"];
  const sender = process.env["HOSTINGER_SENDER_EMAIL"]?.trim().toLowerCase();
  if (!endpoint || !process.env["NOTIFY_EMAIL_API_KEY"] || sender !== "info@winstonebd.com") {
    return false;
  }
  try {
    return new URL(endpoint).protocol === "https:";
  } catch {
    return false;
  }
}

export async function sendViaHostinger(
  to: string,
  stage: string,
  idempotencyKey: string,
): Promise<void> {
  if (!hostingerConfigured()) throw new Error("Hostinger service-bill email is not configured");
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
