# Nearby leads and real-data verification

## Build
- Extend the Android agent feed with each assigned lead's saved address.
- Ask for foreground location permission in Winstone Connect and calculate straight-line distance using Android's on-device geocoder; never upload the agent's GPS position.
- Show distance on lead cards and add a nearest-first view for leads whose addresses resolve; unresolved addresses stay visible after located leads.
- Keep every outbound call behind the existing briefing and pending-report server locks.

## Verify with existing data
- Use an existing assigned lead and its saved history to run the real pre-call brief path and inspect persisted transcription/report linkage without exposing customer phone numbers or transcript text in chat.
- Verify an existing Inventory project in the daily report against underlying leads/calls/explicit site-visit/booking rows. Do not insert fake production activity merely to raise metrics.
- Re-run web tests, type checking, Android tests/build, and security checks for the new location permission.

## Phone-only acceptance
- Produce a new APK build for installation. A real SIM call, Android call-log connection detection, six-answer submission, and resulting Hot/Warm/Cold can only be certified on the user's physical phone; provide the exact short acceptance sequence after the build is ready.

## Scope safeguards
- No existing lead, report, assignment, or history is changed or deleted.
- GPS remains on-device; only the lead's already-saved address is returned to its assigned agent.
- Existing scoring, project-report formulas, auth, and role boundaries remain unchanged.
