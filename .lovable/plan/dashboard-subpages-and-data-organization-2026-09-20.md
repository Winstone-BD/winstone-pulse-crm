# Dashboard subpages and data organization

## Goal
Agent, Coordinator, Executive HQ, Reports, and IT Console-এর দীর্ঘ একপাতার ড্যাশবোর্ডগুলোকে পরিষ্কার URL-ভিত্তিক সাবপেজে ভাগ করা। প্রতিটি ড্যাশবোর্ডে উপরে বাংলা ট্যাব থাকবে; URL বদলালে সংশ্লিষ্ট তথ্যই দেখা যাবে।

## Page structure

### Agent Desk
- `/desk` — আজকের সারাংশ, প্রোফাইল, ফোন অবস্থা, বরাদ্দ ও পারফরম্যান্স
- `/desk/leads` — লিড তালিকা, মোবাইল কিউ, carry-over ও দিনের কাজ
- `/desk/calls` — নিজের কল ইতিহাস ও যাচাইকৃত কথার সময়
- `/desk/follow-ups` — অ্যালার্ম, সপ্তাহ ও ক্যালেন্ডার
- `/desk/messages` — WhatsApp ও টিম সাপোর্ট
- `/desk/reports` — নিজের জমা দেওয়া রিপোর্ট

### Coordinator Deck
- `/dispatch` — লিড বিতরণ, bulk push, database ও extra leads
- `/dispatch/team` — টিম লোড, assignment history ও self-claim history
- `/dispatch/operations` — live queue, call operations ও support inbox

### Executive HQ
- `/hq` — executive overview, floor performance ও live insight
- `/hq/performance` — agent performance, classification ও funnel/source breakdown
- `/hq/operations` — allocation, Winstone AI commands ও HQ query
- `/hq/briefs` — executive brief, shift summary ও service bill

### Reports
- `/reports` — filters, KPI ও daily activity
- `/reports/agents` — agent scorecards ও intelligence
- `/reports/calls` — submitted call reports
- `/reports/exports` — daily export ও synced call evidence; শুধু অনুমোদিত ভূমিকায়

### IT Console
- `/system` — system notice, data health, recording/backup status ও endpoints
- `/system/staff` — staff accounts, approvals ও audit trail
- `/system/integrations` — Drive, Docs, Sheets, call operations ও related status
- `/system/app` — customization, Android install ও releases
- `/system/billing` — service bill, monthly figures, credits link ও yearly archive

## Shared behavior
- প্রতিটি parent dashboard একটি shared layout হবে: বর্তমান role gate, page title এবং বাংলা tab navigation রাখবে; child page `<Outlet />`-এ খুলবে।
- Desktop-এ compact tab row এবং mobile-এ horizontally scrollable tab row থাকবে। Active tab স্পষ্ট হবে।
- পুরোনো মূল URL (`/desk`, `/hq`, `/dispatch`, `/reports`, `/system`) কাজ করবে এবং summary/default tab দেখাবে।
- বিদ্যমান deep links যেমন `/desk#calendar`, `/desk#whatsapp`, `/desk#leads` নতুন সাবপেজ URL-এ আপডেট হবে।

## Data and safety
- কোনো metric, call verification, talk-time, retry, assignment, billing, role/RLS বা database logic পরিবর্তন করা হবে না।
- বিদ্যমান canonical helpers এবং live backend data-ই ব্যবহার হবে; mock/static data যোগ হবে না।
- প্রতিটি child route নিজস্ব title, description, Open Graph title/description, `og:type`, এবং `twitter:card` পাবে।
- নতুন route তৈরি এবং সব internal links একই পরিবর্তনে করা হবে; generated route tree হাতে সম্পাদনা করা হবে না।

## Validation
- Role অনুযায়ী tab visibility ও direct-URL access যাচাই।
- Mobile 428px এবং desktop 1280px-এ tab overflow, text fit ও page layout যাচাই।
- Agent quick actions, HQ drill-down, report filters/exports এবং coordinator actions কাজ করছে যাচাই।
- Targeted tests ও type validation চালানো; `/desk`, `/hq`, `/dispatch`, `/reports`, `/system` এবং তাদের child URLs সফলভাবে খুলছে নিশ্চিত করা।
