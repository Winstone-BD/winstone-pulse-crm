# নিয়ম / Conventions

## নামকরণ

| ধরন | নিয়ম | উদাহরণ |
| --- | --- | --- |
| সার্ভার লজিক | `<বিষয়>.server.ts` | `lead-pool.server.ts` |
| সার্ভার ফাংশন (RPC) | `<বিষয়>.functions.ts` | `service-billing.functions.ts` |
| দুই জায়গার শেয়ার | `<বিষয়>.ts` বা `<বিষয়>-shared.ts` | `lead-quota.ts`, `team-support-shared.ts` |
| কম্পোনেন্ট | `PascalCase.tsx`, এক কাজ এক ফাইল | `TopPerformerCard.tsx` |
| পাতা | `kebab-case.tsx` = URL | `support-admin.tsx` |
| মাইগ্রেশন | `NNNN_snake_case.sql`, ক্রমিক | `0043_service_invoices.sql` |

বিষয়ের নাম ইংরেজি (lead, call, support, billing, shift, push); ব্যবহারকারীর দেখা সব লেখা বাংলা।

## ফোল্ডার ভাগ

কম্পোনেন্ট বিষয় অনুযায়ী: `components/crm/` (লিড, কল, ডেস্ক, HQ), `components/crm/hq/`, `components/crm/reports/`, `components/support/` (কাস্টমার সাপোর্ট ডেস্ক), `components/ui/` (shadcn — হাতে বদলানো নয়)।

## নতুন কোড লেখার নিয়ম

1. UI → `*.functions.ts` → `*.server.ts` → ডেটাবেজ। কম্পোনেন্ট থেকে সরাসরি `.server.ts` import নয়।
2. রঙ সবসময় সেম্যান্টিক টোকেন (কালো-সোনালি থিম); `text-white`, `bg-[#...]` নিষেধ।
3. নতুন public টেবিল = একই মাইগ্রেশনে `GRANT` + RLS policy।
4. প্রতিটি সংবেদনশীল কাজ `audit.server.ts` দিয়ে লগ করুন।
5. একবারই ঘটা উচিত এমন কাজ (বিতরণ, বিল যাচাই, পুশ, ইমেইল) idempotency key/টেবিল দিয়ে সুরক্ষিত করুন।
6. কোনো সংখ্যা অনুমান করে দেখাবেন না — আসল ডেটা নেই মানে "এখনো লাইভ ডেটা নেই"।
7. এক পাতা ১০KB-র নিচে রাখার চেষ্টা করুন; বড় হলে কম্পোনেন্টে ভাগ করুন।
8. পুরোনো ডেটা মোছা/মার্জ করা নিষেধ।

## চেক

```sh
bunx tsgo --noEmit && bunx vitest run && bun run build
```
