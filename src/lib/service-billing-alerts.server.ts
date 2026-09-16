/**
 * Automatic reminders for the monthly ৳4,000 service bill.
 *
 * Three stages per period, each fired at most once: the bill is coming up
 * (3 days before the 15th), the bill is due, and the grace window closed so it
 * is overdue. Every stage writes one in-app alert row for HQ/IT and sends one
 * push to every admin and team-leader device. Idempotency comes from two
 * places: `system_alerts` is checked for the same code + period before
 * inserting, and `sendPush` claims a unique event key per period and stage, so
 * repeated cron runs never re-notify.
 *
 * Nothing here changes billing state — it only reads invoices and reminds.
 */

import { logAudit } from "@/lib/audit.server";
import { sendPush } from "@/lib/push.server";
import {
  dhakaPeriod,
  ensureInvoice,
  invoiceHistory,
  refreshOverdue,
  type ServiceInvoice,
} from "@/lib/service-billing.server";

const DUE_SOON_DAYS = 3;

export type AlertStage = "due_soon" | "due" | "overdue";

const STAGE_CODE: Record<AlertStage, string> = {
  due_soon: "service_bill_due_soon",
  due: "service_bill_due",
  overdue: "service_bill_overdue",
};

const STAGE_SEVERITY: Record<AlertStage, string> = {
  due_soon: "info",
  due: "warning",
  overdue: "critical",
};

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

function dhakaDate(value: string): string {
  return new Date(value).toLocaleDateString("bn-BD", {
    timeZone: "Asia/Dhaka",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/** Which reminder, if any, this unpaid invoice deserves right now. */
export function stageFor(invoice: ServiceInvoice, now = new Date()): AlertStage | null {
  if (invoice.status === "paid") return null;
  const at = now.getTime();
  const due = new Date(invoice.dueAt).getTime();
  const grace = new Date(invoice.graceUntil).getTime();
  if (at > grace) return "overdue";
  if (at >= due) return "due";
  if (at >= due - DUE_SOON_DAYS * 24 * 60 * 60 * 1000) return "due_soon";
  return null;
}

function copyFor(invoice: ServiceInvoice, stage: AlertStage) {
  const amount = `৳${invoice.amountBdt.toLocaleString("bn-BD")}`;
  if (stage === "due_soon") {
    return {
      title: `${invoice.period} সার্ভিস বিল সামনে — ${amount}`,
      detail: `মেয়াদ ${dhakaDate(invoice.dueAt)}; গ্রেস ${dhakaDate(invoice.graceUntil)} পর্যন্ত। পেমেন্টের পর IT কনসোলে যাচাই করলে সার্ভিস চালু থাকবে।`,
    };
  }
  if (stage === "due") {
    return {
      title: `${invoice.period} সার্ভিস বিল বকেয়া — ${amount}`,
      detail: `আজ মেয়াদ শেষ (${dhakaDate(invoice.dueAt)})। ${dhakaDate(invoice.graceUntil)} পর্যন্ত গ্রেস; এরপর সার্ভিস বন্ধ হয়ে যাবে।`,
    };
  }
  return {
    title: `${invoice.period} সার্ভিস বিল মেয়াদোত্তীর্ণ — ${amount}`,
    detail: `গ্রেস শেষ হয়েছে ${dhakaDate(invoice.graceUntil)}। পেমেন্ট যাচাই না হওয়া পর্যন্ত সার্ভিস চালু হবে না।`,
  };
}

/** HQ (authority) and IT accounts — the only people this bill concerns. */
async function recipients(): Promise<{ ids: string[]; emails: string[] }> {
  const supabaseAdmin = await admin();
  const { data } = await supabaseAdmin
    .from("profiles")
    .select("id,email")
    .in("role", ["admin", "team_leader"])
    .eq("is_active", true)
    .eq("approval_status", "approved");
  const rows = data ?? [];
  const emails = Array.from(
    new Set(
      rows
        .map((row) => (typeof row.email === "string" ? row.email.trim().toLowerCase() : ""))
        .filter((value) => value.includes("@")),
    ),
  );
  return { ids: rows.map((row) => row.id), emails };
}

const STAGE_LABEL: Record<AlertStage, string> = {
  due_soon: "মেয়াদ সামনে",
  due: "মেয়াদ শেষ",
  overdue: "মেয়াদোত্তীর্ণ",
};

/**
 * One email per HQ/IT recipient per period+stage. The idempotency key is
 * derived from period, stage and recipient, so repeated cron runs never
 * re-send. A suppressed recipient is an expected outcome, not an error.
 */
async function emailRecipients(
  invoice: ServiceInvoice,
  stage: AlertStage,
  copy: { title: string; detail: string },
  emails: string[],
): Promise<{ sent: number; skipped: number; failed: number }> {
  if (emails.length === 0) return { sent: 0, skipped: 0, failed: 0 };
  const { sendTemplateEmail } = await import("@/lib/email-templates/send-email");
  let sent = 0;
  let skipped = 0;
  let failed = 0;
  for (const email of emails) {
    try {
      const result = await sendTemplateEmail("service-bill-alert", email, {
        idempotencyKey: `service-bill-${invoice.period}-${stage}-${email}`,
        templateData: {
          title: copy.title,
          detail: copy.detail,
          period: invoice.period,
          amount: `৳${invoice.amountBdt.toLocaleString("bn-BD")}`,
          stageLabel: STAGE_LABEL[stage],
        },
      });
      if (result.sent) sent += 1;
      else skipped += 1;
    } catch (error) {
      failed += 1;
      console.error("service bill alert email failed", email, error);
    }
  }
  return { sent, skipped, failed };
}

async function alertAlreadyRaised(code: string, period: string): Promise<boolean> {
  const supabaseAdmin = await admin();
  const { data } = await supabaseAdmin
    .from("system_alerts")
    .select("id")
    .eq("code", code)
    .like("title", `${period}%`)
    .limit(1);
  return (data ?? []).length > 0;
}

export type AlertRun = {
  period: string;
  stage: AlertStage;
  alerted: boolean;
  push: { sent: number; failed: number; skipped?: string };
  email: { sent: number; skipped: number; failed: number };
}[];

/**
 * Checks every open invoice and fires the reminder its current stage needs.
 * Safe to run as often as the schedule likes.
 */
export async function runServiceBillingAlerts(now = new Date()): Promise<AlertRun> {
  await ensureInvoice(dhakaPeriod(now));
  await refreshOverdue();
  const invoices = await invoiceHistory();
  const open = invoices.filter((invoice) => invoice.status !== "paid");
  if (open.length === 0) return [];

  const recipients = await recipientProfileIds();
  const supabaseAdmin = await admin();
  const results: AlertRun = [];

  for (const invoice of open) {
    const stage = stageFor(invoice, now);
    if (!stage) continue;

    const code = STAGE_CODE[stage];
    const { title, detail } = copyFor(invoice, stage);
    let alerted = false;

    if (!(await alertAlreadyRaised(code, invoice.period))) {
      const { error } = await supabaseAdmin.from("system_alerts").insert({
        code,
        severity: STAGE_SEVERITY[stage],
        title,
        detail,
        action: "IT কনসোলে পেমেন্ট যাচাই করুন",
      });
      if (!error) {
        alerted = true;
        await logAudit({
          action: "service_bill_alert_raised",
          entityType: "service_invoice",
          entityId: invoice.period,
          actorLabel: "Billing scheduler",
          metadata: { stage, amountBdt: invoice.amountBdt, status: invoice.status },
        });
      }
    }

    const push = await sendPush({
      eventKey: `service_bill:${invoice.period}:${stage}`,
      kind: code,
      entityId: invoice.period,
      profileIds: recipients,
      payload: { title, body: detail, path: "/hq", data: { period: invoice.period, stage } },
    });

    results.push({ period: invoice.period, stage, alerted, push });
  }

  return results;
}
