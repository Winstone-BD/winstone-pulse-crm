# কাঠামো / Architecture

স্ট্যাক: TanStack Start v1 (React 19, SSR) + Vite 7 + Tailwind v4 + Lovable Cloud (Postgres, auth, storage)। ওয়েব অ্যাপ আর অ্যান্ড্রয়েড অ্যাপ আলাদা — কোনো WebView নেই; অ্যান্ড্রয়েড কথা বলে `src/routes/api/public/*` দিয়ে।

## ফোল্ডার

```
src/
  routes/            পাতা (ফাইল = URL)। routeTree.gen.ts স্বয়ংক্রিয় — হাতে বদলাবেন না
    api/             HTTP এন্ডপয়েন্ট
    api/public/      বাইরের কলার (অ্যান্ড্রয়েড, cron, webhook) — হ্যান্ডলারেই স্বাক্ষর/সিক্রেট যাচাই
  components/crm/    CRM-এর নিজস্ব কম্পোনেন্ট
  components/support/ কাস্টমার সাপোর্ট ডেস্কের কম্পোনেন্ট
  components/ui/     shadcn ভিত্তি (হাতে বদলানো এড়িয়ে চলুন)
  lib/               সব লজিক (নিচে নামকরণ দেখুন)
  integrations/supabase/  স্বয়ংক্রিয় তৈরি — সম্পাদনা নিষেধ
drizzle/migrations/   ডেটাবেজের একমাত্র সত্য; ক্রমানুসারে চলে
tests/               vitest (শুধু এই ফোল্ডার স্ক্যান হয়)
docs/                এই নথিপত্র
```

## `src/lib` এর তিন ধরনের ফাইল

| শেষাংশ | কোথায় চলে | নিয়ম |
| --- | --- | --- |
| `*.server.ts` | শুধু সার্ভার | ডেটাবেজ, সিক্রেট, `supabaseAdmin` — ব্রাউজার থেকে কখনো import নয় |
| `*.functions.ts` | সার্ভার ফাংশন (RPC) | UI এখান থেকেই ডাকে; ভেতরে `.server.ts` লোড করে |
| শেষাংশ ছাড়া | দুই জায়গাতেই | শুধু লেবেল, টাইপ, হিসাব — কোনো ডেটাবেজ নয় |

UI → `*.functions.ts` → `*.server.ts` → ডেটাবেজ। এই ক্রম কখনো টপকাবেন না; কম্পোনেন্ট থেকে সরাসরি `.server.ts` import করলে বিল্ড ভাঙবে।

## ডেটার প্রধান পথ

1. **লিড আসা** — এক্সেল/CSV ইম্পোর্ট → ফোন normalize (`lead-phone.ts`) → যোগ্যতা যাচাই (`lead-eligibility.server.ts`) → নতুন পুল। আগে কল হওয়া বা অ্যাসাইন হওয়া ফোন বাদ; পুরোনো ডেটা কখনো মোছা হয় না।
2. **দৈনিক বিতরণ** — সকাল ৯:১০ (ঢাকা) cron → `lead-pool.server.ts` `distributeDailyLeads()` → প্রতি ডেস্কে কোটা অনুযায়ী; `lead_distribution_runs` টেবিলে দিনে একবারই (idempotent, cursor সংরক্ষিত)।
3. **কল** — এজেন্টের নিজের সিম → OEM রেকর্ডিং → অ্যান্ড্রয়েড আপলোড → Drive → ট্রান্সক্রিপ্ট → AI সারসংক্ষেপ ও শ্রেণিবিন্যাস (`call-intel.server.ts`, `analysis-queue.server.ts`; প্রতি ১৫ মিনিটে ঝাড়ু)।
4. **রিপোর্ট** — পোস্ট-কল রিপোর্ট বাধ্যতামূলক (`PostCallReportGate`) → শিফট সারসংক্ষেপ ১২:৫০ ও ৫:৩০ → `reports.tsx` / `hq.tsx`।
5. **Maintenance** — মাসিক $46.29 USD; ১৪ তারিখ 00:00 Dhaka-তে unpaid থাকলে server-side lock। IT যাচাই এবং System Architect-এর সীমিত unlock একই canonical audit path-এ থাকে (`maintenance.server.ts`)।

## নিরাপত্তার তিন স্তর

- **RLS** — প্রতিটি public টেবিলে policy + GRANT (মাইগ্রেশনে)।
- **সার্ভার গেট** — `rbac.server.ts` (দেখুন `roles-and-permissions.md`)।
- **অডিট** — প্রতিটি সংবেদনশীল কাজ `audit.server.ts` দিয়ে লেখা হয়।
