# ভূমিকা ও অনুমতি / Roles & permissions

একটাই পড়ার জায়গা: **`src/lib/rbac.server.ts`** (সার্ভার গেট) আর **`src/lib/rbac.ts`** (কোন ভূমিকা কী দেখে)। নিয়ম আগের ফাইলেই আছে, rbac শুধু সব একজায়গায় এনেছে।

## ম্যাট্রিক্স

| ভূমিকা | লিড দেখা | বিতরণ | কোটা/সেটিং | আইটি কনসোল | সাপোর্ট ইনবক্স | পাতা |
| --- | --- | --- | --- | --- | --- | --- |
| authority (HQ/IT PIN, admin) | পুরো ফ্লোর | হ্যাঁ | হ্যাঁ | হ্যাঁ | হ্যাঁ | `/` `/hq` `/reports` `/system` |
| coordinator (team_leader) | পুরো ফ্লোর | হ্যাঁ | না | না | হ্যাঁ | `/` `/desk` `/dispatch` `/reports` |
| sales_team_admin (হায়দার) | নিজের | না | না | না | হ্যাঁ | `/` `/desk` `/coach` `/reports` |
| agent | নিজের | না | না | না | নিজের টিকেট | `/` `/desk` `/coach` `/reports` |
| সাইন-ইন নেই | কিছু না | না | না | না | না | `/` `/docs` `/help` |

## অলঙ্ঘনীয় দুই নিয়ম

1. **সাপোর্ট ইনবক্সের অধিকার আর কিছুই দেয় না** — বিতরণ, কোটা, অ্যাকাউন্ট অনুমোদন, আইটি কনসোল সবই `caller.scope` দেখে, ইনবক্স সদস্যপদ দেখে নয়।
2. **read-only সেশন লিখতে পারে না** — Executive HQ PIN আর অনুমোদনহীন অ্যাকাউন্ট পড়তে পারে, বদলাতে পারে না; প্রতিটি পরিবর্তন `requireWrite` পার হয়।

## গেটগুলো

| গেট | কাজ |
| --- | --- |
| `resolveCaller(adminToken?)` | কে ডাকছে — PIN টোকেন বা সাইন-ইন করা অ্যাকাউন্ট |
| `requireAuthority` | মাস্টার/আইটি PIN বা admin |
| `requireDispatch` | authority বা coordinator |
| `requireWrite` | read-only সেশন আটকায় |
| `requireInboxRead` / `requireInboxManage` | টিম সাপোর্ট ইনবক্স |
| `ticketSide(caller, ticketId)` | এজেন্ট শুধু নিজের টিকেট |
| `quotaFor(employeeId, floorQuota)` | দৈনিক কোটা — WIN2607 → ১৫, বাকি → ২৫ |
| `completionPercent(completed, quota)` | নিজের কোটার অনুপাতে শতাংশ (১৫/১৫ = ২৫/২৫ = ১০০%) |

## অ্যান্ড্রয়েড ও cron

- অ্যান্ড্রয়েড: প্রতি-ডিভাইস টোকেন (`device-auth.server.ts`, SHA-256 হ্যাশ, `agent_devices`)।
- cron ও webhook: `x-cron-secret` / স্বাক্ষর ছাড়া অনুরোধ ফেরত (401) — কোনো ব্যতিক্রম নেই।
- কার্ড নম্বর, CVV, OTP, পাসওয়ার্ড কোথাও সংরক্ষিত হয় না; আর্কিটেক্ট অ্যাকাউন্ট নম্বর এনক্রিপ্টেড, শুধু শেষ ৪ সংখ্যা দেখা যায়।
