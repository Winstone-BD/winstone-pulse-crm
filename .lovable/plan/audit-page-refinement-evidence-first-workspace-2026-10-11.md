# Audit page refinement — evidence-first workspace

## What exists today (inspected)

- **Route:** `/audit-report` (`src/routes/audit-report.tsx`). It's a public page, hidden from search engines (`noindex`), and doesn't need a sign-in. The PDF version lives at `/winstone-audit-report.pdf`.
- **Data source:** everything on the page comes from one fixed source file, `src/lib/handover-docs.ts`. That file holds:
  - `AUDIT_ITEMS`: 12 rows of item, result and evidence text.
  - `AUDIT_SECTIONS`: scope, architecture, roles, test results, what was not verified, and deployment.
  - `AUDIT_DATE`, `AUDIT_COMMIT` and `DOC_VERSION`.
- **Layout:** `src/components/crm/DocPage.tsx` lays it out as one long document: a single table followed by sections of text.
- **Separate live data:** the log of privileged actions (`audit_logs`) is read by `auditTrail` in `ops.functions.ts`. It's shown in the IT Console (`AuditTrail.tsx`, `/system`) and needs the HQ/IT PIN. It isn't part of `/audit-report`.

## Data the page does not have

No records exist for any of these:

- Audit runs (the "last run" time is a fixed date written into the document)
- Severity
- Expected vs actual state
- Reviewer notes
- Remediation timeline
- Integrity hash
- Links from a finding to related events

Following the "real data only" rule, the plan does **not** invent these. Where a field has no data, the detail panel leaves it out, or shows "Not recorded" in the few places where leaving it out would mislead. No filter or button is added without data behind it.

## What changes

1. **Header at the top:** the title, the scope (one line taken from the "scope" section), and "Audited 2026-09-30 13:40 UTC (19:40 Dhaka) · Version c9a5020". It is labelled as the documented audit date, not a live run.
   - Small counts, worked out from `AUDIT_ITEMS`: total items, PASS, and qualified PASS (for example "PASS (code/test)" or "PASS (public pages)").
   - A count of items not verified, taken from the "ops" section.
   - The PDF download stays.
2. **Findings list as the main area:**
   - A search box over the item and evidence text.
   - A filter by result type, built only from the results that actually appear.
   - Wide screens: a compact table (No., item, result, short evidence preview).
   - Phones: compact cards.
   - Search and filter are saved in the page address, so a filtered view can be shared.
3. **Finding detail panel:**
   - Opens when a row is clicked or Enter is pressed. It slides in from the side on wide screens and fills the screen on phones.
   - Shows the full evidence text, the scope it covers, the result in plain words (what "code/test" means), the audit date and version as the timestamp, and the matching "not verified" limits where they apply.
   - Mentions of database rules (triggers, migrations, tests) are shown as plain text references. No live lookups are made.
4. **Reference sections:** the architecture, roles, lifecycles, test results and deployment notes move into collapsible sections below the list. That means less scrolling, and none of the content is removed.
5. **"Not verified" gets its own panel:** it's kept clearly visible, so a qualified PASS is never shown as full certification.
6. **Actions:**
   - Download PDF and Print, which already exist.
   - Copy a link to a finding, which only uses the page address.
   - No reviewer notes or remediation actions are added, because the app has no supported way to store them.
7. **Look and feel:**
   - Uses the existing design colours and fonts, neutral surfaces and thin borders.
   - Result badges use the existing green/amber style, always with text plus an icon, never colour alone.
   - Print styles keep the PDF output looking right.
8. **States:**
   - The data is fixed, so there is no loading or error state to show.
   - Shown: an empty state for "no results match your search" with a clear-filters button.
   - Shown: a "stale" notice when the audit date is more than 30 days old. The real date is already more than 30 days old, so the notice will show.
   - Not shown: a "no permission" state, because the page is public. Leaving it out is more honest than making one up.

## Risks and constraints

- Unchanged: the route, the public `noindex` access, the head metadata, the PDF path, and `handover-docs.ts` as the single source, which `/handover` and the PDFs also use.
- No database, permission, server or migration changes, and nothing is published.
- Live audit logs are **not** pulled into this public page, because that would expose PIN-protected data. They stay in the IT Console.
- Wording stays honest: "PASS (code/test)" is never shortened to "PASS".

## Verification

- Code check (`tsgo`) and the existing tests. Add a small test that the page's counts and filter options match `AUDIT_ITEMS` exactly.
- Browser checks at 390, 768 and 1280 px:
  - no sideways scrolling
  - the detail panel opens and closes using Tab, Enter and Esc, and focus returns to the row afterwards
  - the search with no results shows the empty state
  - the print preview still renders
- Confirm the build tool is still exactly 2.25.2.

## Your decisions (optional)

- Should the IT Console's audit log get the same redesign? It's live data behind the PIN and would be a separate step.
- Do you want real reviewer notes or remediation tracking? That would need a new append-only table, so it needs a database change and your approval. It's not part of this plan.

## Technical details

- New `src/components/crm/audit/` folder with `AuditHeader`, `FindingsRegister` (table and cards), `FindingDetailSheet` (the existing sheet/dialog component, focus trap), and `AuditReferenceSections`.
- Pure helpers in `src/lib/audit-report-view.ts`: parse the result type, count results, search/filter. These have unit tests.
- Search state is checked with `validateSearch` (zod) on the route: `q`, `result`, `item`.
- `DocPage` stays unchanged for `/handover`.
