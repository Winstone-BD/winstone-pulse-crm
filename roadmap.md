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
- [ ] নতুন ওয়ার্কস্পেসে Google Docs / Drive / Sheets সংযোগ আবার জোড়া (ব্যবহারকারীর অনুমোদন দরকার)
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
