# সোশ্যাল মিডিয়া মডারেশন (পদ্ধতি ক — Facebook API ছাড়া)

## লক্ষ্য
এজেন্টরা Meta Business Suite / Facebook অ্যাপে নিজেরাই উত্তর দেবেন। CRM শুধু তিনটি কাজ করবে: কাজের হিসাব রাখা, আগ্রহী ক্রেতাকে লিডে রূপান্তর করা, আর HQ-কে আসল কাজের রিপোর্ট দেখানো। কোনো মেসেজ CRM থেকে পাঠানো হবে না, আর কোনো তথ্য বানানো হবে না।

## এজেন্ট যা দেখবেন (ডেস্ক → নতুন "সোশ্যাল" সেকশন)
- **কাজ লিখে রাখুন:** ধরন (ইনবক্স মেসেজ / পেজ কমেন্ট / গ্রুপ পোস্ট-কমেন্ট), কোন পেজ বা গ্রুপ, পোস্ট বা মেসেজের লিংক (ঐচ্ছিক), ছোট নোট, কতগুলো উত্তর দিয়েছেন। লিখতে ১০ সেকেন্ডের বেশি লাগবে না।
- **দ্রুত লিড রূপান্তর:** ক্রেতা ফোন নম্বর দিলে একটি বাটনেই লিড হবে। উৎস হবে "Facebook ইনবক্স / কমেন্ট / গ্রুপ"। নম্বর আগে থেকে থাকলে নতুন লিড না বানিয়ে আগের লিডের সঙ্গে সংযুক্ত হবে। নতুন লিড অন্য সব আমদানির মতোই কারও নামে না থেকে LeadHub-এ যাবে (assign হবে না)।
- **আজকের হিসাব:** আজ কতগুলো উত্তর দিয়েছেন, কতগুলো লিড এসেছে।
- **তৈরি উত্তর:** প্রকল্প ও দাম নিয়ে HQ-এর অনুমোদিত উত্তরগুলো কপি করে নেওয়া যাবে। দামসহ শুধু আসল প্রকল্পের তথ্য থাকবে।

## HQ / IT যা দেখবেন
- এজেন্ট অনুযায়ী দৈনিক ও মাসিক হিসাব: কতগুলো কাজ, কতগুলো উত্তর, কতগুলো লিড, আর কতগুলো লিড পরে সাইট ভিজিট বা বুকিং পর্যন্ত গেছে।
- পেজ ও গ্রুপের তালিকা ঠিক করা (কোন পেজ বা গ্রুপে কাজ করতে হবে)।
- তৈরি উত্তরের তালিকা যোগ, বদল বা বন্ধ করা।

## নিয়ম
- কাজের এন্ট্রি মুছে ফেলা যাবে না। ভুল হলে "বাতিল" চিহ্ন দেওয়া যাবে, আর ইতিহাস থেকে যাবে।
- এজেন্ট শুধু নিজের এন্ট্রি দেখবেন; HQ/IT সবার এন্ট্রি দেখবেন।
- দৈনিক পারফরম্যান্স স্কোর এখনই বদলাবে না। সোশ্যাল কাজ আলাদাভাবে দেখানো হবে। পরে চাইলে স্কোরে যোগ করা যাবে।
- শুক্রবারের ছুটি এবং ৯:০৫-এর ব্রিফিং নিশ্চিতকরণ বাকি সব কাজের মতো এখানেও প্রযোজ্য।
- Android অ্যাপে প্রথম ধাপে কিছু বদলাবে না। ফোনের ব্রাউজারে CRM থেকেই লেখা যাবে।

## Technical details
- Additive migration: `social_pages` (HQ-managed list), `social_activity_logs` (agent_id from session, kind, page_id, link, note, reply_count, voided_at/by; trigger blocks delete/edit except void), `social_reply_templates`. RLS enabled; agents SELECT/INSERT own rows only; HQ/IT reads via server functions with existing authority checks.
- `src/lib/social.functions.ts`: logActivity, voidActivity, convertToLead (reuses the existing ingest/dedupe path with source `facebook_*`, unassigned), listMySocial, socialReport (HQ/IT). agent_id is never taken from the browser; the briefing-ack and Friday guards run on every mutation.
- UI: a new "সোশ্যাল" entry in DeskTabBar plus `SocialDesk.tsx`, and an HQ panel in /hq; phones get compact cards and md+ screens get tables; strings in i18n.ts (bn/en).
- Tests: RLS ownership, append-only trigger, dedupe on convert, no assignment on convert, guard enforcement.
- No Meta API, no secrets, no publish.
