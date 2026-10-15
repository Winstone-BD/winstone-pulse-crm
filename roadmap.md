# Roadmap

## Active
- [x] Read-only production-readiness validation (2026-10-15): cron `winstone-daily-sheet-sync` registered 30 12 * * * UTC = 18:30 Dhaka, active, x-cron-secret from system_settings; live endpoint enforces 401 without/with-wrong secret; maintenance lock rules verified (9th notice, 14th due, 15th 00:00 Dhaka lock); STOP-SHIP pin drift re-introduced by SAML commit — fixed package.json+bun.lock to 2.25.2; added daily_sheet surface telemetry to sheet-metrics.server.ts + daily-sheet.server.ts (failures/success now in sheet_sync_events); typecheck clean; 690 passed/5 skipped/0 failed. No publish.
- [ ] Region filter for Daily report sheet + lead list, per-agent region scoping — awaiting user answers (region source for leads: `area` is empty on all 4857 leads; agent-region assignment; visibility semantics vs current assigned-only rule; region list). Must not weaken assigned-only lead security without explicit instruction.
- [ ] SAML SSO for winstonebd.com (Entra ID recommended): configure via SSO form (needs full Entra Federation Metadata URL with Tenant ID + domain winstonebd.com); then add sign-in code using supabase.auth.signInWithSSO with public redirect (window.location.origin), test signed-out state; never touch live accounts/roles.
- [ ] Gemini buyer-profile extraction: Gemini reads saved call notes and suggests buyer-check values (budget, type, timeline, decision maker, installment, NRB); agent applies into the draft. Prompt guard applied; nothing saved/sent. Unpublished; untested on a real lead.
- [x] Diagnose recurring old billing presentation: monthly defaults/rules still 46.29, mixed 18.16 notice literals and 12th/15th text; no financial records changed. Added homepage role selector and network/account/server-access status; 10 tests passed, 1280/828/390/320px no overflow, IT PIN and agent sign-in destinations verified. Real signed-in role recommendation unverified; no deployment.
- [x] Simplify homepage using approved reference hierarchy, unframed capabilities, truthful server status and phone-friendly workspace selection; preserve fonts/auth/billing. Browser checked at 1280/828/390/320px, optional reveal/device selection/real IT PIN dialog passed; no deployment or business-record changes.
- [x] Require device selection before Get started; uploaded IT portraits after PIN; service billing restricted to existing verified architect identity plus user-bound IT token. 572 tests passed/5 skipped; phone/desktop UI checked with mocked PIN response, no live login or publish.
- [ ] Map Head/Officer to real IT accounts and enable assistant onboarding: blocked on their login emails and verified account identities; never use shared passwords as embedded credentials.
- [x] Hide signup/portals until Get started; reorder HQ, Agent, LeadHub, IT; require identified IT account after PIN. Phone/desktop reveal and PIN screen checked; 569 tests pass, 5 skipped; no publish.
- [ ] Verify real IT PIN → authorized officer email/password → console and session audit. Blocked: verified officer login emails/account mapping and authorized test PIN missing; do not invent accounts or write live test audit records.

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
- [x] Subscription notice card: amber "Payment due soon" (dismissible), blue "verification in progress", red "Workspace suspension pending" with live deadline chip and one red "Review invoice & pay" action (#DC2626 / hover #B91C1C on #FEF2F2), verified removes the notice and shows "Subscription active". Red reserved for payment; HQ/IT entry buttons stay deep green. 510 tests, typecheck clean, build OK, phone+desktop checked. Amber/blue/verified states not seen on screen (October CRM invoice is unpaid, so live state is red). Not published.
- [x] Minimized subscription notice moved into page layout: it now sits below the page content (home + app shell), never overlays features; tap still expands the full card, Minimise folds it back. Pages without the app layout keep the floating fallback. Fixed the hydration mismatch this caused (notice renders only after hydration) — 0 hydration errors on /, /news, /inventory, /docs, /help, /desk; expand verified on phone; 17 billing/entitlement tests, typecheck and build clean. Not published.
- [x] Blank-screen fix: a tab whose module stops loading now waits until that module actually serves again before reloading (was: reload as soon as the page answered, 3 attempts in ~2s, then a blank Refresh screen). Verified with a reproduction that blocks the entry module — recovers instead of falling back; real restart leaves all 8 pages clean; 510 tests, typecheck and build clean. Not published.
- Security: restrict audit-name lookup, support escalation to assignee/managers, recordings to current lead owner

- [ ] Real-phone check: "no answer" save → next lead opens; redial within 15 min shows warning. Needs a person on a real agent phone (would write a real report to live data).
- [x] Homepage signup form (name, email, phone) → sign-up page prefilled.
- [x] Caveat page headings (h1) site-wide; Inter for everything else.

- [x] Secure auto role setup for System Architect + Super Admin on first sign-up
- [x] Homepage redesign, black/gold kept
- [x] Verify real sign-in for both accounts (both approved admins)

- [ ] Smart lead scoring + neglected high-potential lead flags for coordinators (from workspace chat)
- [ ] Lead scoring v1: transparent score (engagement, duration, AI sentiment), coordinator neglected high-potential list, manual reassignment + transfer safeguards
- [x] Insight score (25/40/35) beside locked V2 score, in dossier/desk; LeadHub neglected high-potential list + safeguarded manual reassignment

- [x] Reconnect Firebase Cloud Messaging in new workspace
- [x] Review AgentForge project; port useful agent persona/skills parts

- [x] Pipeline answers (whitelisted questions, real counts, role-scoped) next to Winstone AI
- [x] Call coach shows HQ-approved objection answers (exact match only)
- [x] Handover due dates (docs 7 days after first completed visit, payment on booking day) + bell/push reminders
- [x] /daily-sheet HQ page, one row per lead, CSV
- [ ] Google Drive (recordings) + Google Sheets (daily sheet) sync — in progress: opening connect cards for both in the new workspace; sync code follows once linked
- [ ] Run Gemini buyer-check on a real call note and save — needs an agent to confirm in the app (live data)
- [ ] Marketing Content draft + social-post-style preview (copy only, labelled draft, no publishing) — next release
- [ ] Reference-project website checks (AgentForge, Social Post Preview) — waiting on their public website URLs; on-demand only, no continuous tracking
