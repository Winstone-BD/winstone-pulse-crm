# Roadmap

## Active
- [ ] Apply canonical rules to existing follow-up data safely: inspect legacy gaps, preserve historical dates/outcomes, apply only evidence-backed corrections.
- [ ] Publish full system after latest security review; report deployment request separately from confirmed live smoke-test.
- [x] Canonical follow-up lifecycle: mandatory outcomes/reasons, linked replacement on reschedule, completion never closes leads, current-owner checks, immutable original tasks/history, idempotent atomic transitions, clickable health filters and scoped dossier history. 522 tests / 75 files pass; harness typecheck/build OK; original 1,503 follow-ups unchanged.
- [ ] Follow-up populated-agent end-to-end verification — BLOCKED: injected account is stopped by the mandatory daily-contribution form; submitting it would create a real staff report. No customer follow-up mutated. Desktop health loading view observed; populated filters, reason submission and phone/tablet views remain unverified.

- [x] Full-system presentation polish: shared controls, readable tables, wrapped headers, dialog spacing, mobile touch sizes, flat welcome panel; 506 tests pass, recovery check and harness build OK. Signed-in HQ/IT/Desk/audit/reports verified at 1280/768/360px; LeadHub private content and populated agent-only workflows remain permission-gated. No data mutations or publication.

- [x] Global unified palette: one inherited token set, shared black actions/white forms, flat decoration and semantic statuses; global color check and 503 automated tests pass, production build OK; 48 static paths and four responsive widths checked. Signed-in HQ/IT/Desk checked with own account; LeadHub PIN-protected content and agent-only populated views remain unverified without the relevant authority/session. No backend changes or deployment.

- [x] Replace sideways desk navigation with a colour-accented, non-scrolling section picker; mobile global menu opens from below. Browser verified, no overflow.
- [x] Bring saved notes and prior reports/history into pre-call and active web-call workspace using existing authorised paths; 11 targeted checks passed. Signed-in saving remains unverified.
- [ ] Full SIM mute/speaker/hang-up verification blocked: browser has no telephony bridge; existing Android controls require a real authorised phone/device test. Web labels explicitly distinguish phone controls from opening the report.
- [x] Connect Android in-call service source for real SIM controls with opt-in default-phone role; existing reporting paths unchanged. APK compilation and handset behaviour unverified: JDK/Android SDK unavailable.
- [ ] Verify signed-in notes survive reopening the call panel and previous history is visible: blocked because requesting-user auth-session mint found no matching app account; needs authorised preview sign-in.

- [x] Phone-like agent calling panel — centered customer identity, round secondary controls, large call button; existing gates preserved. Signed-in visual check blocked: no requesting-user staff session available.

0. **Knowledge Hub link** — Done in CRM: hub project pages + citations in answers, official news highlighted/pinned + Desk strip, website visit requests (confirm/dismiss). Waits on Hub sending `site_visit.requested`.
0. **UI polish batch** — sidebar/top bar; dashboard KPI cards & charts states; lead list badges/states; follow-up & call screens. Frontend only.
0. **Restart module-load blank screen** — verify/fix without changing the 2.25.2 pin.

0. **Premium dashboard UI (master brief)** — Phase 1 done: light navy/gold theme on all app screens, WCAG contrast fixes, CI color check. Next, one screen at a time: menu/top bar, main dashboard cards & charts, lead list, follow-ups/calls/reports. Frontend only.
0. **Project selection + price details for agents** — Waiting on user answers: project source, price fields, who edits prices, how sales update links to bookings.



0. **Lead Details new layout** — header + quick actions, Brief Me, Reports, Personal Notes, Timeline, original lead description kept.
0. **Unified OS+CRM billing/entitlement** — Pending: renewal 12th, notices from 9th, lock 11th 23:49 Dhaka if unpaid, October 2026 paid (needs IT-recorded verification), website never locked, shared global unlock across OS/CRM, scoped notification center (executive_hq/it_council/agent), Hostinger role templates. Blocked parts: shared OS entitlement contract/endpoint, recipient mappings.
0. **Service-bill test email + PIN unlock check** — BLOCKED: `NOTIFY_EMAIL_ENDPOINT` must be a valid HTTPS relay and sender `info@winstonebd.com`, saved by the user in secure settings.
0. **Public MCP bill submission** — Declined: bills are private financial data; review stays on authenticated `/service-bill-unlock`.
0. **Billing workflow recipients** — Recorded: HQ alerts → info@winstonebd.com, IT alerts → winstomeitteam@gmail.com; Paid needs payment reference; Architect approve → unlock. Build pending with the unified billing task; OS Architect URL not yet provided.
0. **OS booking sync** — Inbound idempotent receiver done. Outbound CRM→OS dispatcher built (signed v1 payload, atomic claim, 1m/5m/15m/1h/4h backoff, max 5, manual retry, IT Console status panel, cron hook). BLOCKED until `OS_BOOKING_ENDPOINT` (https) is saved; no schedule set yet.
0. **Lead Details mobile** — Done: shortcut grid fits 390px, no sideways overflow, timeline rows wrap cleanly.
0. **Authorized bill review workflow** — Existing: IT verify needs payment reference, unlock request → System Architect (Google + server secret) approve, in-app HQ/IT alerts, append-only audit; no payment execution. Email alerts wait on Hostinger relay config.
0. **Review-only Service Bill Alert** — Implemented and verified locally: `/service-bill-alert` and authenticated `/service-bill-unlock`, server-only PIN and approver-email gates, persistent throttling/audit, safe Hostinger test send, and no payment execution or financial approval. Not published.
0. **Winstone ecosystem integration completion audit** — Completed credential-independent hardening: public-route flood brakes, provider payload replay guard, transactional booking→OS outbox, booking audit events, private MCP tool isolation, booking RLS regression, booked-value wording, and trigger-function hardening. Outbound OS dispatch remains blocked on a real OS endpoint contract; external providers remain configuration-gated.
   - Hostinger service-bill sender: verify `info@winstonebd.com`; current endpoint test is BLOCKED because saved `NOTIFY_EMAIL_ENDPOINT` is not a valid URL.
   - Phone OTP: custom Bangladesh SMS hook, 6 digits, 300 seconds, auto-confirm off; CONFIGURATION REQUIRED until a real gateway and credentials exist.
   - Connector-backed services: connect only with real workspace authorization; otherwise report CONFIGURATION REQUIRED without blocking CRM/OS core.
1. **Phone-friendly CRM tables** — Completed: high-use lead, support, performance, accountability and synced-call tables now become compact phone cards while retaining full laptop tables; remaining wide tables use contained touch scrolling.
2. **Google Drive reconnection** — Completed: linked a fresh Google Drive account in the new workspace; verified folder reads and a write/delete probe in the CRM archive (probe file removed).
3. **Search results show report description** — Completed: Lead 360 search rows and its call timeline render the shared expandable report card (manual description + structured fields), and exports carry the last report date/description.
4. **Mobile check of lead details + Personal Notes** — Completed on a 390px phone: Overview, Personal Notes, reports and timeline all present; notes composer and full-report expansion work. Fixed a clipped sheet header (24px cut off the right edge) in LeadDossier, AgentDossier, HqDrillSheet and NavSidebar, enlarged the sheet close target, and raised the brief/note/expand buttons to touch size.
5. **LeadHub Nexus consolidation** — Completed: Coordinator entry removed; dedicated PIN-only canonical database, import, quality, oldest-first quantity assignment and safe `/dispatch` redirect added.
6. **Correct agent performance analysis** — Use actual call duration/connected status/outcomes from `call_reports`/`calls`/`recordings`, not report submission counts. Identify who is actually wasting leads (short/no-answer/fake reports) vs genuinely working them.
7. **Google Sheets reconnection** — Pending; user paused to fix report logic first.
8. **Follow-up priority** — Completed: Hot/Warm/Cold-derived priority and overdue/due/category ordering across server reminders and web views.
9. **System update report** — Completed: factual IT update history from persisted app release notes.
10. **IT Council notice board** — Completed: IT publishing to all/role/accounts, recipient inbox, read state, replies, web realtime, push and Android notification feed.

## Backlog

3. Revisit Google Sheets connection after report is accepted.

## 2026-09-30 request (pending answers)

- [ ] Lead brief per assigned lead: why given, value, call script, conversion tips, callback date
- [x] Inventory-based per-project daily/monthly report: leads, calls, explicit site-visit signals, closed/converted bookings
- [ ] APK nearby-lead cards (blocked: sign-in cannot be removed — security)
- [x] Locked V2 scoring (6 questions, auto category/priority, no manual Hot/Warm/Cold) — web/server/Android
- [x] 9:05 daily briefing acknowledgement gate (server-side, web + Android popup)
- [x] Android foreground-only nearby-lead sorting from saved addresses (on-device geocoding; GPS never uploaded)
- [ ] Smarter distribution: project expertise, site visits, prior follow-ups
- [x] V2 six-question scoring on web/server/Android (version 2.13 mandatory release published)

## Open — Daily performance engine (rules locked 2026-09-30)

- [ ] Capped weighted KPI performance %, separate compliance state
- [ ] Deterministic 5:30 PM Top 3 from stored snapshot
- [ ] 6:00 PM Dhaka finalization lock + admin correction with reason/audit

## 2026-10-02 — Winstone Sales Success build (in progress)

- [x] Reconnect Google Drive in new workspace (linked; gateway-backed)
- [ ] Reconnect Google Search Console — BLOCKED: no workspace connection exists; user must create it in Connectors settings, then agent links it
- [x] Sales Success operating loop: Sales Copilot (FACT/INTERPRETATION/RECOMMENDATION, bn/bnlish/en, one next question) in sales-intel.server.ts + rules; Property Match from verified project_property facts with honest empty state; Objection Library (agent section + trust/ready_property codes); HQ overview daily market brief + property/project updates; NRB/expat news category + query; 288/288 tests, typecheck clean, build OK. Not published; AI answers and property match not exercised against live facts (market_facts empty).

- Ingest leads: non-device inbound records land unassigned (no round-robin, payload agent_id ignored); OS receiver rate-limited 120/min/IP — verified 2026-10-03, 301/301 tests.
- Evaluation audit: every V2 report submit appends immutable lead_events "evaluation_recorded" (rule version, raw answers, score, category, priority, report/call/agent ids, time) — verified 2026-10-03, 302/302 tests, build OK.
- Locked KPI rule module (src/lib/daily-kpi.ts): 50/50 capped, locked tie-break chain, 17:30 snapshot / 18:00 final phases — tested 305/305. OPEN: wire into Top 3 board + immutable 18:00 snapshot table (needs migration approval).
- Unified bridge lead_ingested on /api/public/os/events (Bearer or HMAC, 409 duplicate_ignored, 422 validation, unassigned canonical intake) — docs/crm1-receiver.md.

- [ ] Phone OTP login (6-digit, 300s, BulkSMSBD via SMS hook, staff+role check after OTP) — blocked: BulkSMSBD API key/sender ID, approval
- [x] Charts dashboard on HQ overview + agent desk (real snapshot data)
- [x] Date-range filters on charts dashboard (আজ/৭/১৪/৩০ দিন/সব সময়/কাস্টম from-to, Dhaka dates) — typecheck clean, build OK, phone-verified on agent desk; not yet published
- [x] Review-only service-bill alert and secure human-review workflow — `/service-bill-alert` plus admin/RBAC + server-PIN `/service-bill-unlock`, immutable attempt audit, database-backed throttling, safe JSON preview, and Hostinger test-send guard. Migration 0077 applied; 327/327 tests, typecheck/build, and desktop/mobile public/signed-out checks passed. Not published; live Hostinger delivery still awaits valid relay configuration.
- [ ] Hostinger-only service-bill delivery — configure/verify the HTTPS relay, `info@winstonebd.com`, approver recipient and test delivery, then publish; sign-in and reset emails remain on the managed email system

## 2026-10-06 — OS booking relay integration audit (in progress)
- [x] Audit OS↔CRM booking relay (2026-10-06): single canonical receiver POST /api/public/os/events (HMAC ±300s timing-safe + Bearer, payload-hash idempotency in os_event_receipts, Zod strict schemas, rate-limit 120/min/IP, safe error codes only, canonical intakeLead mapping, no parallel tables); outbound sync_events outbox with 1m/5m/15m/1h/4h retry (max 5), HTTPS-only endpoint check, atomic claim, manual Send Now/Retry in IT Console. 30/30 focused tests, typecheck, build OK. Notes: inbound HTTPS relies on platform edge (outbound enforces https:// in code); inbound rate limit is per-instance best-effort; osSyncStatus health mixes bill-email checks (cohesion only).
- [ ] Report exact endpoint path, auth mechanism, required secret NAMES only, remaining configuration requirements (OS_BOOKING_ENDPOINT not yet saved — secure form couldn't open in background).

- [x] 3-day lead neglect warnings + auto-return to LeadHub pool + HQ dispute log (needs rule: may a returned lead be re-given, since worked numbers are blocked from fresh assignment)

- [x] Reconnect GitHub API in new workspace — linked "Zahid's GitHub API" (gateway-backed; scopes read:user + repo). Verified read of Winstone-BD/winstone-os and Winstone-BD/winstone-crm-v01, both private, HTTP 200. Issue creation NOT test-fired (would leave an undeletable issue in the org repo). Code sync to winstone-crm-v01 still needs the user's own workspace Git settings action.
- [x] Reconnect Google Drive in new workspace — linked "Zahid's Google Drive" (gateway-backed; drive.file + drive.appdata + drive.readonly). Verified the saved archive folder "Winstone CRM" and all seven numbered subfolders match the stored folder map, the "2026" recordings year folder and every agent folder inside it are reachable, wrote a probe file into the archive and removed it (HTTP 204).
- [ ] Sync project code to https://github.com/Winstone-BD/winstone-crm-v01.git — BLOCKED: user action only, workspace Git settings ("Connect project"); the CRM already has the GitHub API connector for booking-failure alerts, so this is code backup only.
- [x] QR code on agent login cards
- [x] One-time password reset link flow (IT Console) + forced change on first login
- [x] Live lead dashboard (HQ, LeadHub, team leaders)
- [ ] Deep code review: booking relay + Staff Portal
- [x] Marked test booking to OS
- [x] Top 3 profile photos not showing — investigate
- [x] Walk Staff Portal with real data (HQ)
- [ ] Publish
- [x] Booking admin page: HQ approve/reject before OS (needs hold step before relay)
- [ ] Deep security scan on live build

- [ ] Run production build + restart test, verify build tool pinned 2.25.2
- [ ] Google Calendar for agents (waiting on user: which kind)
- [ ] Fill 15 projects details (waiting on user data; template given)
- [x] Lock down project-images storage (public read rule replaced with signed-in-only, migration 0097)
- [ ] Google Calendar: view-only agent panel + shared Winstone team calendar + per-agent own calendar (user chose all three 2026-10-11)
- [ ] Ever-Call-Recorder (Shizuku two-sided recording) into Winstone Android app — user chose: rewrite own Shizuku-style recorder (no GPL code copied); not started

## Queue 2026-10-11 (late)
- [x] Team calendar: add confirmed site visit button (visit's agent + HQ/IT)
- [ ] Per-agent Google Calendar connection (needs workspace Google OAuth client)
- [x] Audit: persisted findings + append-only remediation timeline (HQ/IT write)
- [x] Audit: per-finding report + all-findings report (CSV/print)
- [ ] Run skipped photo checks once staff signed in; confirm HQ audit entry
- [x] Build-tool guard: block preview start if not 2.25.2
- [x] Status report: preview crash, build-tool root cause, recovery steps
- [x] Verify new leads appear in list promptly after refresh throttle
- [x] Compare one day's lead list vs call list before/after; report DB load drop
- [x] Per-call lead report auto-update alongside board
- [x] AI summaries: cache server-side, charge only first generation
- [x] Review reference images/video; assess modern dashboard redesign
- [ ] Measure DB lead-list load drop after publish (counters unchanged in preview)
- [ ] Per-agent Google Calendar connection approval
- [x] Regression test: simulated failed module import → notice, reload, fallback (bun run test:recovery)
- [x] Social media moderation (Method A): desk Social section, HQ report, pages + reply templates
- [x] Rename app: WINSTONE PULSE — The Premium Real Estate CRM · PULSE — Find. Build. Invest. (web, PWA, Android, emails, PDFs, exports)

- [x] HQ social: per page/group summary of leads, conversions, outcomes
- [x] Social pages: audit log of who changed name/link/active and when
- [x] Command Center date-range filter + clickable Leads/Calls/Follow-ups tiles
- [x] 5:20 PM Dhaka agent contribution report popup (first: since joining; then daily; ≤5 sentences, ≤120 words)
- [x] Desk honours from/to date range from Command Center tiles (chip + সরান)
- [x] HQ /contributions page: filters, summary, review (append-only), CSV
- [x] Reskin (mint/orange/teal, Outfit): tokens/sidebar/header → desk → HQ pages → entry/sign-in
- [x] Support inbox keeps last tickets during failed polls
- [x] Home: remove duplicate banner image under hero
- [x] Audit log (created/edited/archived, who, when) — awaiting plan approval
- [x] Backups: daily export, single-record restore (full restore = platform-level) — awaiting plan approval
- [ ] Reconnect Google Calendar — blocked: project owner lacks access to the existing connections
- [ ] Email domain notify.crm.winstonebd.com — waiting on DNS records at registrar
- [ ] Auto Google Calendar events for site visits + follow-ups (only real saved times/places) — blocked: Google Calendar connection not linkable (owner lacks access); also need: shared office calendar vs each agent's own
- [ ] Email .ics invite to the agent per event from notify.crm.winstonebd.com — blocked: DNS (TXT + 2 NS) not yet verified
- [x] Workspace device cards use uploaded photos
