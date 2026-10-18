# Workspace audit — 18 October 2026

## Verdict: PARTIAL PASS — authorization risks remain

Audit target: current preview, signed in as Monisha WIN2604 with supplemental read-only Executive HQ access. This is not an ordinary ungranted-agent browser session. No customer records, reports, assignments, receipts or recovery actions were created or changed. No publication requested.

| Workspace | Observed result | Limit |
| --- | --- | --- |
| Sales Agent `/desk` | HTTP 200, populated queue and real data, no page errors or HTTP 5xx | Current account also has HQ oversight; pure agent isolation relies on existing server tests, not this browser view. No call/report submitted. |
| Follow-ups `/desk?s=calendar` | HTTP 200, populated permanent activity list | Completion, cancellation and recovery not submitted against real customers. |
| Executive HQ `/hq` | HTTP 200, populated charts and 4,863 total leads after loading | At 20 seconds it still showed zero placeholders; populated at 60 seconds. Slow/loading-state behavior needs attention. |
| LeadHub Nexus `/leadhub` | HTTP 200, PIN unlock gate; no private workspace shown | Dedicated LeadHub PIN unavailable; import/assignment end-to-end not verified. Gate copy incorrectly implies ordinary HQ/IT PIN works, while server requires LeadHub scope. |
| IT Console `/system` | HTTP 200, renders system overview under HQ authority; restricted panels show authorization denial | Read-only HQ can enter wrapper because RoleGate accepts all authority. IT-only operations were not exercised with a full IT token. `/it` is not the application route. |

Browser checks at 1280×1800: no uncaught page errors or HTTP 5xx in these flows. Desktop screenshots reviewed. Mobile, published version and external integrations not re-audited in this task.

## Confirmed code-level concerns

1. `reviewBooking` in `src/lib/bookings.functions.ts` accepts any authority, including supplemental read-only HQ accounts, before approving/rejecting bookings. Existing genuine HQ PIN approval must remain authorized; supplemental agent oversight must not implicitly gain this operational capability. Do not blindly block all HQ PIN approval.
2. `setMigrationChecklistItem` in `src/lib/migration-checklist.functions.ts` checks authority but omits `requireWrite` before changing system settings.
3. `setRuntimeIssueStatus` in `src/lib/runtime-errors.functions.ts` accepts read-only authority before changing issue status. `runHealthCheckNow` also warrants write-side-effect review.
4. `unlockAdmin` in `src/lib/crm.functions.ts` has no attempt throttling visible in its code path. Existing in-memory rate-limit utility is explicitly best-effort, not a durable credential security boundary. No brute-force attempts made.

These findings were source-inspected, not exploited against live data. They remain unresolved by this audit. Existing role unit tests do not cover the three concrete endpoint write paths.

## Tests

- Independent focused authorization runs: 27 Agent/HQ tests and 40 Nexus/IT tests passed (overlapping suites, not additive coverage).
- First complete run: 545 passed, 1 failed across 79 files. Failure: build-tool declaration drifted to 2.26.5 despite the 2.25.2 override. Restored declared development dependency to the required 2.25.2; final results recorded below after rerun.
- Final complete rerun: **546 passed / 79 files**, no failures; declared, locked and installed build-tool versions all verified as 2.25.2. Latest harness build log at 16:46:36 UTC: **build OK**. No manual build/typecheck run; harness handles them.

## Release limits

Do not certify all four workflows as fully working or fully production verified. Required remaining evidence: full IT-token browser flow; dedicated LeadHub unlock/import/assignment flow; ordinary agent mutation flow after legitimate daily gates; endpoint-specific read-only write regression tests; durable PIN throttling; fresh production verification after publication.