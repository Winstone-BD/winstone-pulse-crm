# Knowledge Hub (winstonebd.com) → CRM connection

The Knowledge Hub is a separate website with its own database. The CRM will read only its **public** information (project pages, news feed). Site-visit requests need a small signed message from the Hub, because those requests are private and live only in the Hub's database.

## 1. Project information on leads and for agents
- The CRM's existing website reader also reads the Hub's public project pages (`winstonebd.com/projects/...`), on the existing schedule plus IT's manual refresh.
- Lead details and the pre-call popup show a **"প্রজেক্ট তথ্য (winstonebd.com)"** card. It appears when the lead's project/requirement label matches a Hub project. It shows only text from that page, with a link to it.
- If nothing matches, the card says so. No price, size or location is ever guessed.

## 2. Highlighted Winstone news for agents
- The CRM reads the Hub's public news feed (`/api/public/news-feed`) into the existing Market News list, tagged **"Winstone অফিসিয়াল"**.
- Official Winstone news is highlighted (gold badge, pinned first) on the news page. A slim "নতুন অফিসিয়াল আপডেট" strip on the agent Desk links to it.
- Each item keeps its original title, date and source link. Nothing is rewritten as fact.

## 3. Site-visit requests linked to the lead and agent
- When a customer books a visit on the Hub, the Hub sends a signed `site_visit.requested` message to the CRM's existing verified receiver. It uses the same shared secret and the same replay protection.
- The CRM finds the customer by Bangladesh phone number:
  - **Existing lead:** the request appears on that lead and on the assigned agent's Desk as **"ওয়েবসাইট ভিজিট অনুরোধ — নিশ্চিত করুন"**.
  - **New customer:** the lead lands unassigned in LeadHub as today, and the request waits on it.
- A request is only a request. It becomes a real site visit only when the agent confirms it through the existing site-visit flow. This keeps the rule that visits come from verified signals, and history stays append-only.
- **Needs a Hub change:** the Hub must send this message. I'll provide the exact message format; the Hub change is made in the Hub project's own chat.

## 4. Source-cited answers for agents
- The existing "Winstone AI" answer box (pre-call popup and assistant panel) also searches the Hub's project, FAQ and news pages.
- Every answer lists its sources as clickable page links. If the pages don't cover the question, the answer says "তথ্য পাওয়া যায়নি — অনুমান করবেন না".

## Not changed
LeadHub assignment rules, booking approval, scoring, existing site-visit and booking flows, and permissions.

## Technical details
- Website source config gains `https://winstonebd.com` (pages: /projects/*, /faq, /news/*) alongside the current source; reuse `website-knowledge.server.ts` and `website_pages`.
- News import is added to the existing 3-hour `market-news` hook: parse RSS, dedupe by link, `source='winstone_official'`. A small migration adds an `is_official boolean` column if the current columns can't express it.
- New server-only table `website_visit_requests` (lead_id, phone, project, preferred date/time, visitors, notes, hub_request_id unique, status requested/confirmed/dismissed, created_at), plus GRANTs to service_role only. It is read through authenticated server functions scoped to the assigned agent or HQ/IT.
- `os-bridge.server.ts` gets a `site_visit.requested` handler. It is idempotent on `hub_request_id` and never creates a site_visit row itself.
- Bengali/English strings go in `i18n.ts`; the dashboard colour check stays green.
