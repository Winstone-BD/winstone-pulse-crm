# Winstone CRM — Roadmap Status Review (check only, nothing changed)

This review is based on the current code, tests and database structure, checked today. Nothing was built, edited, migrated or published during it.

## Phase-by-phase status

| # | Phase | Status |
|---|---|---|
| 00 | Discover / Audit | COMPLETE |
| 01 | Architecture integrity | COMPLETE |
| 02 | Data + Security | PARTIAL |
| 03 | CRM Core (Lead → Call → Report → Follow-up → Site Visit → Booking) | PARTIAL |
| 04 | Sales Command Center | PARTIAL |
| 05 | Sales Intelligence | COMPLETE (code) / PARTIAL (content) |
| 06 | News Intelligence | PARTIAL |
| 07 | WINSTONE AI | PARTIAL |
| 08 | Analytics / Reporting / Exports | PARTIAL |
| 09 | UX / Responsive / Design System | PARTIAL |
| 10 | Final QA / Production release | BLOCKED |

### 00 Discover / Audit — COMPLETE
- **What exists:** full audit history. There are 40 test files with 278 passing tests. Read-only checks of the live data confirmed 3,980 leads and 2,935 call reports.
- **Missing:** nothing for this phase.

### 01 Architecture integrity — COMPLETE
- **What exists:** one canonical leads table, and LeadHub Nexus is the only way leads get assigned. The old self-claim and the two bypass assignment paths are closed. Server functions keep a strict split between server-only code and code that runs in the browser. The project rules are recorded in the project's AGENTS.md notes.
- **Must not build:** a second lead table, a mini CRM, or any other assignment path.

### 02 Data + Security — PARTIAL
- **What exists:**
  - Access rules are switched on for every table.
  - History can't be edited or deleted: append-only triggers protect follow-ups, lead events, pitch events, news records and the maintenance log, and leads can't be deleted.
  - Who is acting always comes from the server session or PIN, never from the browser.
  - The 9:05 briefing gate is enforced on the server.
- **Missing:**
  - A fresh security scan. The last scans ran before Sales Intelligence and News were added.
  - Proof that the staging database is separate from the live one.
- **Dependencies:** a staging copy of the project with its own database.
- **Leave untouched:** all current data and access rules.

### 03 CRM Core — PARTIAL
- **Done:** Lead, Call (Android on the agent's own SIM, plus sync), Report (required after each call, one per call, repeat submissions ignored), Follow-up (a required reason, change history, calendar and alarm) and Lead 360.
- **Site Visit — partial:** it is counted only as a signal saved in a call report. There is no site-visit record, so no scheduled, completed, cancelled or no-show status.
- **Booking — partial:** also only a signal saved in a call report. There is no booking record and no deal value.
- **Needs new database tables:**
  - `site_visits`: lead, agent, scheduled time, status, and the actual outcome.
  - `bookings`: lead, project or unit, amount in USD, and date.
  - Both would link to the existing canonical lead. Lead 360 would only **add** them to its timeline — the leads table itself stays unchanged.
- **Leave untouched:** the call and report flow, the report-scoring rules and existing reports.

### 04 Sales Command Center — PARTIAL (see detail below)

### 05 Sales Intelligence — COMPLETE in code, PARTIAL in content
- **What exists:** the AI Sales Brief, the Smart Pitchbook (copy, WhatsApp prefill, save to history), pitch history that can't be edited, pitch effectiveness worked out from real linked events, HQ knowledge admin, and exports scoped to each role.
- **Missing:** 0 market facts and 0 pitch events so far, so HQ needs to enter real sourced facts. There is no customer budget field.
- **Must not build:** a second pitch or fact store.

### 06 News Intelligence — PARTIAL
- **What exists:**
  - Google News collection every 3 hours, Bangladesh-first.
  - Filters out duplicates, anything older than 14 days and anything unrelated.
  - AI Bengali summaries that must match the source: any number not in the original story gets it rejected.
  - HQ can post manually, edit, hide or re-publish, and collect right away.
  - Agents and HQ see the feed, and the latest stories show in Sales Intelligence.
- **Differs from the roadmap:** automatic stories are **published straight away**. The roadmap asks for "HQ approval → Agent feed". The table already supports a `pending` status, so this only needs a code change and a setting, no new table.
- **Missing:** an approval queue with a switch between auto-publish and approve first. Stories are not yet linked to specific leads or projects.

### 07 WINSTONE AI — PARTIAL
- **Exists:**
  - Lead evaluation: six yes/no answers, scored on the server.
  - AI Sales Brief.
  - Smart Pitchbook.
  - Winstone AI Agent Copilot drawer, which proposes actions for the user to confirm.
  - AI Coach.
  - HQ question box.
  - Pre-call brief.
- **Not started:**
  - Property Matching: nothing matches leads to inventory yet. It needs a structured record of each customer's requirement (budget, area, size) and structured inventory units. That means new columns or tables linked to the lead, never changes to the canonical leads fields.
  - Sales Concierge (customer-facing): the English support desk exists, but there is no sales concierge.

### 08 Analytics / Reporting / Exports — PARTIAL
- **What exists:** project reports, day call export, Lead 360 export, Top 3 breakdown export, pitch exports and the manual PDFs.
- **Missing:** revenue and booking reports (needs phase 03's booking record) and a site-visit funnel report.

### 09 UX / Responsive / Design System — PARTIAL
- **What exists:** the side menu (collapsible, with keyboard controls), a fixed top bar, device-aware install (Android app or web app, iPhone steps), consistent phone field sizes, and safe spacing around notches.
- **Checked:** 13 main pages at Android, iPhone, tablet and desktop sizes, signed out — no sideways scrolling and no errors.
- **Missing:** the signed-in HQ, agent and PIN screens haven't been checked on a real device. The shared visual style isn't fully unified yet: some pages still use their own custom buttons and filter chips.

### 10 Final QA / Production release — BLOCKED
- **Blocker:** the staging call → report → lead history test has never run on a database proven separate from live.
- **External checks still open:** real SIM calls and recordings, the Android app build, the Architect's Google sign-in plus secret step, WhatsApp Business, the email DNS records for notify.winstonebd.com, and client sign-off.
- **Deployment:** publishing was requested today, but the live site hasn't been confirmed to be serving it.

## Sales Command Center — detail

| Widget | State |
|---|---|
| KPI Pulse (6 cards) | Done. Revenue shows "—" because there is no deal value. |
| Funnel (Leads → Contacted → Interested → Site Visit → Booking) | Done, with conversion %. The last two steps come from report signals only. |
| Today's Execution | Done for leads against the 50-per-agent quota and follow-ups. Site visits show "no target set". |
| Agent Performance | Done: bars against the quota, drill-down to Agent 360. |
| Source Performance | Done, sortable table. |
| Follow-up Health | Done: due today, overdue, completed, upcoming, all with drill-downs. |
| Site Visits (scheduled / completed / cancelled / no-show) | Missing. Needs the `site_visits` table. |
| Booking / Revenue trend | Partial. Booking counts are shown; revenue has no data. |
| Smart Insights | Done. Shown only above data thresholds, otherwise "not enough data". |
| Global filters | Date (7D / 30D / month / custom), agent, source and project. No team filter because no teams exist. |
| Drill-downs | Done for KPIs, funnel, follow-ups and agents. |
| Responsive | Checked only on the public signed-out view; the dashboard itself, behind the PIN, hasn't been seen on a device. |
| Loading / empty states | Loading placeholders and empty states exist. |
| Role-aware scope | The dashboard lives inside HQ only. There is no agent version of the dashboard. |

## Must not be built again (duplicates)
- A second leads or customer table, a mini CRM, or a separate news-to-lead store.
- Any assignment path outside LeadHub.
- A second AI assistant: extend Winstone AI and Copilot instead.
- A second fact store: news-derived facts should feed the existing market facts through HQ verification.

## Recommended safest order

```text
1. Staging copy with its own database -> run the call/report/lead-history test (clears phase 10)
2. Fresh security scan on the current build
3. News: HQ approval queue + setting to auto-publish or approve first (no new table)
4. Site visit record (new table, linked to leads) -> Command Center site-visit widget
5. Booking record with USD amount (new table) -> revenue KPI, booking and revenue trend, reports
6. Structured customer requirement + inventory units (new tables) -> Property Matching
7. Sales Concierge on the support desk, grounded in verified facts only
8. Unify buttons and filter chips into shared components; signed-in device QA
9. Final release gate: tests, build, staging pass, publish, external operational checks
```

## Technical notes
- New tables needed: `site_visits`, `bookings`, a customer requirement table (or added lead-profile columns in a side table), and structured inventory units. None of them change existing columns in `leads`, `call_reports` or `follow_up_events`. Existing report signals stay as history; the new records are added alongside them and old reports are never rescored.
- News approval: set `status='pending'` on automatic collection, depending on a setting in `system_settings`, and add a pending tab to the News admin panel. The audit log is already append-only.
- Lead 360: only new timeline sources are added. The canonical lead record and its assignment rules stay unchanged.
- All existing production data and logic must remain untouched throughout.
