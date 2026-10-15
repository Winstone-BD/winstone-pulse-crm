# Winstone Pulse — Production-Readiness Audit (read-only) and Fix Plan

No data, accounts, billing, leads or secrets were changed. Nothing was published.

## Checks run
- Typecheck (`tsgo --noEmit`): clean, exit 0.
- Offline test suite (`vitest run`, staging tests excluded): 685 passed, 2 skipped, 1 failed.
- Database metadata (read-only): RLS status, anon grants, maintenance rows (metadata only, no PII).
- Lockfile/pin inspection.

## Findings

### STOP-SHIP
1. **Build tool pin has drifted again** — `package.json` line 109 (devDependencies) says `@lovable.dev/vite-tanstack-config` `2.25.3`. Overrides (line 32/139) and `bun.lock` still say 2.25.2. Evidence: `tests/build-config-pin.test.ts` fails ("expected '2.25.3' to be '2.25.2'"), and `prebuild` (`check-build-tool-pin.mjs`) will block the next production build. Impact: you can't publish; 2.26-era output has crashed the live Worker before. Fix: set line 109 back to `2.25.2` (code-only).

### High
2. **Daily-sheet scheduled sync isn't live yet** — `src/routes/api/public/hooks/daily-sheet.ts` accepts `SHIFT_CRON_SECRET` / `LOVABLE_CRON_SECRET` server-side (good: no secret in code). The live site still runs the old version, so the 6:30 PM job gets rejected until you publish. Fix: none in code. Publish once item 1 is fixed (needs your approval).

### Medium
3. **Database tables with RLS on but no policies: 58** — There are no tables without RLS and no `anon` grants (0). The 58 tables are therefore locked to the server key ("server-only by design", e.g. `objection_answers`, `sales_drafts`, `os_event_receipts`). Not an exposure, but there's no inventory proving each one is meant to be server-only. Fix: add a read-only test that lists these tables against an allowlist, so a new table without policies fails CI.
4. **Stale `lock_status` field** — The September 2026 row shows `payment_status=verified` but `lock_status=active`. `maintenance.server.ts` works out the lock from payment/unlock status and lock_at, not from `lock_status` (lines 117–211), so no workspace is wrongly locked. But reports or AI that read `lock_status` could show a false lock. Fix (code-only): make the display and any readers use the computed status. No data change.
5. **Recent AI/marketing server functions need an auth re-check** — The buyer-extract, buyer-facts and sales-drafts modules exist. In build mode, confirm with a source test that each one uses `requireSupabaseAuth` plus a lead-ownership check. This audit pass didn't line-review them.

### Low
6. Deep security scanner results were stale/incomplete earlier. Rerun after publishing.
7. Live tests (`test:smoke:signed-in`, staging, restart) were not run: they need a real account or touch the shared database.

## Maintenance bill and lock state (read-only, confirmed)
- **October 2026:** fee snapshot $46.29 (stored historical snapshot, OS plan; left as is), due 2026-10-11 18:00 UTC, lock_at 2026-10-14 18:00 UTC (15 Oct 00:00 Dhaka). payment_status `verified`, reference present, unlock `none`, review_status `pending_review` (the owner-instruction exception). Because it's verified, there's **no lock**.
- **September 2026:** verified. Stale `lock_status` field only (finding 4).
- **November 2026:** no row yet. It's generated 1 Nov at $35.29, due 14 Nov. A lock is only possible from 15 Nov 00:00 Dhaka, and only if that invoice is unpaid. CRM stays open through 14 Nov 2026.

## Proposed patches (only after approval; all code-only, no schema, billing or data changes)
1. Restore the pin on `package.json` line 109 to `2.25.2`, then re-run the pin test, typecheck and full offline suite.
2. Add `tests/rls-policyless-allowlist.test.ts`: read-only, skips without a DB connection.
3. Make the maintenance display use the computed lock state, not raw `lock_status`. Add a regression test using the "verified + lock_status active" case.
4. Add source tests confirming auth and ownership guards on the buyer-extract, buyer-facts and sales-drafts server functions. Patch any gap found.
5. Publishing stays a separate step that needs your approval.

## Limitations
No EXPLAIN on production queries was run beyond the earlier optimization pass. No signed-in browser flows. No Android or device checks. No live Google Sheets or Drive calls. No AI calls on real leads.
