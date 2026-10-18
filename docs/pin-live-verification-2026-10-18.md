# PIN safety release and live checks

- Published verified copilot and PIN protections to crm.winstonebd.com.
- Corrected confirmed-failure accounting: beginning or abandoning a verification lease does not count as a wrong PIN. Only an accepted, completed wrong verification increments the count. Correct verification resets it. Row locks and bounded leases serialize account/surface attempts.
- 43 targeted tests passed, including separate-account and Nexus/IT surface isolation checks. Build OK.
- Actual live isolated browser verified four wrong attempts then successful reset, five consecutive wrong attempts showing 5:00, reload not bypassing pause, and correct PIN succeeding after five minutes. No PIN values printed or captured.
- Live copilot prepares an editable build instruction and quantity 25 without AI calls. Latest live allocation list has no agents in this available session, so agent-prefill and actual allocation are not claimed as passed. Prior authorized preview selected WIN2607 correctly; this does not substitute for full live verification.
- All-agent sign-in and real daily-report/follow-up writes remain unverified: available session is not an authorized agent work session. Eight approved active agents and two inactive/rejected profiles retain their existing state. No impersonation, fabricated report, import or allocation.
- Counts unchanged before/after: 4,863 leads, 4,152 reports, 1,503 follow-ups, 753 follow-up changes, six contributions.
- Database-level synthetic RPC test was refused by service-only access. No grant widened; no claim of direct SQL concurrency integration pass.
- Fresh security scan: no critical findings; existing project-photo signed-in download warning unchanged and outside this task.

Documentation recorded after publication.