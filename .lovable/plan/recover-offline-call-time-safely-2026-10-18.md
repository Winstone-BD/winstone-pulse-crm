# Recover offline call time safely

## Verified findings
- **AI credit warning:** current workspace balance is 115.33 credits. The previous depletion finding is marked stale, not fixed by purchasing credits. Current quick briefs already return a saved-facts summary and opener on AI failure. Today's Gateway error query returned no rows; live generation remains unverified. No customer data was sent to AI.
- **Offline talk time:** confirmed. A queued 10-minute call is capped near 60 seconds when start and finish arrive together, or zero when completion arrives first. Android currently does not preserve the original event timestamp in this state queue.
- Removing the cap or trusting backdated phone timestamps would enable inflated rankings. The correction therefore needs approval rather than a one-line cap removal.

## Proposed changes
1. Preserve device-reported talk time separately from verified timing and label it **Device-reported — unverified** in call history and reports. A 600-second offline call retains its 600-second claim without pretending it is verified.
2. Keep unverified claims out of trusted performance totals and rankings. Preserve existing scoring policy until independent verification or an explicitly approved review rule is available; server elapsed time alone is not proof of connected talk time.
3. Capture the original event time when Android queues a call state; replay that same timestamp on retries. Device timestamps establish reported chronology, not independent evidence.
4. Reconcile late and out-of-order updates without downgrading a completed call or erasing its timing. Carry reported/verified timing consistently through the existing mandatory report path.

## Technical details
- Add protected reported-duration/provenance fields to the existing call/report records, updating the canonical Android call-state and report-opening paths.
- Review call views, exports and performance readers so reported values cannot accidentally feed trusted rankings.
- Preserve device authentication, assigned-lead checks, call ownership, stable IDs and recording availability rules.
- Do not guess historical durations, alter finalized records or weaken the existing anti-inflation cap.
- Record the approved architecture in AGENTS.md during implementation.

## Verification
- Regression tests: 600-second offline replay; completion-first; forged timestamps; duplicate and out-of-order replay; other-agent denial; consistent report/export timing; exclusion of unverified claims from trusted totals.
- Use synthetic fixtures only. Existing brief/access coverage currently passes: 14 tests.
- Run affected tests and the exact 2.25.2 pin guard; if the known pin drift blocks validation, restore the mandated version before continuing.
- Physical offline replay needs an authorized test handset and remains unverified until tested.

## Approval boundary
Approval covers implementation and required additive fields, not publication, historical corrections, AI model changes or credit purchases. No application code or production data changed during this review.
