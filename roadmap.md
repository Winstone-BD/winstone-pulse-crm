# Winstone CRM — খোলা কাজ

## চালু ও যাচাই হওয়া
- [x] আইটি কনসোলে রেকর্ডিং পাইপলাইন (কল → রেকর্ডিং → সার্ভার → Drive → ট্রান্সক্রিপ্ট → এআই → শ্রেণিবিন্যাস)
- [x] রিট্রাই কিউ — Drive ও ট্রান্সক্রিপ্ট/এআই আবার চেষ্টা (ডুপ্লিকেট হয় না)
- [x] Drive ফাইল সত্যিই আছে কিনা যাচাই (শুধু ডেটাবেস ফ্ল্যাগে ভরসা নয়)
- [x] Twilio সব স্তর থেকে বাদ — নিজের সিম + নিজের অ্যান্ড্রয়েড অ্যাপই একমাত্র কলিং পথ
- [x] চার পাতায় Winstone AI প্যানেল, ভূমিকা অনুযায়ী কাজ, সার্ভারে অনুমতি যাচাই
- [x] ক্রেডিট বিল রিপোর্ট পেজ (`/credits`) — আসল ব্যবহারের খাতা থেকে

## 2026-09-13 — প্রোডাকশন অডিট
- [x] এআই বনাম এজেন্টের শ্রেণিবিন্যাস না মিললে স্থায়ী সতর্কতা (এজেন্টের সিদ্ধান্ত অপরিবর্তিত)
- [x] কথা হওয়া কলের রেকর্ডিং না পেলে সত্যিকারের "বাকি কাজ" সতর্কতা
- [x] টেস্ট সেট (vitest): ভূমিকা/পিন, লিড মালিকানা, রিপোর্টের নিয়ম, শিফট, ইম্পোর্ট, লাইভ RLS
- [x] lint/prettier পরিষ্কার, typecheck ও build পাস

## হার্ডওয়্যার-নির্ভর (ক্লাউডে যাচাই সম্ভব নয়)
- [ ] আসল অ্যান্ড্রয়েড ফোনে কল → OEM রেকর্ডিং → আপলোড → Drive → ট্রান্সক্রিপ্ট
- [ ] এজেন্ট ফোনে নতুন APK ইনস্টল (Twilio বোতাম বাদ পড়া সংস্করণ)

## সম্পন্ন (এই রাউন্ড)
- [x] শিফট সামারি → Google Sheets "শিফট সামারি" ট্যাব (স্বয়ংক্রিয় 12:50/5:30 + ব্যাকফিল + ম্যানুয়াল বোতাম) — shift-sheet.server.ts, shift-summary ফাংশন/প্যানেল; গেটওয়ে লেখা প্রমাণিত, tsgo/vitest(54)/build পাস

## 2026-09-16 — নতুন কাজ
- [ ] এজেন্ট ডেস্কে মোবাইল-অনলি লিড কিউ (স্বাইপ → ফলো-আপ / বন্ধ)
- [ ] Reports পেজ এক্সিকিউটিভ-গ্রেড রিডিজাইন (KPI স্ট্রিপ, একটি বড় চার্ট, ৩ ইন্টেলিজেন্স কার্ড, স্মার্ট এম্পটি স্টেট, এজেন্ট পারফরম্যান্স, AI ব্রিফ) — ব্যাকএন্ড/লজিক অপরিবর্তিত

## 2026-09-16 — Winstone Company lead safety audit
- [x] বাংলাদেশি ফোনের একক server/database normalization এবং multi-phone key extraction
- [x] historical worked/assigned phone exclusion across all lead/call/event tables
- [x] new lead object concurrency-safe duplicate prevention without deleting historical rows
- [x] all import and assignment paths routed through the same eligibility guard
- [x] Winstone Company / Company Lead metadata and EN/BN outreach preservation
- [x] auditable import counts and bilingual import-result UI
- [x] production duplicate report, regression tests, typecheck/build validation

## 2026-09-17 — নতুন কাজ
- [x] sales_team_admin RBAC কঠোর করা (ইনবক্স-স্কোপড, IT/সুপার অ্যাডমিন ক্ষমতা নয়)
- [x] দৈনিক লিড বিতরণ ইঞ্জিন — আইডেমপটেন্ট + persistent allocation cursor
- [x] কোটা-নরমালাইজড পারফরম্যান্স (২৫/দিন, হায়দার ১৫/দিন) ও টপ-পারফর্মার র‍্যাঙ্কিং
- [x] সাপোর্ট টিকেট তৈরি/গুরুত্ব পরিবর্তনে ওয়েব ও অ্যান্ড্রয়েড পুশ অ্যালার্ট (Firebase সংযোগ বাকি)
- [x] মাসিক ৳৪,০০০ সার্ভিস বিল — service_invoices টেবিল, HQ ভিউ, IT কনসোল যাচাই/পেআউট, আইডেমপটেন্ট, অডিট; সেপ্টেম্বর ২০২৬ পরিশোধিত, অক্টোবর বকেয়া

- [x] Executive HQ billing: per-invoice PDF download (status, due/grace dates)
- [ ] Paddle go-live: publish project + verification form (user action in Payments tab)

## 2026-09-17 — কাঠামোগত ফাঁক বন্ধ
- [x] docs/ নথিপত্র: architecture, roles-and-permissions, features, integrations, conventions, testing + README ঠিক করা
- [x] বড় পাতা ভাগ: hq 24KB→7.4KB, reports 25KB→4.4KB, support-admin 25KB→3.2KB (নতুন components/crm/hq, crm/reports, support) — লজিক অপরিবর্তিত
- [x] ভূমিকা-নিয়ম একজায়গায়: src/lib/rbac.server.ts (গেট) + src/lib/rbac.ts (কোন ভূমিকা কী দেখে)
- [x] নতুন টেস্ট: rbac-matrix, team-support-shared (মোট ৮৮ টেস্ট পাস)
- [x] নামকরণ/ফোল্ডার নিয়ম লিখিত (docs/conventions.md)
- [ ] ঝুলে থাকা সংযোগ (docs/integrations.md-এ তালিকাভুক্ত): Firebase পুশ, Paddle go-live, ইমেইল DNS — সবই ব্যবহারকারীর অনুমোদন/ধাপের অপেক্ষায়
# Roadmap
- [x] Release APK with black-gold theme (in progress)
- [x] Connect Google Docs, Google Drive, Google Sheets (new workspace)
- [x] ছোট স্ক্রিনে এজেন্ট ডেস্ক ও লিড ৩৬০ ব্যবহারযোগ্য করা
- [x] লিড কিউ-এর ফিল্টার, সার্চ ও সাজানোর সক্রিয় অবস্থা এবং দ্রুত রিসেট যোগ করা
