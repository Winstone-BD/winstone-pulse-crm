# Phase 1 Audit — Meta Ads readiness (read-only, nothing changed)

Evidence comes from reading the source code and the generated database types only. No live calls, no queries on lead rows, no writes.

## 1. Source / campaign / ad / UTM fields and ingestion — PARTIAL
- `leads` has one free-text `source` field and no campaign, ad set, ad, form, `leadgen_id`, UTM or fbclid columns (`src/integrations/supabase/types.ts`, the `leads` Row block). **FAIL** for ad-level attribution.
- `website_enquiries` does have `utm_source`, `utm_medium`, `utm_campaign`, `page_url` and `lead_id`, but no ad, ad set or form ID (types.ts, `website_enquiries` Row). Per project rules these arrive only as signed events on `/api/public/os/events`. **PARTIAL**
- Generic intake is `POST /api/public/ingest/lead` (`src/routes/api/public/ingest/lead.ts:8-23`). It accepts `name`, `phone_number`, `company`, `notes`, `source` (40 characters at most), and an `assign` flag that is never used. It has no campaign or ad fields. **PARTIAL**
- Callers are limited to a device token or a server secret (`lead.ts:41-43`, `src/lib/device-auth.server.ts:136-167`). A Meta webhook could not call it directly. **NOT VERIFIED** live.
- `src/routes/api/public/tmp-bulk-import.ts` is marked "Removed after use" but still exists. It is secret-gated. Flagged for cleanup.

## 2. Phone normalisation, duplicates, one record per customer — PASS (code)
- Bangladesh formats and `+`/`00` international numbers become one canonical form (`src/lib/lead-phone.ts:2-14`). Invalid numbers are rejected (`src/lib/lead-intake.server.ts:59`).
- Before insert, the number is checked against existing leads (`lead-intake.server.ts:55-72`). A race that hits the unique constraint resolves to the existing lead (`:96-107`). The constraint is `phone_number UNIQUE` (migration `20260910062341…sql:33`), plus `lead_phone_keys` and the `claim_lead_phone_keys` trigger.
- A repeat Meta submission would return `duplicate: true` and keep the original lead. It would not record a second campaign touch, so repeat ad attribution would be lost. **PARTIAL** for ads.
- `src/lib/ingest-resolve.server.ts:11-17` has its own older normalizer, a second copy of the rule. It is low risk because it still goes through `intakeLead`.

## 3. Assignment and follow-up status — PASS (code)
- Inbound leads land unassigned with `status: "pending"` (`lead-intake.server.ts:88-92`, `lead.ts:51-57`). LeadHub Nexus is the only assignment path. That matches the project rules, the Friday holiday rule and the 50-per-day quota.
- After that, the existing neglect cadence and follow-up lifecycle apply. **NOT VERIFIED** for a Meta-sourced lead end to end, because none exists.

## 4. Facebook Lead Ads OAuth / webhook — FAIL (not present)
- The code has no `leadgen` handling, no `hub.challenge` verification, no `X-Hub-Signature-256` check, and no Page-token or OAuth flow for Lead Ads. The only Graph API use is WhatsApp (`src/lib/whatsapp-provider.server.ts:204`).
- Project memory says "no Meta API" for social moderation (`social_activity_logs`). Lead Ads would be a new decision that needs your approval.

## 5. Conversions API / qualified-lead feedback — FAIL (not present)
- No CAPI client, no pixel or dataset ID, no event hashing, and no sending of "qualified" or "booking" status back to Meta exist anywhere in `src`.

## 6. Security, RLS and privacy — PARTIAL
- Intake writes only through the server admin client after the caller is checked. It is rate-limited to 120 per minute per source (`lead.ts:5,38`). Live checks show anonymous visitors can't read or insert leads (`tests/rls.test.ts:35-37, 93-99`). **PASS**
- Gaps for Meta:
  - There is no webhook signature check yet.
  - There is no consent or marketing opt-in field per lead. `consent_records` exists, but intake doesn't use it.
  - The 40-character `source` limit can't hold campaign names.
  - CAPI would need SHA-256 hashing of phone numbers and no raw personal data in logs.
  - Facebook requires a data-deletion callback, which is missing.
- The live RLS state was not re-queried in this audit. **NOT VERIFIED**

## 7. File and line evidence
Each finding above cites its own lines. Main files: `src/routes/api/public/ingest/lead.ts`, `src/lib/lead-intake.server.ts`, `src/lib/lead-phone.ts`, `src/lib/device-auth.server.ts`, `src/lib/ingest-resolve.server.ts`, `src/integrations/supabase/types.ts`, `supabase/migrations/20260910062341_…sql`, `tests/rls.test.ts`.

## 8. Blockers
1. There is no Meta Lead Ads webhook, Page connection or app review. This needs the Meta app ID and secret, the Page ID, and `leads_retrieval` and `pages_manage_metadata` permission from you.
2. `leads` has no attribution fields.
3. There is no CAPI dataset ID or access token, and no agreed rule for what counts as a "qualified" lead to send back. A sensible default would be a submitted report rated Hot/Warm, or a booking approved by HQ.
4. Your existing "no Meta API" rule needs an explicit exception.
5. Privacy: consent capture and a data-deletion endpoint.

## Test plan for Phase 2 (only after you approve the build)
- Automated tests:
  - webhook verify handshake
  - signature accepted or rejected
  - the same `leadgen_id` arriving twice is handled once
  - `+880`, `880` and `01` forms of a number give one lead
  - a repeat ad submission on an existing lead records the touch without reassigning it
  - new leads land unassigned
  - CAPI phone hashing
  - the qualified event fires once per lead
- Meta's own Lead Ads Testing Tool sends a real test lead. It is deleted by ID afterwards, which needs your approval.
- RLS check: anonymous visitors can't read the new attribution or event tables.
- Nothing is called "live" until a real Meta test lead shows up in LeadHub and a CAPI test event appears in Meta Events Manager.

## Technical notes
- Phase 2 shape: add nullable attribution columns, or a `lead_attributions` table that records each touch. Add a `meta_lead_events` receipts table (server-only, unique `leadgen_id`). Add `/api/public/meta/leadgen` with GET verify and a signed POST, fetch the lead through the Graph API, and pass it through `intakeLead`. Add a CAPI sender triggered from report finalize or booking approval, with retries.
