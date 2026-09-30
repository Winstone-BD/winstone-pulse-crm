# Roadmap

## Active
0. **Phone-friendly CRM tables** — Completed: high-use lead, support, performance, accountability and synced-call tables now become compact phone cards while retaining full laptop tables; remaining wide tables use contained touch scrolling.
0. **Google Drive reconnection** — Completed: linked a fresh Google Drive account in the new workspace and verified access.
0. **LeadHub Nexus consolidation** — Completed: Coordinator entry removed; dedicated PIN-only canonical database, import, quality, oldest-first quantity assignment and safe `/dispatch` redirect added.
1. **Correct agent performance analysis** — Use actual call duration/connected status/outcomes from `call_reports`/`calls`/`recordings`, not report submission counts. Identify who is actually wasting leads (short/no-answer/fake reports) vs genuinely working them.
2. **Google Sheets reconnection** — Pending; user paused to fix report logic first.
3. **Follow-up priority** — Completed: Hot/Warm/Cold-derived priority and overdue/due/category ordering across server reminders and web views.
4. **System update report** — Completed: factual IT update history from persisted app release notes.
5. **IT Council notice board** — Completed: IT publishing to all/role/accounts, recipient inbox, read state, replies, web realtime, push and Android notification feed.

## Backlog
3. Revisit Google Sheets connection after report is accepted.

## 2026-09-30 request (pending answers)
- [ ] Lead brief per assigned lead: why given, value, call script, conversion tips, callback date
- [x] Inventory-based per-project daily/monthly report: leads, calls, explicit site-visit signals, closed/converted bookings
- [ ] APK nearby-lead cards (blocked: sign-in cannot be removed — security)
- [x] Locked V2 scoring (6 questions, auto category/priority, no manual Hot/Warm/Cold) — web/server/Android
- [x] 9:05 daily briefing acknowledgement gate (server-side, web + Android popup)
- [x] Android foreground-only nearby-lead sorting from saved addresses (on-device geocoding; GPS never uploaded)
- [ ] Smarter distribution: project expertise, site visits, prior follow-ups
- [x] V2 six-question scoring on web/server/Android (version 2.13 mandatory release published)

## Open — Daily performance engine (rules locked 2026-09-30)
- [ ] Capped weighted KPI performance %, separate compliance state
- [ ] Deterministic 5:30 PM Top 3 from stored snapshot
- [ ] 6:00 PM Dhaka finalization lock + admin correction with reason/audit
