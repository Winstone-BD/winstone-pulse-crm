# tests/ rules
- Staging E2E (tests/staging) is opt-in and refuses the live project ref — why: preview and live share one DB.
- Restart recovery: `bun run test:restart` (sandbox-only; --account/--self/--list-accounts); post-publish: `bun run test:smoke` (live, signed out, read-only) — why: blank screens need real restarts/loads, not unit tests.
- Live tests needing a signed-in staff user use tests/fixtures/staff-session.ts (reuses an existing unexpired session, never creates users or prints tokens) — why: preview and live share one database.
