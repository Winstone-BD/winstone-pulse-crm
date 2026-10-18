# Recording recovery and safe live staff checks

## Read-only diagnosis, 2026-10-18 UTC
- 601 recording rows: 43 have audio references; 558 have neither storage_path nor audio_url. These include historical call-only rows: absence of a reference does not prove that a phone captured a recoverable file.
- All 43 referenced paths matched actual call-audio storage objects. Contents, two-sided speech and phone capture were not verified.
- Three sync-failed rows already have uploaded audio references. Their stored error is transcription failure; they are **not three missing uploads**.
- 12 rows remain marked processing, dated September. A stale analysis claim may be reclaimed only if the timestamp remains unchanged and is older than 15 minutes.
- No recording_drive_backups rows; 55 summary backup rows and 55 audio objects. Summary backups do not establish recording backups.
- Accessible Google Drive connector discovery returned only an unavailable connection (project owner lacks access). No actual Drive metadata could be checked from chat; Drive backup verification remains BLOCKED. No files uploaded, copied or deleted in Drive during this check.

## Implemented in preview
- IT Console recording list defaults to 30 days, maximum 200 rows, explicit sample notice and searchable visible recording IDs; missing audio, STT/AI and Drive failures are distinguished.
- Restore an authentic audio file on the original recording through authorized IT upload; validate audio bytes and 24 MB size, preserve call/report/lead identities, refuse replacement when an audio reference exists, require confirmation, append audit, and never run AI automatically.
- Separate Drive and analysis retries; no analysis on missing audio or a live processing claim. Failed/unavailable outcomes are not successful retries.
- Compare-and-set timestamp claim protects analysis from concurrent requests. Saved transcript is persisted before AI and reused on an AI retry to avoid repeated transcription charges.
- Drive API access errors are unverified, not proof that a file is missing. Existing done/verified recordings do not produce another backup upload.
- No alert acknowledged; no lead assignment or automatic classification. Assignment remains Nexus-only; classifications require real report answers.

## Safe real-agent procedure
1. Agent signs in with their own authorized account. A staff/admin session is not necessarily an agent session; never share passwords, PINs or tokens, impersonate agents or weaken gates.
2. Agree on an owned lead, real call/report and follow-up action. Complete briefing and contribution truthfully; no fabricated production fixtures.
3. Submit real report once. Reopen through own-report UI; compare ID, time, factual answers and next action. Confirm no duplicate report.
4. Change only the agreed follow-up with permanent reason. Reopen calendar and Lead 360 history. Reschedule must show original plus linked replacement; completion must not close the lead.
5. Record Employee ID, UTC/Dhaka time, report/follow-up identifiers, before/after state, PASS/FAIL/BLOCKED and reason. Exclude customer audio, credentials and tokens from evidence.

## Verification limits
The available managed session is an admin session, not a populated agent session. Authenticated IT preview renders the recovery checklist and recording controls without page errors. No authentic phone audio was supplied, so recovery upload and paid analysis were not executed. No live report or follow-up was changed. Full submission/read-back remains BLOCKED on actual agent session and authorized truthful input. This change is not published by this task.

Tests: recording recovery, Drive verification, call-report rules, follow-up lifecycle, PIN guard and local instruction copilot. Browser screenshots are internal evidence, not shared customer exports.