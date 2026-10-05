# ফিচার তালিকা / Feature map

প্রতিটি ফিচার — কোন পাতা, কোন লজিক ফাইল, কোন টেবিল।

## লিড

| ফিচার                         | পাতা                   | লজিক                                          | টেবিল                    |
| ----------------------------- | ---------------------- | --------------------------------------------- | ------------------------ |
| লিড ইম্পোর্ট (Excel/CSV)      | `/import`              | `lead-import.functions.ts`, `csv-leads.ts`    | `leads`                  |
| ডুপ্লিকেট-ফোন সুরক্ষা         | —                      | `lead-phone.ts`, `lead-eligibility.server.ts` | `lead_phone_keys`        |
| দৈনিক বিতরণ (২৫ / হায়দার ১৫) | cron + `/dispatch`     | `lead-pool.server.ts`, `lead-quota.ts`        | `lead_distribution_runs` |
| অতিরিক্ত লিড মঞ্জুরি          | `/system`, `/dispatch` | `grantExtraLeads()`                           | `lead_extra_grants`      |
| এজেন্ট ডেস্ক ও মোবাইল কিউ     | `/desk`                | `agent-desk.functions.ts`                     | `leads`                  |
| ফলো-আপ ক্যালেন্ডার/সপ্তাহ     | `/desk`                | `crm.functions.ts`                            | `leads`                  |

## কল

| ফিচার                          | পাতা          | লজিক                                                    |
| ------------------------------ | ------------- | ------------------------------------------------------- |
| নিজের সিমে কল + রেকর্ডিং       | অ্যান্ড্রয়েড | `agent-sim.server.ts`, `api/public/*`                   |
| রেকর্ডিং পাইপলাইন ও রিট্রাই    | `/system`     | `recording-drive.server.ts`, `analysis-queue.server.ts` |
| ট্রান্সক্রিপ্ট + AI সারসংক্ষেপ | —             | `transcribe.functions.ts`, `call-intel.server.ts`       |
| পোস্ট-কল রিপোর্ট বাধ্যতামূলক   | `/desk`       | `call-reports.server.ts`, `PostCallReportGate`          |
| WhatsApp লগ ও ইনবক্স           | `/desk`       | `whatsapp.functions.ts`, `whatsapp-status.ts`           |

## রিপোর্ট ও ইনসাইট

| ফিচার                                | পাতা                      | লজিক                                               |
| ------------------------------------ | ------------------------- | -------------------------------------------------- |
| Executive HQ বোর্ড + ড্রিল-ডাউন      | `/hq`                     | `hq-brief.server.ts`, `HqDrillSheet`               |
| এক্সিকিউটিভ রিপোর্ট                  | `/reports`                | `crm-reports.ts`, `report-summary.functions.ts`    |
| শিফট সারসংক্ষেপ (১২:৫০, ৫:৩০)        | `/hq`                     | `shift-summary.server.ts`, `shift-sheet.server.ts` |
| সেরা পারফর্মার + "কাল আরও ভালো করতে" | `/`                       | `top-performer.server.ts`                          |
| স্মার্ট ইনসাইট স্ট্রিপ               | `/desk` `/hq` `/dispatch` | `SmartInsightStrip`                                |
| Winstone AI সহকারী                   | ৪ পাতায়                  | `copilot.server.ts`, `command-agent.server.ts`     |

## টিম ও সাপোর্ট

| ফিচার                               | পাতা                         | লজিক                                        | টেবিল                              |
| ----------------------------------- | ---------------------------- | ------------------------------------------- | ---------------------------------- |
| অ্যাকাউন্ট অনুমোদন                  | `/system`                    | `accounts.functions.ts`                     | `profiles`                         |
| টিম সাপোর্ট (এজেন্ট → টিম অ্যাডমিন) | `/desk`                      | `team-support.server.ts`                    | `team_support_tickets`, `_replies` |
| টিম সাপোর্ট ইনবক্স                  | `/desk`                      | `team-support-access.server.ts`             | —                                  |
| কাস্টমার সাপোর্ট ডেস্ক (ইংরেজি)     | `/support`, `/support-admin` | `support.server.ts`, `support-ai.server.ts` | `support_*`                        |

## সিস্টেম ও বিলিং

| ফিচার                                        | পাতা                           | লজিক                               | টেবিল                              |
| -------------------------------------------- | ------------------------------ | ---------------------------------- | ---------------------------------- |
| আইটি কনসোল (PIN)                             | `/system`                      | `admin-gate.server.ts`             | `system_settings`                  |
| অডিট ট্রেইল                                  | `/system`                      | `audit.server.ts`                  | `audit_log`                        |
| মাসিক $46.29 maintenance lock + verification | `/hq`, `/system`, `/architect` | `maintenance.server.ts`            | `system_maintenance`               |
| বিল due/overdue অ্যালার্ট (অ্যাপ+পুশ+ইমেইল)  | cron                           | `service-billing-alerts.server.ts` | `system_alerts`, `push_deliveries` |
| ক্রেডিট ব্যবহার রিপোর্ট                      | `/credits`                     | `credits-report.functions.ts`      | —                                  |
| বার্ষিক সংরক্ষণ                              | `/system`                      | `YearArchivePanel`                 | —                                  |
