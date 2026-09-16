# V1 → V2 সম্পূর্ণ Migration Mapping Plan (column-level, analysis only)

- V1: " V 0.02 CRM - WINSTONE PROPERTIES LTD" — ৫৭ table
- V2: এই project — ৫৫ entry (৫২ table + ৩ helper view/function টাইপ: `lead_phone_keys` বাদে `lead_phone_status`, `filter_eligible_lead_ids` আসলে function)
- ভিত্তি: দুই project-এর generated schema type ফাইলের field-by-field তুলনা (read-only snapshot)
- **এই ডকুমেন্ট তৈরি করতে কোনো row copy/insert/update/delete বা schema change করা হয়নি।**

আগের সংক্ষিপ্ত সংস্করণ: `docs/migration-mapping-v1-to-v2.md`। এই ফাইলটি তার column-level পূর্ণ রূপ।

---

## ১. সারসংক্ষেপ

| শ্রেণি | সংখ্যা |
| --- | --- |
| একই নাম, হুবহু একই column (direct 1:1) | ৪১ |
| একই নাম, field পার্থক্য (transform দরকার) | ৫ |
| শুধু V1-এ (V2-তে target নেই) | ১১ |
| শুধু V2-এ (V1 source নেই) | ৯ |

Column type-level কোনো conflict নেই — যেসব table দুই দিকেই আছে, সেখানে একই নামের column-এর type সবসময় এক। অর্থাৎ ঝুঁকি type cast-এ নয়, বরং **অনুপস্থিত column, enum মান, duplicate phone, storage path ও auth link**-এ।

---

## ২. Enum মান রূপান্তর

| Enum | V1 | V2 | নিয়ম |
| --- | --- | --- | --- |
| `app_role` | admin, team_leader, agent, **sales_team_admin** | admin, team_leader, agent | `sales_team_admin` → `admin`; Abu Haidar (`WIN2607`) হলে quota নিয়ম কোডে ১৫/day হিসেবেই থাকবে |
| `agent_presence` | on_call, idle, offline | একই | direct |
| `call_direction` | outgoing, incoming_callback | একই | direct |
| `call_sentiment` | positive, neutral, negative, critical | একই | direct |
| `lead_status` | pending, contacted, follow_up, closed | একই | direct |
| `message_type` | text, voice_note, image, document | একই | direct |
| `sender_type` | agent, customer | একই | direct |
| `sync_status` | uploaded, verified, failed | একই | direct |

`requested_role`-এও একই `app_role` map প্রযোজ্য।

---

## ৩. Import ক্রম (FK নির্ভরতা অনুযায়ী)

1. `profiles` → `user_roles` (V2-তে `profiles_sync_role` trigger নিজেই role সিঙ্ক করে, তাই `user_roles` আলাদা import বাদ দেওয়া যায়)
2. `agent_devices`
3. `leads` (trigger `claim_lead_phone_keys` → `lead_phone_keys` অটো তৈরি; `sync_lead_owner_columns` owner column মিলিয়ে দেয়)
4. `lead_assignments`, `lead_events`, `lead_classifications`, `lead_extra_grants`
5. `call_recordings` → `call_processing_jobs`, `call_reports` → `follow_up_events`
6. `whatsapp_interactions`, `consent_records`, `do_not_contact`
7. `support_customers` → `support_conversations` → `support_messages`, `support_tickets` → `support_ticket_events`, `support_notes`, `support_csat`
8. `agent_support_tickets` → `team_support_tickets`, `agent_support_replies` → `team_support_replies`
9. content/config: `doc_pages`, `support_article_categories` → `support_articles`, `support_canned_replies`, `support_settings`, `app_config`, `system_settings`, `app_releases`
10. billing/ops: `service_invoices`, `subscriptions`, `shift_summaries`, `ai_usage_events`, `audit_logs`, `sync_events`, `webhook_deliveries`, `system_alerts`, `custom_reports`, `lead_year_archives`, `drive_agent_folders`, `recording_drive_backups`, `recording_doc_backups`, `ai_voice_sessions` → `ai_voice_turns`

---

## ৪. Direct 1:1 table (column হুবহু এক, transform নেই)

`agent_devices`, `ai_voice_sessions`, `ai_voice_turns`, `app_config`, `app_releases`, `audit_logs`, `call_processing_jobs`, `call_recordings`, `call_reports`, `consent_records`, `custom_reports`, `do_not_contact`, `doc_pages`, `drive_agent_folders`, `follow_up_events`, `lead_assignments`, `lead_classifications`, `lead_events`, `lead_year_archives`, `recording_doc_backups`, `recording_drive_backups`, `shift_summaries`, `subscriptions`, `support_article_categories`, `support_articles`, `support_canned_replies`, `support_conversations`, `support_csat`, `support_customers`, `support_messages`, `support_notes`, `support_settings`, `support_ticket_events`, `support_tickets`, `sync_events`, `system_alerts`, `system_settings`, `user_roles`, `webhook_deliveries`, `whatsapp_interactions`

নিয়ম: একই `id` (UUID) রাখা হবে → সব FK অপরিবর্তিত থাকে এবং re-run করলে duplicate হয় না (`ON CONFLICT (id) DO NOTHING`)।

---

## ৫. Transform দরকার — column-by-column

### 5.1 `leads` → `leads`

**Direct (নাম ও type এক):** `id`, `name`, `phone_number`, `company`, `address`, `serial_no`, `reference_by`, `status`, `outcome_category`, `is_verified`, `call_attempts`, `call_count`, `last_call_at`, `notes`, `source`, `assigned_to`, `assigned_agent_id`, `assignment_source`, `temperature`, `grade`, `classification_note`, `classified_at`, `classified_by`, `work_state`, `work_date`, `created_at`, `updated_at`

| V1 column | V2 target | নিয়ম |
| --- | --- | --- |
| `phone_canon` | — | V2-এর `normalize_bd_phone()` + `lead_phone_keys` একই কাজ করে → শুধু pre-migration duplicate check-এ ব্যবহার, store নয় |
| `assignment_kind` | `assignment_source` | manual → `manual`; auto/daily → `daily_pool`; ফাঁকা → `manual`। V1-এ দুটোই থাকলে `assignment_source` জেতে |
| `email` | — | **সিদ্ধান্ত ১** |
| `profession`, `sector`, `city_area`, `lead_type`, `lead_quality`, `best_channel`, `next_action`, `outreach_bn`, `outreach_en` | — | **সিদ্ধান্ত ১** (নতুন nullable column বা `notes`-এ লেবেলযুক্ত blockে merge) |
| `data_completeness`, `missing_fields` | — | derived মান → বাদ |

### 5.2 `profiles` → `profiles`

**Direct:** `id`, `user_id`, `name`, `phone`, `email`, `avatar_hue`, `role`, `requested_role`, `is_active`, `status`, `presence`, `current_call_started_at`, `last_active_at`, `employee_id`, `pin_hash`, `approval_status`, `sim_number`, `sim_bound_at`, `created_at`

| V1 column | V2 target | নিয়ম |
| --- | --- | --- |
| `daily_lead_quota` | — | V2-তে quota কোডে (`lead-quota.ts`: সাধারণ ২৫, `WIN2607` ১৫)। V1 মান ভিন্ন হলে report-এ mismatch তালিকা, schema বদল নয় — **সিদ্ধান্ত ২** |
| `designation` | `status` অথবা বাদ | **সিদ্ধান্ত ২** |

`pin_hash` hash হিসেবেই copy হবে, কখনো plaintext নয়। `role = sales_team_admin` → `admin`।

### 5.3 `service_invoices` → `service_invoices`

V2-তে primary key `period` (মাসে একটি invoice), V1-এ `id`।

| V1 | V2 | নিয়ম |
| --- | --- | --- |
| `period_month` (বা `period_start`) | `period` | `YYYY-MM` key |
| `period_start`, `period_end` | — | `period` থেকেই derive হয় → বাদ |
| `amount` + `currency` | `amount_bdt` | `currency = BDT` হলে সরাসরি; নাহলে skip + report |
| `billing_date` | `due_at` | direct |
| `reference` | `payment_ref` | direct |
| `id` | — | V2-তে নেই |
| `status`, `paid_at`, `service_active_until`, `note`, `created_at`, `updated_at` | একই | direct (status মান `due/verifying/paid/overdue/failed`-এর বাইরে হলে `due`) |
| — | `grace_until` | `due_at + 3 days` |
| — | `system_share_bdt` / `architect_share_bdt` | `paid` হলে ৩০০০ / ১০০০, নাহলে ০ |
| — | `payout_status` | `paid` হলে `paid`, নাহলে `pending` |
| — | `verified_at`, `verified_by`, `verified_by_label`, `payment_method`, `split_at`, `payout_at`, `payout_ref` | V1-এ source নেই → NULL |

একই মাসে V1-এ একাধিক invoice থাকলে সর্বশেষ/paid-টি জেতে, বাকিগুলো report-only।

### 5.4 `lead_extra_grants` → `lead_extra_grants`

**Direct:** `id`, `agent_profile_id`, `work_date`, `reason`, `source`, `created_at`

| V1 | V2 |
| --- | --- |
| `granted_count` | `quantity` |
| `actor_profile_id` | `granted_by` |
| `actor_label` | `granted_by_label` |
| `delivered_count` | — (report-only) |

### 5.5 `ai_usage_events` → `ai_usage_events`

**Direct:** `id`, `category`, `model`, `units`, `est_credits`, `actor_profile_id`, `detail`, `created_at`

| V1 | V2 | নিয়ম |
| --- | --- | --- |
| `operation` | `category` | `category` ফাঁকা হলে `operation`; মান V2-এর সেট (`command_agent`, `transcription`, `analysis`, `doc_summary`, `other`)-এ না পড়লে `other` |
| `input_units + output_units` | `units` | যোগফল (`units` থাকলে সেটিই) |
| `cost_credits` | `est_credits` | direct |
| `provider`, `unit_kind`, `status`, `latency_ms`, `currency`, `cost_amount`, `rate_card_id` | `detail` | JSON-ish text-এ merge |
| `idempotency_key` | — | migration script-এর dedupe key, store নয় |

### 5.6 `agent_support_tickets` → `team_support_tickets` (নাম বদল)

| V1 | V2 |
| --- | --- |
| `id`, `ref`, `agent_profile_id`, `agent_name`, `category`, `subject`, `message`, `priority`, `status`, `platform`, `assigned_role`, `resolution_note`, `resolved_at`, `last_message_at`, `created_at`, `updated_at` | একই নাম |
| `agent_role` (nullable) | `agent_role` (NOT NULL) → NULL হলে `agent` |
| `device` | `device_label` |
| `assignee_profile_id` | `assigned_profile_id` |
| `read_at` | `unread_for_admin` = (`read_at IS NULL`), `unread_for_agent` = false |
| — | `attachment_url` NULL; `reply_count` = reply গণনা থেকে derive |

### 5.7 `agent_support_replies` → `team_support_replies`

| V1 | V2 |
| --- | --- |
| `id`, `ticket_id`, `body`, `created_at` | direct |
| `author_side` | `author_kind` (agent/admin মান map) |
| `author_name` | `author_label` |
| `author_profile_id` | `author_profile_id` |
| `platform` | — (report-only) |

---

## ৬. শুধু V1-এ আছে — target নেই

| V1 table | প্রস্তাব |
| --- | --- |
| `billing_invoices`, `billing_invoice_lines`, `billing_allocations`, `billing_budgets` | V2-তে `service_invoices` + `ai_usage_events` একই কাজ করে → ঐতিহাসিক ডেটা রাখতে হলে V2-তে নতুন table দরকার — **সিদ্ধান্ত ৩** |
| `payment_transactions` | `service_invoices.payment_ref`/`payment_method`-এ summarize, নয়তো archive-only। `payload` JSON-এ card/PII থাকলে import নয় |
| `architect_payouts` | `service_invoices.payout_status/payout_at/payout_ref`-এ summarize |
| `architect_payout_profiles` | `account_number_encrypted` **কখনো** copy নয়; দরকার হলে শুধু `account_number_masked`-এর শেষ ৪ সংখ্যা `system_settings`-এ |
| `provider_rate_cards` | V2-তে rate কোডে (`credits-rates.ts`) → `system_settings` row হিসেবে archive |
| `app_artifact_checksums` | V2-এর `app_releases`-এ checksum column নেই → archive-only |

---

## ৭. শুধু V2-এ আছে — V1 source নেই

| V2 | কীভাবে ভরবে |
| --- | --- |
| `lead_phone_keys` | `leads` insert-এ trigger থেকে auto |
| `lead_distribution_runs` | migration-এর পরের দিন থেকে শুরু |
| `push_tokens`, `push_deliveries` | device re-register করলেই আসবে |
| `team_support_admins` | হাতে seed (Haidar + admin) |
| `team_support_tickets`, `team_support_replies` | V1 `agent_support_*` থেকে (§5.6, §5.7) |
| `lead_phone_status`, `filter_eligible_lead_ids` | function/view — import নয় |

---

## ৮. ঝুঁকি ও যাচাই তালিকা

1. **Auth link** — `profiles.user_id` `auth.users`-কে দেখায়। V1-এর auth user V2-তে না থাকলে `user_id` NULL রেখে পরে re-link; `auth` schema-তে সরাসরি লেখা হবে না। `pin_hash` থাকলে PIN লগইন কাজ করবে, password লগইন re-invite লাগবে।
2. **Duplicate phone** — V2-এর `lead_phone_keys.canonical_phone` unique এবং `claim_lead_phone_keys` trigger একই canonical phone-এ দ্বিতীয় lead reject করে। তাই import-এর **আগে** V1-এ `normalize_bd_phone()` অনুযায়ী duplicate report লাগবে; নাহলে batch মাঝপথে থামবে।
3. **অবৈধ phone** — trigger বৈধ BD mobile না পেলে row reject করে (`no valid Bangladesh mobile phone found`) → এমন V1 lead আগে আলাদা তালিকায়।
4. **First-assignment gate** — `enforce_first_lead_assignment_eligibility` trigger পুরনো assign করা lead-এ বাধা দিতে পারে; তাই lead insert-এই `assigned_to` সহ ঢুকবে (পরে UPDATE নয়)।
5. **Report lock** — `validate_call_report` trigger অসম্পূর্ণ পুরনো report reject করতে পারে → `status` `pending` রেখে import, নয়তো field পূরণ করে।
6. **Lead completion gate** — `enforce_lead_completion`: `work_state = completed` হলে `temperature` ও `grade` থাকতেই হবে → না থাকলে `work_state` `in_progress`।
7. **Storage** — `call_recordings.storage_path`/`audio_url` V1 bucket-এর দিকে। ফাইল কপি না করলে প্লেব্যাক ভাঙবে → আলাদা file-migration ধাপ (bucket `call-audio`, একই path রেখে)।
8. **Idempotency** — সব step একই `id` + `ON CONFLICT DO NOTHING`; `service_invoices` `period`-এ conflict; `ai_usage_events` V1 `idempotency_key`-এ dedupe।
9. **RLS/GRANT** — import privileged session-এ; কোনো policy শিথিল করা হবে না।
10. **Row count** — এই রিপোর্ট schema-ভিত্তিক; আসল volume V1-এ read-only count query চালিয়ে যোগ করতে হবে।

---

## ৯. আপনার কাছ থেকে যে ৩টি সিদ্ধান্ত দরকার

1. `leads`-এর অতিরিক্ত V1 field (`email`, `profession`, `sector`, `city_area`, `lead_type`, `lead_quality`, `best_channel`, `next_action`, `outreach_bn`, `outreach_en`) — V2-তে নতুন nullable column হিসেবে যোগ করব, নাকি `notes`-এ merge করব, নাকি বাদ?
2. `profiles.designation` ও `daily_lead_quota` — V2-তে সংরক্ষণ করব, নাকি V2-এর quota নিয়ম (২৫ / Haidar ১৫) চূড়ান্ত?
3. V1-এর পুরনো billing/payout ইতিহাস (`billing_invoices`, `payment_transactions`, `architect_payouts`) V2-তে চাই, নাকি শুধু archive?
