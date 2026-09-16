# V1 → V2 ডেটা মাইগ্রেশন ম্যাপিং প্ল্যান (শুধু analysis, কোনো data move নয়)

- V1: " V 0.02 CRM - WINSTONE PROPERTIES LTD" (৫৬ table)
- V2: এই project (৫২ table)
- ভিত্তি: দুই project-এর generated schema type ফাইলের field-by-field তুলনা
- এই ডকুমেন্টে কোনো row copy/insert/delete করা হয়নি

## ১. সারসংক্ষেপ

৪৫টি table দুই দিকেই একই নামে আছে এবং অধিকাংশে field একদম মিল — তাই ম্যাপিং সরাসরি `same name → same name`। মাত্র ৫টি table-এ field-level পার্থক্য আছে, ১১টি table শুধু V1-এ, ৭টি শুধু V2-এ।

| শ্রেণি | সংখ্যা | ব্যবস্থা |
| --- | --- | --- |
| হুবহু মিল (direct copy) | ৪০ | ১:১ ম্যাপিং |
| field পার্থক্য আছে | ৫ | transform নিয়ম দরকার |
| শুধু V1-এ | ১১ | V2-তে target নেই → সিদ্ধান্ত দরকার |
| শুধু V2-এ | ৭ | V1-এ source নেই → খালি থাকবে/derive |

## ২. মাইগ্রেশন ক্রম (foreign key নির্ভরতা অনুযায়ী)

1. `profiles` → তারপর `user_roles`
2. `agent_devices`, `push_tokens`
3. `leads` → `lead_phone_keys` (V2-তে trigger থেকে derive), `lead_assignments`, `lead_events`, `lead_classifications`, `lead_extra_grants`
4. `call_recordings` → `call_processing_jobs`, `call_reports`, `follow_up_events`
5. `whatsapp_interactions`, `consent_records`, `do_not_contact`
6. support স্তর: `support_customers` → `support_conversations` → `support_messages`, `support_tickets`, `support_ticket_events`, `support_notes`, `support_csat`
7. content/config: `doc_pages`, `support_articles(+categories)`, `app_config`, `system_settings`, `app_releases`
8. billing/ops: `service_invoices`, `subscriptions`, `shift_summaries`, `ai_usage_events`, `audit_logs`, `sync_events`, `webhook_deliveries`, `system_alerts`, `custom_reports`, `lead_year_archives`, drive/doc backup tables

## ৩. ১:১ ম্যাপিং (কোনো transform নেই)

`agent_devices`, `ai_voice_sessions`, `ai_voice_turns`, `app_config`, `app_releases`, `audit_logs`, `call_processing_jobs`, `call_recordings`, `call_reports`, `consent_records`, `custom_reports`, `do_not_contact`, `doc_pages`, `drive_agent_folders`, `follow_up_events`, `lead_assignments`, `lead_classifications`, `lead_events`, `lead_year_archives`, `recording_doc_backups`, `recording_drive_backups`, `shift_summaries`, `subscriptions`, `support_article_categories`, `support_articles`, `support_canned_replies`, `support_conversations`, `support_csat`, `support_customers`, `support_messages`, `support_notes`, `support_settings`, `support_ticket_events`, `support_tickets`, `sync_events`, `system_alerts`, `system_settings`, `user_roles`, `webhook_deliveries`, `whatsapp_interactions`

নিয়ম: একই `id` (UUID) রাখা হবে, যাতে সব foreign key অপরিবর্তিত থাকে এবং re-run করলেও duplicate না হয় (`ON CONFLICT (id) DO NOTHING`)।

## ৪. Transform দরকার এমন table

### 4.1 `leads`
V1-এর অতিরিক্ত column: `phone_canon`, `email`, `lead_type`, `sector`, `profession`, `city_area`, `best_channel`, `lead_quality`, `data_completeness`, `missing_fields`, `next_action`, `outreach_bn`, `outreach_en`, `assignment_kind`।

| V1 field | V2 target | নিয়ম |
| --- | --- | --- |
| `phone_canon` | (নেই) | V2-এর `normalize_bd_phone()` + `lead_phone_keys` একই কাজ করে → বাদ, শুধু duplicate check-এ ব্যবহার |
| `assignment_kind` | `assignment_source` | মান map: manual → `manual`, auto/daily → `daily_pool` |
| `email`, `profession`, `sector`, `city_area`, `lead_type`, `lead_quality`, `best_channel`, `next_action`, `outreach_bn`, `outreach_en` | `notes` (একত্রে) অথবা নতুন nullable column | সিদ্ধান্ত দরকার — নিচের প্রশ্ন ১ |
| `data_completeness`, `missing_fields` | (নেই) | derived, বাদ |
| বাকি সব (name, phone_number, company, status, outcome_category, is_verified, call_attempts, last_call_at, notes, source, assigned_to/assigned_agent_id, temperature, grade, classification_*, work_state, work_date) | একই নাম | direct |

### 4.2 `profiles`
| V1 | V2 | নিয়ম |
| --- | --- | --- |
| `daily_lead_quota` | (নেই) | V2-তে quota কোডে নির্ধারিত (সাধারণ agent ২৫, Haidar `WIN2607` ১৫)। V1 মান ভিন্ন হলে report-এ mismatch তালিকা দেবে, schema বদল নয় |
| `designation` | `status` বা বাদ | সিদ্ধান্ত দরকার — প্রশ্ন ২ |
| বাকি (user_id, name, phone, avatar_hue, role, is_active, presence, employee_id, pin_hash, approval_status, requested_role, email, sim_number …) | একই নাম | direct; `pin_hash` hash হিসেবেই copy, কখনো plaintext নয় |

`role` enum: V1/V2 উভয়ে `admin, team_leader, agent`। V1-এ `sales_team_admin` ধরনের designation থাকলে সেটি V2-তে `admin` + Haidar-এর নিয়মে ম্যাপ হবে।

### 4.3 `service_invoices`
| V1 | V2 |
| --- | --- |
| `period_month` / `period_start` | `period` (মাসের key) |
| `amount` + `currency` | `amount_bdt` (currency ≠ BDT হলে skip + report) |
| `billing_date` | `due_at` |
| `reference` | `payment_ref` |
| `id` | V2-এ নেই (`period` primary) → invoice প্রতি মাসে একটি |
| — | `grace_until` = `due_at + 3 days`; `system_share_bdt` = 3000, `architect_share_bdt` = 1000 শুধু `paid` হলে; `payout_status` = `pending` |

### 4.4 `lead_extra_grants`
| V1 | V2 |
| --- | --- |
| `granted_count` | `quantity` |
| `delivered_count` | (নেই) → report-only |
| `actor_profile_id` | `granted_by` |
| `actor_label` | `granted_by_label` |

### 4.5 `ai_usage_events`
V1-এ বিস্তারিত cost/rate-card field (`provider`, `operation`, `input_units`, `output_units`, `cost_credits`, `cost_amount`, `currency`, `latency_ms`, `status`, `rate_card_id`, `idempotency_key`, `unit_kind`)।

| V1 | V2 |
| --- | --- |
| `operation` | `category` |
| `input_units + output_units` | `units` |
| `cost_credits` | `est_credits` |
| `provider`, `latency_ms`, `status`, `currency`, `cost_amount` | `detail` (JSON-ish text) |
| `idempotency_key` | (নেই) → dedupe key হিসেবে migration script-এ ব্যবহার, store নয় |

## ৫. শুধু V1-এ আছে (V2-তে target নেই)

| V1 table | প্রস্তাব |
| --- | --- |
| `billing_invoices`, `billing_invoice_lines`, `billing_allocations`, `billing_budgets` | V2-এর `service_invoices` + `ai_usage_events` একই উদ্দেশ্য পূরণ করে → ঐতিহাসিক ডেটা দরকার হলে V2-তে নতুন table লাগবে (প্রশ্ন ৩) |
| `payment_transactions` | V2-এর `service_invoices.payment_ref/payment_method`-এ summarize, নয়তো archive-only |
| `architect_payouts`, `architect_payout_profiles` | V2-এর `service_invoices.payout_*` field-এ summarize; account number কখনো plaintext নয়, শেষ ৪ সংখ্যা মাত্র |
| `provider_rate_cards` | V2-তে rate কোডে/`system_settings`-এ → `system_settings` row হিসেবে move |
| `agent_support_tickets`, `agent_support_replies` | V2-এর `team_support_tickets`, `team_support_replies`-এ ম্যাপ (নাম বদল, field প্রায় এক; `ref`, `assigned_role`, `unread_for_*`, `reply_count`, `last_message_at` derive) |
| `app_artifact_checksums` | V2-এর `app_releases`-এ checksum না থাকায় archive-only |

## ৬. শুধু V2-এ আছে (V1 source নেই)

`lead_phone_keys` (leads insert-এ trigger থেকে auto), `lead_distribution_runs` (নতুন দিন থেকে শুরু), `push_tokens`/`push_deliveries` (device re-register করলেই আসবে), `team_support_admins` (হাতে seed), `team_support_tickets`/`team_support_replies` (V1 agent_support_* থেকে)।

## ৭. ঝুঁকি ও যাচাই তালিকা

1. **Auth user** — `profiles.user_id` `auth.users`-কে দেখায়। V1-এর auth user V2-তে না থাকলে `user_id` NULL রেখে পরে re-link করতে হবে; কখনো `auth` schema-তে সরাসরি লেখা হবে না।
2. **Storage** — `call_recordings.storage_path`/`audio_url` V1 bucket-এর দিকে। ফাইল কপি না করলে link ভাঙবে → আলাদা file migration ধাপ।
3. **Duplicate lead** — V2-এর `lead_phone_keys` unique; V1-এ একই canonical phone-এ একাধিক lead থাকলে migration আটকাবে → আগে duplicate report লাগবে।
4. **Report lock** — V2-এর `validate_call_report` trigger; পুরনো incomplete report reject হতে পারে → `submitted_at` NULL রেখে import বা trigger-safe order।
5. **RLS/GRANT** — import privileged session-এ; কোনো policy শিথিল করা হবে না।
6. **Idempotency** — সব step `ON CONFLICT (id) DO NOTHING`, প্রতিটি ধাপ audit-logged।
7. **Row count** — এই report V1-এর live row count ছাড়া তৈরি; আসল volume V1 project-এ read-only query চালিয়ে যোগ করতে হবে।

## ৮. যে ৩টি সিদ্ধান্ত দরকার

1. `leads`-এর অতিরিক্ত V1 field (email, profession, sector, city_area, outreach text) — V2-তে নতুন nullable column হিসেবে যোগ করব, নাকি `notes`-এ merge করব?
2. `profiles.designation` ও `daily_lead_quota` — V2-তে সংরক্ষণ করব, নাকি V2-এর quota নিয়মই চূড়ান্ত?
3. V1-এর পুরনো billing/payout ইতিহাস (billing_invoices, payment_transactions, architect_payouts) V2-তে দরকার, নাকি শুধু archive হিসেবে রাখব?
