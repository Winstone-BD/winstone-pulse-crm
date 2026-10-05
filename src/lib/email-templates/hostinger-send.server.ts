/**
 * Server-only: sends ONE rendered registered template through the Hostinger
 * relay configured by NOTIFY_EMAIL_ENDPOINT / NOTIFY_EMAIL_API_KEY /
 * HOSTINGER_SENDER_EMAIL. Used only for service-bill alerts; sign-in codes and
 * password resets stay on the managed email system.
 * Returns false when not configured so callers can fall back.
 */
import * as React from "react";
import { render } from "@react-email/render";
import { TEMPLATES } from "./registry";

export function hostingerConfigured(): boolean {
  return Boolean(
    process.env["NOTIFY_EMAIL_ENDPOINT"] &&
      process.env["NOTIFY_EMAIL_API_KEY"] &&
      process.env["HOSTINGER_SENDER_EMAIL"],
  );
}

export async function sendViaHostinger(
  templateName: string,
  to: string,
  templateData: Record<string, unknown>,
  idempotencyKey: string,
): Promise<void> {
  const endpoint = process.env["NOTIFY_EMAIL_ENDPOINT"]!;
  const apiKey = process.env["NOTIFY_EMAIL_API_KEY"]!;
  const from = process.env["HOSTINGER_SENDER_EMAIL"]!;
  const template = TEMPLATES[templateName];
  if (!template) throw new Error(`Template '${templateName}' not found`);
  const element = React.createElement(template.component, templateData);
  const html = await render(element);
  const text = await render(element, { plainText: true });
  const subject =
    typeof template.subject === "function" ? template.subject(templateData) : template.subject;

  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      "Idempotency-Key": idempotencyKey,
    },
    body: JSON.stringify({ from, to, subject, html, text }),
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`Hostinger relay responded ${res.status}`);
}
