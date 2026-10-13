/**
 * Server-only: email approval links for CRM unlock requests.
 * Token = HMAC(ADMIN_TOKEN_SECRET) over request id + expiry; 2h lifetime.
 * Single use is enforced by architectDecide (request must still be "requested").
 */
import { createHmac, timingSafeEqual } from "node:crypto";

export const EMAIL_LINK_MS = 2 * 60 * 60 * 1000;
const APP_URL = "https://crm.winstonebd.com";

function secret() {
  const s = process.env["ADMIN_TOKEN_SECRET"];
  if (!s) throw new Error("Session secret is not configured");
  return s;
}
function sign(id: string, exp: number) {
  return createHmac("sha256", secret()).update(`unlock-email:v1:${id}:${exp}`).digest("hex");
}
export function approverEmail(): string {
  const v = process.env["SERVICE_BILL_APPROVER_EMAIL"]?.trim().toLowerCase();
  return v && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v) ? v : "zhemongrowth@gmail.com";
}
export function mintUnlockEmailToken(requestId: string, now = Date.now()): string {
  const exp = now + EMAIL_LINK_MS;
  return `${requestId}.${exp}.${sign(requestId, exp)}`;
}
export function verifyUnlockEmailToken(token: string, now = Date.now()): { requestId: string; expiresAt: number } | null {
  const [id, expRaw, sig] = (token ?? "").split(".");
  const exp = Number(expRaw);
  if (!id || !sig || !Number.isFinite(exp) || exp <= now) return null;
  const expected = sign(id, exp);
  if (sig.length !== expected.length || !timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  return { requestId: id, expiresAt: exp };
}

export async function sendUnlockApprovalEmail(input: { requestId: string; requestedBy: string; hours: number; reason: string | null; paymentVerified: boolean }) {
  const { sendHostingerText } = await import("@/lib/email-templates/hostinger-send.server");
  const { audit } = await import("@/lib/maintenance.server");
  const to = approverEmail();
  const link = `${APP_URL}/unlock-approve?t=${encodeURIComponent(mintUnlockEmailToken(input.requestId))}`;
  const text = `WINSTONE PULSE — CRM UNLOCK REQUEST\n\nRequested by: ${input.requestedBy}\nDuration: ${input.hours} hour(s)\nPayment verified: ${input.paymentVerified ? "Yes" : "NO"}\nReason: ${input.reason ?? "-"}\n\nApprove & Unlock CRM (link valid 2 hours, single use):\n${link}\n\nOpening the link does not unlock anything; you must press "Confirm" on the page. If you did not expect this, ignore this email.`;
  try {
    await sendHostingerText(to, "Approve CRM Unlock — Winstone Pulse", text, `unlock-email-${input.requestId}`);
    await audit({ actor: "system", actorRole: "system", action: "unlock_email_sent", requestId: input.requestId, metadata: { recipient: to } });
    return { emailed: true };
  } catch (e) {
    await audit({ actor: "system", actorRole: "system", action: "unlock_email_failed", requestId: input.requestId, metadata: { error: e instanceof Error ? e.message : "unknown" } });
    return { emailed: false };
  }
}
