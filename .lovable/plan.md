# Winstone Company lead safety audit and fix

## Current production findings

- The live counts match the supplied audit facts: **1,454 leads**, **973 ever assigned/worked**, **587 with direct call fields**, and **0** with source `Winstone Company`.
- The current schema has no lead-type/category or outreach EN/BN columns. Existing compatible storage is `notes`; `company` remains the customer/company name.
- Phone uniqueness currently applies only to the literal `phone_number` text, so `01…` and `8801…` can coexist.
- There are **306 normalized duplicate phone groups**, containing **613 rows** and **307 excess historical rows**. Every duplicate group has assignment/call history. Source combinations are: 181 `csv + head_database`, 120 `csv_import + import`, and 5 `agent_app + head_database`.
- Current import and assignment paths use several different eligibility rules. Some check only `assigned_to`, and some compare unnormalized literal phone text.

## Implementation

### 1. One database-level phone identity

- Add immutable SQL helpers that extract all valid Bangladesh mobile numbers from one value and canonicalize each to `8801XXXXXXXXX`.
- Support `+8801XXXXXXXXX`, `8801XXXXXXXXX`, `01XXXXXXXXX`, punctuation, spaces, and safely separated multi-phone values.
- Add a private phone-key registry keyed by canonical phone and backfill it deterministically. For historical duplicates, select the canonical lead by: any history first, then earliest creation time, then UUID.
- Preserve every historical lead row. Record duplicate-group audit facts; do not delete, merge, or rewrite call/assignment history.
- Add database triggers so a new lead or a changed phone cannot claim a canonical phone already held by another lead. Registry uniqueness makes concurrent imports deterministic and server-enforced.

### 2. Permanent worked/assigned exclusion

- Add one database eligibility function that treats a normalized phone as previously worked when any matching historical lead has `assigned_to`, `assigned_agent_id`, `call_count`, `call_attempts`, `last_call_at`, or rows in `lead_assignments`, `call_reports`, `call_recordings`, or `lead_events`.
- Guard first-time assignment of an unassigned row at the database layer, while preserving legitimate reassignment of a lead already owned by an agent.
- Update daily distribution, coordinator assignment, auto-distribution, command-agent, copilot dispatch, Android/web intake, webhook resolution, CSV/Sheet import, and agent-file import to use the same server-side identity and eligibility rules.
- Existing historical duplicate rows remain readable, but cannot re-enter the eligible pool or be newly assigned.

### 3. Winstone Company import metadata and counts

- Save all new company-import rows with `source = 'Winstone Company'`.
- Store `Lead Type: Company Lead` in the existing notes metadata convention, without overwriting supplied notes or the actual `company` value.
- Extend compatible CSV/Sheet parsing for EN/BN outreach columns when present and preserve those values in notes; no incompatible lead columns will be invented.
- Return and audit exactly: `incoming`, `excludedAlreadyWorkedOrAssigned`, `excludedDuplicate`, and `eligibleNew`. A row matching both history and an incoming duplicate is counted once, with worked/assigned taking precedence.
- Show the bilingual result summary on the import screen and expose the latest audited import summary in the existing IT lead-database panel where practical.

### 4. Production-safe rollout and verification

- Apply the schema change through one Lovable Cloud migration with grants, RLS, trigger/function security, deterministic backfill, and no destructive statements.
- Add regression tests for all three Bangladesh formats, multi-phone input, duplicate rows inside one batch, historical activity through every listed table, concurrent duplicate attempts, metadata preservation, and assignment blocking.
- Re-query production after migration to confirm the historical duplicate totals are unchanged, no old records were deleted, new duplicate inserts are rejected, and worked phones cannot return to the pool.
- Run the project’s automated typecheck/build validation and focused tests, then report exact before/after counts and any malformed phone values separately.

## Technical boundaries

- Authentication, RBAC/RLS, current ownership synchronization, reporting, call history, and reassignment workflows remain intact.
- No historical lead is deleted or merged, and no fake cleanup result is produced.
- The database is the final enforcement point; UI filtering is only explanatory.