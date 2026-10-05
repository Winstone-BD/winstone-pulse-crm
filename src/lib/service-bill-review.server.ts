import { createHash, timingSafeEqual } from "node:crypto";
import { getRequestIP, useSession as getServerSession } from "@tanstack/react-start/server";

import { dhakaPeriod } from "@/lib/maintenance-rules";
import {
  missingServiceBillEmailSecrets,
  serviceBillPayload,
  type ServiceBillPayload,
} from "@/lib/service-bill-review";

const FAILURE_LIMIT = 5;
const FAILURE_WINDOW_MS = 15 * 60 * 1000;
const REVIEW_SESSION_SECONDS = 15 * 60;

type Reviewer = { userId: string; email: string };

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

function digest(value: string): Buffer {
  return createHash("sha256").update(value, "utf8").digest();
}

function secureEqual(value: string, expected: string): boolean {
  return timingSafeEqual(digest(value), digest(expected));
}

function reviewSessionConfig() {
  const password = process.env["ADMIN_TOKEN_SECRET"];
  if (!password) throw new Error("Review session is not configured");
  return {
    password,
    name: "winstone-service-bill-review",
    maxAge: REVIEW_SESSION_SECONDS,
    cookie: {
      httpOnly: true,
      sameSite: "strict" as const,
      secure: process.env["NODE_ENV"] === "production",
      path: "/",
    },
  };
}

async function reviewSession() {
  return getServerSession<{ userId?: string; email?: string; expiresAt?: number }>(
    reviewSessionConfig(),
  );
}

function ipHash(): string {
  const ip = getRequestIP({ xForwardedFor: true }) ?? "unknown";
  const pepper = process.env["ADMIN_TOKEN_SECRET"] ?? "unconfigured";
  return createHash("sha256").update(`${pepper}:${ip}`, "utf8").digest("hex");
}

async function recordAttempt(reviewer: Reviewer, success: boolean, reasonCode: string) {
  const client = await admin();
  await client.from("service_bill_review_attempts").insert({
    actor_user_id: reviewer.userId,
    actor_email: reviewer.email,
    ip_hash: ipHash(),
    success,
    reason_code: reasonCode,
  });
  const { audit } = await import("@/lib/maintenance.server");
  await audit({
    actor: reviewer.email,
    actorRole: "admin_reviewer",
    action: success ? "service_bill_review_unlocked" : `service_bill_review_${reasonCode}`,
    period: dhakaPeriod(),
    metadata: { credential_recorded: false },
  });
}

async function failedAttempts(reviewer: Reviewer): Promise<number> {
  const client = await admin();
  const { count } = await client
    .from("service_bill_review_attempts")
    .select("id", { count: "exact", head: true })
    .eq("actor_user_id", reviewer.userId)
    .eq("ip_hash", ipHash())
    .eq("success", false)
    .gte("attempted_at", new Date(Date.now() - FAILURE_WINDOW_MS).toISOString());
  return count ?? 0;
}

export async function unlockServiceBillReview(reviewer: Reviewer, pin: string) {
  const expected = process.env["SERVICE_BILL_UNLOCK_PIN"];
  if (!expected) {
    await recordAttempt(reviewer, false, "configuration_missing");
    return {
      ok: false as const,
      error: "Configuration required",
      missing: ["SERVICE_BILL_UNLOCK_PIN"],
    };
  }
  if ((await failedAttempts(reviewer)) >= FAILURE_LIMIT) {
    await recordAttempt(reviewer, false, "rate_limited");
    return {
      ok: false as const,
      error: "Too many attempts. Try again in 15 minutes.",
      missing: [],
    };
  }
  if (!secureEqual(pin, expected)) {
    await recordAttempt(reviewer, false, "invalid_pin");
    return { ok: false as const, error: "Invalid review PIN", missing: [] };
  }
  const session = await reviewSession();
  await session.update({
    userId: reviewer.userId,
    email: reviewer.email,
    expiresAt: Date.now() + REVIEW_SESSION_SECONDS * 1000,
  });
  await recordAttempt(reviewer, true, "success");
  return { ok: true as const };
}

export async function hasServiceBillReviewSession(reviewer: Reviewer): Promise<boolean> {
  const session = await reviewSession();
  return (
    session.data.userId === reviewer.userId &&
    session.data.email === reviewer.email &&
    (session.data.expiresAt ?? 0) > Date.now()
  );
}

export async function clearServiceBillReviewSession() {
  const session = await reviewSession();
  await session.clear();
}

export async function currentServiceBill(
  recipient: string,
  markReviewed: Reviewer | null,
): Promise<ServiceBillPayload> {
  const client = await admin();
  const period = dhakaPeriod();
  let { data: row, error } = await client
    .from("system_maintenance")
    .select("id, created_at, due_date, review_status, reviewed_by, reviewed_at")
    .eq("billing_period", period)
    .maybeSingle();
  if (error) throw new Error("Service bill is unavailable");
  if (!row) {
    const { maintenanceAccess } = await import("@/lib/maintenance.server");
    await maintenanceAccess();
    const result = await client
      .from("system_maintenance")
      .select("id, created_at, due_date, review_status, reviewed_by, reviewed_at")
      .eq("billing_period", period)
      .single();
    row = result.data;
    error = result.error;
  }
  if (error || !row) throw new Error("Service bill is unavailable");

  if (markReviewed && row.review_status === "pending_review") {
    const reviewedAt = new Date().toISOString();
    const { data: updated } = await client
      .from("system_maintenance")
      .update({
        review_status: "in_review",
        reviewed_by: markReviewed.email,
        reviewed_at: reviewedAt,
      })
      .eq("id", row.id)
      .eq("review_status", "pending_review")
      .select("id, created_at, due_date, review_status, reviewed_by, reviewed_at")
      .maybeSingle();
    if (updated) {
      row = updated;
      const { audit } = await import("@/lib/maintenance.server");
      await audit({
        actor: markReviewed.email,
        actorRole: "admin_reviewer",
        action: "service_bill_details_viewed",
        period,
        previous: "pending_review",
        next: "in_review",
      });
    }
  }
  return serviceBillPayload(row, recipient);
}

/** Names of missing OR invalid settings (never values). */
export function serviceBillEmailConfiguration() {
  const missing = missingServiceBillEmailSecrets({
    NOTIFY_EMAIL_ENDPOINT: process.env["NOTIFY_EMAIL_ENDPOINT"],
    NOTIFY_EMAIL_API_KEY: process.env["NOTIFY_EMAIL_API_KEY"],
    HOSTINGER_SENDER_EMAIL: process.env["HOSTINGER_SENDER_EMAIL"],
    SERVICE_BILL_APPROVER_EMAIL: process.env["SERVICE_BILL_APPROVER_EMAIL"],
  });
  let httpsOk = false;
  try {
    httpsOk = new URL(process.env["NOTIFY_EMAIL_ENDPOINT"] ?? "").protocol === "https:";
  } catch {
    httpsOk = false;
  }
  if (!httpsOk && !missing.includes("NOTIFY_EMAIL_ENDPOINT")) missing.push("NOTIFY_EMAIL_ENDPOINT (must be https URL)");
  const sender = process.env["HOSTINGER_SENDER_EMAIL"]?.trim().toLowerCase();
  if (sender && sender !== "info@winstonebd.com") missing.push("HOSTINGER_SENDER_EMAIL (must be info@winstonebd.com)");
  return missing;
}
