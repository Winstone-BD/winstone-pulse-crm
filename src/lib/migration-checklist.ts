/**
 * V1 → V2 migration checklist catalogue.
 *
 * The items mirror `docs/migration-plan-v1-to-v2-full.md` exactly: the three
 * decisions the owner must make, every V1 field with no V2 target, and the
 * known migration risks. Only the per-item *tracking state* (status + note) is
 * stored in the database; the catalogue itself lives here so the report and the
 * dashboard can never drift apart.
 */

export type ChecklistKind = "decision" | "unmapped" | "risk";

export type ChecklistStatus = "open" | "in_progress" | "resolved" | "skipped";

export type ChecklistItem = {
  id: string;
  kind: ChecklistKind;
  title: string;
  /** Which V1/V2 tables or columns the item is about. */
  scope: string;
  detail: string;
  /** Suggested handling, straight from the mapping report. */
  suggestion: string;
};

export const CHECKLIST_KIND_LABEL: Record<ChecklistKind, string> = {
  decision: "সিদ্ধান্ত দরকার",
  unmapped: "target নেই",
  risk: "ঝুঁকি",
};

export const CHECKLIST_STATUS_LABEL: Record<ChecklistStatus, string> = {
  open: "বাকি",
  in_progress: "কাজ চলছে",
  resolved: "সমাধান হয়েছে",
  skipped: "বাদ দেওয়া হয়েছে",
};

export const CHECKLIST_STATUSES: ChecklistStatus[] = [
  "open",
  "in_progress",
  "resolved",
  "skipped",
];

export const MIGRATION_CHECKLIST: ChecklistItem[] = [
  // ── ৩টি সিদ্ধান্ত ─────────────────────────────────────────────
  {
    id: "decision-leads-extra-fields",
    kind: "decision",
    title: "leads-এর অতিরিক্ত V1 field কোথায় যাবে?",
    scope: "leads: email, profession, sector, city_area, lead_type, lead_quality, best_channel, next_action, outreach_bn, outreach_en",
    detail:
      "V2-এর leads table-এ এই ১০টি column নেই। ঠিক করতে হবে — নতুন nullable column হিসেবে যোগ হবে, notes-এ লেবেলযুক্ত ব্লকে merge হবে, নাকি বাদ যাবে।",
    suggestion:
      "email ও profession নতুন nullable column; বাকি বর্ণনামূলক field notes-এ merge — এতে schema হালকা থাকে।",
  },
  {
    id: "decision-profile-quota",
    kind: "decision",
    title: "profiles.designation ও daily_lead_quota রাখব?",
    scope: "profiles: designation, daily_lead_quota",
    detail:
      "V2-তে quota কোডে নির্ধারিত (সাধারণ এজেন্ট ২৫/দিন, Abu Haidar WIN2607 ১৫/দিন)। V1-এর সংরক্ষিত মান ভিন্ন হলে কোনটি চূড়ান্ত হবে তা ঠিক করতে হবে।",
    suggestion:
      "V2-এর quota নিয়মই চূড়ান্ত; V1 mismatch শুধু রিপোর্টে দেখানো হবে। designation → status-এ রাখা যায়।",
  },
  {
    id: "decision-billing-history",
    kind: "decision",
    title: "পুরনো billing/payout ইতিহাস V2-তে দরকার?",
    scope: "billing_invoices, billing_invoice_lines, billing_allocations, billing_budgets, payment_transactions, architect_payouts",
    detail:
      "V2-তে service_invoices + ai_usage_events একই উদ্দেশ্য পূরণ করে। পুরো ইতিহাস চাইলে V2-তে নতুন table দরকার হবে।",
    suggestion:
      "শুধু archive হিসেবে রাখা — নতুন table নয়; দরকারি সারসংক্ষেপ service_invoices-এর payout field-এ।",
  },

  // ── target নেই এমন field ─────────────────────────────────────
  {
    id: "unmapped-leads-derived",
    kind: "unmapped",
    title: "leads.data_completeness ও missing_fields",
    scope: "leads (V1 only)",
    detail: "দুটোই derived মান — V2-তে সমমান কোনো column নেই।",
    suggestion: "বাদ; দরকার হলে V2-তেই নতুন করে হিসাব হবে।",
  },
  {
    id: "unmapped-leads-phone-canon",
    kind: "unmapped",
    title: "leads.phone_canon",
    scope: "leads (V1 only)",
    detail:
      "V2-তে normalize_bd_phone() + lead_phone_keys একই কাজ করে, তাই আলাদা column নেই।",
    suggestion: "store নয় — শুধু import-এর আগে duplicate যাচাইয়ে ব্যবহার হবে।",
  },
  {
    id: "unmapped-lead-extra-delivered",
    kind: "unmapped",
    title: "lead_extra_grants.delivered_count",
    scope: "lead_extra_grants (V1 only)",
    detail: "V2-তে শুধু quantity আছে; কতটি সত্যিই দেওয়া হয়েছে তা আলাদা রাখা হয় না।",
    suggestion: "report-only; মাইগ্রেশন রিপোর্টে সংখ্যা লিখে রাখা।",
  },
  {
    id: "unmapped-ai-usage-cost",
    kind: "unmapped",
    title: "ai_usage_events-এর বিস্তারিত cost field",
    scope: "provider, unit_kind, status, latency_ms, currency, cost_amount, rate_card_id, idempotency_key",
    detail: "V2-তে category/units/est_credits/detail — কম column, তাই বাকিগুলো আলাদা থাকবে না।",
    suggestion: "detail field-এ JSON-ish text হিসেবে merge; idempotency_key শুধু dedupe key।",
  },
  {
    id: "unmapped-service-invoice-ids",
    kind: "unmapped",
    title: "service_invoices.id, period_start, period_end, currency",
    scope: "service_invoices (V1 only)",
    detail: "V2-তে period (YYYY-MM) নিজেই primary key; মাসে একটি invoice।",
    suggestion:
      "period থেকে derive; একই মাসে V1-এ একাধিক invoice থাকলে paid/সর্বশেষটি জেতে, বাকিগুলো রিপোর্টে।",
  },
  {
    id: "unmapped-billing-tables",
    kind: "unmapped",
    title: "৪টি billing table-এর V2 ঠিকানা নেই",
    scope: "billing_invoices, billing_invoice_lines, billing_allocations, billing_budgets",
    detail: "V2-তে সমমান কোনো table নেই — সিদ্ধান্তের উপর নির্ভরশীল।",
    suggestion: "সিদ্ধান্ত ৩-এর সাথে একসাথে মীমাংসা।",
  },
  {
    id: "unmapped-payment-transactions",
    kind: "unmapped",
    title: "payment_transactions",
    scope: "payment_transactions (V1 only)",
    detail:
      "provider payload JSON-এ সংবেদনশীল তথ্য থাকতে পারে; V2-তে শুধু payment_ref/payment_method আছে।",
    suggestion: "সারসংক্ষেপ service_invoices-এ; payload কখনো import নয়।",
  },
  {
    id: "unmapped-architect-payout",
    kind: "unmapped",
    title: "architect_payouts ও architect_payout_profiles",
    scope: "architect_payouts, architect_payout_profiles",
    detail:
      "V2-তে service_invoices.payout_status/payout_at/payout_ref-এ সারসংক্ষেপ থাকে; ব্যাংক অ্যাকাউন্টের আলাদা table নেই।",
    suggestion:
      "account_number_encrypted কখনো copy নয়; দরকার হলে শুধু শেষ ৪ সংখ্যা system_settings-এ।",
  },
  {
    id: "unmapped-rate-cards",
    kind: "unmapped",
    title: "provider_rate_cards",
    scope: "provider_rate_cards (V1 only)",
    detail: "V2-তে rate কোডে (credits-rates.ts) নির্ধারিত।",
    suggestion: "system_settings-এ একটি row হিসেবে archive।",
  },
  {
    id: "unmapped-artifact-checksums",
    kind: "unmapped",
    title: "app_artifact_checksums",
    scope: "app_artifact_checksums (V1 only)",
    detail: "V2-এর app_releases-এ checksum column নেই।",
    suggestion: "archive-only।",
  },
  {
    id: "unmapped-support-platform",
    kind: "unmapped",
    title: "agent_support_replies.platform",
    scope: "agent_support_replies → team_support_replies",
    detail: "V2-এর team_support_replies-এ platform রাখা হয় না (ticket-এ আছে)।",
    suggestion: "ticket-এর platform-ই যথেষ্ট; reply-এর মান বাদ।",
  },

  // ── ঝুঁকি ────────────────────────────────────────────────────
  {
    id: "risk-auth-link",
    kind: "risk",
    title: "লগইন অ্যাকাউন্ট পুনঃসংযোগ",
    scope: "profiles.user_id → auth.users",
    detail:
      "V1-এর লগইন ব্যবহারকারী V2-তে না থাকলে user_id NULL রেখে পরে re-link করতে হবে; auth-এ সরাসরি লেখা হবে না।",
    suggestion: "pin_hash সহ import → PIN লগইন চলবে; password লগইনে re-invite।",
  },
  {
    id: "risk-duplicate-phone",
    kind: "risk",
    title: "একই ফোনে duplicate lead",
    scope: "lead_phone_keys (unique) + claim_lead_phone_keys trigger",
    detail: "V2-এর trigger একই canonical phone-এর দ্বিতীয় lead reject করে — batch মাঝপথে থামতে পারে।",
    suggestion: "import-এর আগে V1-এ duplicate report তৈরি করে মীমাংসা।",
  },
  {
    id: "risk-invalid-phone",
    kind: "risk",
    title: "অবৈধ ফোন নম্বরের lead",
    scope: "leads.phone_number",
    detail: "বৈধ বাংলাদেশি মোবাইল না পেলে trigger row reject করে।",
    suggestion: "আগে আলাদা তালিকা করে হাতে ঠিক করা।",
  },
  {
    id: "risk-first-assignment-gate",
    kind: "risk",
    title: "প্রথম assignment gate",
    scope: "enforce_first_lead_assignment_eligibility trigger",
    detail: "পুরনো assign করা lead পরে UPDATE করলে trigger বাধা দিতে পারে।",
    suggestion: "insert-এই assigned_to সহ ঢোকানো, পরে UPDATE নয়।",
  },
  {
    id: "risk-report-lock",
    kind: "risk",
    title: "পুরনো অসম্পূর্ণ কল রিপোর্ট",
    scope: "validate_call_report trigger",
    detail: "submitted অবস্থায় category/summary/note না থাকলে reject হবে।",
    suggestion: "status pending রেখে import, নয়তো field পূরণ করে।",
  },
  {
    id: "risk-lead-completion",
    kind: "risk",
    title: "completed lead-এ শ্রেণিবিন্যাস বাধ্যতামূলক",
    scope: "enforce_lead_completion trigger",
    detail: "work_state = completed হলে temperature ও grade থাকতেই হবে।",
    suggestion: "না থাকলে work_state in_progress রেখে import।",
  },
  {
    id: "risk-storage-files",
    kind: "risk",
    title: "রেকর্ডিং ফাইল আলাদা করে কপি",
    scope: "call_recordings.storage_path / audio_url",
    detail: "path V1 bucket-এর দিকে; ফাইল কপি না করলে প্লেব্যাক ভাঙবে।",
    suggestion: "call-audio bucket-এ একই path রেখে আলাদা file-migration ধাপ।",
  },
  {
    id: "risk-idempotency",
    kind: "risk",
    title: "পুনরায় চালালে duplicate না হওয়া",
    scope: "সব table",
    detail: "একই id + ON CONFLICT DO NOTHING; service_invoices period-এ conflict।",
    suggestion: "প্রতিটি ধাপ audit-logged এবং re-runnable রাখা।",
  },
  {
    id: "risk-rls-grant",
    kind: "risk",
    title: "RLS/GRANT অপরিবর্তিত রাখা",
    scope: "সব public table",
    detail: "import privileged session-এ হবে; কোনো policy শিথিল করা হবে না।",
    suggestion: "import শেষে linter চালিয়ে যাচাই।",
  },
  {
    id: "risk-row-count",
    kind: "risk",
    title: "আসল row count এখনো যোগ হয়নি",
    scope: "V1 সব table",
    detail: "রিপোর্ট schema-ভিত্তিক; প্রকৃত volume জানা নেই।",
    suggestion: "V1-এ read-only count query চালিয়ে সংখ্যা যোগ করা।",
  },
];

export type ChecklistState = { status: ChecklistStatus; note: string; updatedAt: string | null };

export const DEFAULT_STATE: ChecklistState = { status: "open", note: "", updatedAt: null };

export type ChecklistProgress = {
  total: number;
  resolved: number;
  inProgress: number;
  open: number;
  skipped: number;
  percent: number;
};

export function checklistProgress(
  states: Record<string, ChecklistState>,
  items: ChecklistItem[] = MIGRATION_CHECKLIST,
): ChecklistProgress {
  let resolved = 0;
  let inProgress = 0;
  let skipped = 0;
  for (const item of items) {
    const status = states[item.id]?.status ?? "open";
    if (status === "resolved") resolved += 1;
    else if (status === "in_progress") inProgress += 1;
    else if (status === "skipped") skipped += 1;
  }
  const total = items.length;
  const done = resolved + skipped;
  return {
    total,
    resolved,
    inProgress,
    skipped,
    open: total - done - inProgress,
    percent: total ? Math.round((done / total) * 100) : 0,
  };
}
