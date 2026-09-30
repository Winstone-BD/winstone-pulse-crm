# Sales Intelligence module (inside Winstone CRM)

Built on the existing canonical `leads` table and Lead 360. No second lead table, no separate mini CRM.

## What users get

**Agents (own assigned leads only)**
- Lead 360 gets two new tabs: **AI Sales Brief** and **Pitch History**.
- AI Sales Brief is built only from the lead's real records: requirement, location, budget (if present), past calls, customer responses, objections, earlier pitches, current follow-up, score/category, and today's next best action. Each line shows where it came from (call report, follow-up, or verified fact). Missing data shows as "not recorded". Nothing is guessed.
- **Smart Pitchbook**: choose one of the 11 objections and get a recommended reply, a "Why this response" note, and Supporting Facts (source, effective date, verification status, review and expiry dates). Buttons: Copy Pitch, WhatsApp, Save to Lead History, Edit / Regenerate.
- WhatsApp opens a prefilled `wa.me` link. It is recorded as "WhatsApp opened / message prepared" and never as sent or delivered.

**Executive HQ / IT (global view, PIN rules unchanged)**
- New **Sales Intelligence** page with these sections: Daily Market Brief, Finance / Loan, Area Price Trend, Government / Regulatory, Pitch History, Pitch Effectiveness, and a dashboard (total pitches, top objections, most-used pitches, usage by agent and by project, and Pitch → Follow-up / Call / Site visit / Booking).
- New **Knowledge Admin** page: Market Facts, Sources, Verification, Pitch Library, Objection Library, Property Knowledge, Approval / Publish, Version History. Facts and pitches move draft → verified → published → expired. Every edit creates a new version, and old versions stay.
- Filters: lead, phone, Lead ID, agent, objection, pitch, project, source, date range, action, outcome. Filtering happens on the server with page-by-page loading. CSV and print/PDF exports include the filters, generation time, data scope and document version.

## Rules enforced on the server
- The actor always comes from the signed-in session. An agent can only log pitches on leads assigned to them. The 9:05 briefing gate and the maintenance lock apply the same way as other agent actions.
- Pitch events are append-only. A database trigger blocks updates and deletes, and a unique idempotency key stops duplicate retries. Corrections are saved as new events.
- The AI (Lovable AI) only receives verified, published, non-expired facts plus the lead's real context. It must cite fact IDs. Replies that cite unknown IDs or include numbers not found in the given facts are rejected and fall back to the library template.
- Pitch Effectiveness uses fixed counting rules, not AI scores. It links a pitch to a later follow-up, call, site visit or booking within a set window (default 14 days, changeable). Each link can be opened to see the underlying events. It is labelled "association, not causation".
- Site visits and bookings count only from explicit saved report signals, per the existing project rule.
- No market numbers are built into the code, and none are made up. The fact tables start empty; HQ enters real facts. The objection list and neutral pitch templates are the only starting content, and they contain no numbers.

## Documentation
- Add a Sales Intelligence chapter to the A-Z System Manual and the Client Handover page. Bump both versions and regenerate the manual, handover and audit PDFs. Both stay linked from Executive HQ and IT Console.

## Verification
- New tests for: no duplicate lead source, agent scope isolation, fact verification and expiry, AI grounding contract, append-only pitch events, idempotent duplicate actions, wrong-agent denial, WhatsApp action classification, deterministic attribution, filters and pagination, export scope, plus existing call and follow-up regression tests.
- Run typecheck, the full test suite, a production build, read-only database checks, and screen checks at 390, 820, 1280 and 1728 widths. Screens behind sign-in are checked only as far as a session is available, and the report will say so.
- No test records are written to the live database. Fixture-based tests only.

## Technical details
- Migration: `market_facts` (all listed columns plus `status` and `version`, with a `market_fact_versions` history table), `sales_objections`, `pitch_templates` (+ versions), `property_knowledge` (+ versions), `pitch_events` (lead_id FK to leads, agent_id, call_id, follow_up_id, template_id, objection_id, fact_ids uuid[], action enum viewed/copied/edited/whatsapp_opened/saved, generated_text, final_text, project, correlation_key unique, created_at). All tables are server-only (RLS on, service_role grants) with a `block_history_mutation` trigger on pitch_events and the version tables.
- Lead 360 timeline query unions pitch_events with the existing lead_events, call_reports and follow_up_events sources.
- Files: `src/lib/sales-intel-rules.ts` (pure: objections, fact eligibility, grounding validator, attribution, WhatsApp URL), `sales-intel.server.ts`, `sales-intel.functions.ts`, components under `src/components/crm/sales-intel/`, routes `/sales-intel` and `/sales-intel/admin`, and NavSidebar entries scoped by permission.
