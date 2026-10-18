# Protected workflow follow-up — 2026-10-18

## Live checks (existing release, crm.winstonebd.com)
- Injected signed-in Monisha WIN2604: Desk, follow-up calendar, HQ and LeadHub gate returned HTTP 200, zero page errors/5xx.
- Confirmed bug: supplemental HQ permission made Desk floor-wide and removed agent briefing/contribution eligibility; follow-up writes then failed read-only checks.
- Dedicated LeadHub PIN was available in the secure testing environment. A fresh PIN-only browser successfully unlocked through the actual UI; canonical database and distribution history loaded with no page errors. No PIN, token or session data was logged. No import or assignment submitted.

## Corrected in preview, not published
- Explicit agent own-work resolver retains authenticated approved agent original rights while default HQ resolver remains read-only; no PIN impersonation and no new grants.
- Desk account/snapshot cache separates own-work from HQ views; own follow-up feeds and completion/recovery use canonical assigned-lead checks.
- Daily contribution and briefing endpoints recognize HQ-granted agents in own-work context; real contribution form now appears at 5:20+ in Desk. No fabricated report submitted.
- Supplemental HQ cannot review bookings; genuine HQ PIN review exception preserved. Migration settings, runtime resolution and manual health-check side effects require existing write authority.
- LeadHub instructions now accurately require its separate PIN.
- Restored declared build config 2.25.2; override remains pinned.

## Verification
- Preview signed-in Desk shows personal queue (320 leads during check) and genuine contribution form. HQ remains readable/populated, without an agent contribution modal. No page errors.
- 555 tests / 80 files passed, including 9 HQ/account boundary checks and four concrete read-only endpoint denial checks.
- Latest harness build checked separately: build OK.
- Read-only database count check: leads 4,863; call reports 4,152; follow-up events 1,503; follow-up changes 753; daily contributions 6. Testing performed no customer/report/recovery/assignment writes.

## Remaining limits
- Actual daily contribution submission requires the staff member's truthful report. Do not manufacture it or remove the gate.
- Follow-up recovery submission, call-report submission and LeadHub import/assignment are not end-to-end verified on live customer data; no arbitrary customer mutations authorized by a generic verification task.
- Corrections are not published; live checks above describe the existing release, not the corrected preview.
- Previously documented durable PIN-throttling gap is not fixed by this scope; no brute-force test attempted.
