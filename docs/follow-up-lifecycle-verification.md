# Canonical follow-up lifecycle verification

## Implemented
- Original follow-up schedule, purpose, report link, identity and creation timestamp cannot be overwritten. Existing historical records are retained.
- Completion, cancellation, rescheduling and missed actions require a permanent reason. Completion stores its outcome and never changes lead status.
- Rescheduling atomically resolves the original and creates a linked replacement. Repeated request keys return the prior result rather than repeating the action.
- Saved-report follow-up creation is atomic and deduplicated by report ID; it preserves prior tasks as rescheduled. Existing missed-call cooldown rules are retained.
- Agents require ownership of both the event and the currently assigned lead. HQ viewing remains read-only; database mutation helpers are server-only.
- Lead 360 and agent dossiers display permanent follow-up history. Overdue, Due Today, Completed and Upcoming health counts filter the list; dates use Asia/Dhaka.
- Terminal records no longer appear as open reminders in sibling readers.

## Actual checks
- 75 test files / 522 tests passed on the final complete run. A short-lived project-photo expiry test failed on the earlier run and passed on both retry and final run; no photo permissions were changed.
- Latest harness typecheck/build: OK. Semantic color check: PASS.
- Read-only database check: 1,503 follow-ups, including 689 done, unchanged before/after. Lifecycle guard and append-only history trigger present. Anonymous and authenticated direct execution of the privileged transition helper refused.
- Browser at `/desk?s=calendar`: desktop health loading view observed without overflow. Subsequent injected-session navigation stopped at the mandatory contribution form. No real report was submitted and no follow-up was changed.

## Not verified / risks
- Populated agent workflow, filters after loading, completion/cancel/reschedule read-back and phone/tablet rendering require clearing the real staff contribution gate legitimately. No mock rows or bypass were used.
- Missed is an explicit recorded action after the scheduled time; overdue is derived automatically. No background automatic missed-event writer was added.
- The overall existing call-report submission still commits its report and lead writes separately from follow-up creation. Follow-up creation/transitions themselves are atomic; complete call-report transaction recovery is outside this change and remains a production risk.
- No deployment or real customer/staff record mutations were performed. The additive lifecycle guards apply immediately to older deployed clients too: old reason-free completion and in-place schedule edits are now refused; updated UI is only in preview until published.