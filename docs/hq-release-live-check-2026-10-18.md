# HQ permission-conflict release — live verification

Published to https://crm.winstonebd.com on 2026-10-18.

## Release evidence
- Publish tool scheduled the current source; subsequently a fresh signed-in live browser opened Nexus with its real dedicated PIN and found the newly added instruction-copilot input. This identifies the new release, not merely an older HTTP 200 page.
- Desk, HQ, Reports and Nexus return HTTP 200; no page errors or HTTP 5xx in the browser checks.
- Own-report panel and calendar opened. The Log call entry dialog opened with the required phone field and disabled Open report action while empty. No phone entered, no report created, no customer action submitted.
- Current injected session belongs to an admin, not a Sales Agent. Own reports are empty, while the authorized calendar shows floor data. Therefore populated agent report submission and follow-up edit confirmation are NOT verified.

## Safety and tests
- HQ/own-work boundary and follow-up tests: 39 passed. Exact build-tool pin test initially failed because package metadata had reverted; installed the mandated 2.25.2 version and its test then passed.
- Harness build log reports build OK after the correction.
- Customer counts before and after: 4,863 leads; 4,152 call reports; 1,503 follow-ups; 753 follow-up changes; six contribution reports.
- No roles, ownership, customer data or financial data changed during this release check.
- Fresh security scan has no critical findings; existing authenticated project-photo download warning remains outside this task. Permissions were not changed to remove it.

## Blocked verification
An actual authorized agent session with an assigned lead, truthful report/outcome and agreed follow-up change is required to submit and read back the central write flows. Do not fabricate a report, create a test customer on live, or impersonate an agent through admin/PIN access.

This note is a documentation-only update after publication.