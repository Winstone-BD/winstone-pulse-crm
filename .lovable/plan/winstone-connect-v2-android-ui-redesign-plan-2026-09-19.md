# Winstone Connect V2 Android UI Redesign Plan

## Goal
Update the Android APK UI to match the provided V2 mockups: black-gold theme, role-based dashboards, richer agent dashboard, Lead 360, Call Disposition, AI Coach, Coordinator/HQ/IT Console surfaces, and a unified bottom navigation per role.

## What the mockups show
1. **Login Screen** — Employee ID + password, "Login & Launch", black-gold branded.
2. **Role Selection** — Sales Agent, Coordinator, Executive HQ, IT Console cards with Bengali labels.
3. **Agent Dashboard** — Good Morning greeting, Today's Progress bar, 6 KPI tiles (Assigned, Called, Connected, Interested, Follow-up, Site Visit), Start Calling CTA, Today's Priorities list (Hot Leads, Follow-ups Due, New Assigned Leads, Missed/Retry Calls), and a role-based bottom nav (Home, Leads, Calls, AI Coach, More).
4. **Lead 360 / Lead Details** — Profile header with Hot badge, ID, masked phone, location, budget; tabs Overview, Activity, AI, Notes; Lead Status, Priority, Last Contact, Next Follow-up; Call, WhatsApp, Add Note, Schedule buttons.
5. **Call Disposition / Call Result** — Select Call Outcome list (Connected, Interested, Not Interested, Call Back, No Answer, Wrong Number, Site Visit, Other), Save & Next Lead CTA.
6. **Agent AI Coach** — Performance insight, Today's Coaching CTA, Daily Performance target progress and sub-metrics.
7. **Coordinator Dashboard** — Total Queue, Unassigned, Assigned Today, Pending, Duplicate Blocked, Active Agents; Assign Leads CTA; Balance Queue, Import Leads, View Floor actions; Agent Workload table.
8. **Executive HQ Dashboard** — Date scroller, total/calls/connected/interested/site visits/conversion metrics, Top 3 Today leaderboard.
9. **IT Console Dashboard** — System health list (CRM API, Database, Auth Service, Call Sync, AI Services, WhatsApp) plus Data Health tiles.
10. **More / Profile** — Profile header, Settings, Notifications, Help & Support, About App, Logout.

## Proposed implementation

### Phase 1: Foundation and auth flow
- Update `Theme.kt` colors and typography to match the V2 mockups (darker surfaces, gold accents, rounded cards, progress-bar gold).
- Redesign `SignInScreen.kt` to use Employee ID + password and the branded black-gold login layout.
- Add a `RoleSelectionScreen.kt` shown immediately after login if the profile has multiple roles/capabilities; persist selected role in `AgentSession`.

### Phase 2: Agent dashboard and bottom navigation
- Rewrite `DeskScreen.kt` into a true agent dashboard:
  - Greeting header with avatar, name, employee ID, role, notification bell.
  - `TodayProgressCard` with progress bar and percent.
  - `KpiGrid` replaced by 6 statistic cards in the mockup style.
  - "কল শুরু করুন" / "Start Calling" primary CTA.
  - `TodayPrioritiesCard` with Hot Leads, Follow-ups Due, New Assigned Leads, Missed/Retry Calls and badge counts.
- Add a new `LeadDetailsScreen.kt` (Lead 360) navigated from the Leads tab or a call action.
- Add `CallDispositionScreen.kt` for post-call outcome selection, opened after a call ends.
- Add `AiCoachScreen.kt` with performance insight and coaching CTA.
- Add `MoreScreen.kt` / profile menu.
- Update bottom navigation to the 5-tab mockup style per role.

### Phase 3: Role-specific dashboards
- `CoordinatorDeskScreen.kt`: queue metrics, Assign Leads CTA, quick actions, agent workload table.
- `ExecutiveHqScreen.kt`: date selector, performance metrics, Top 3 Today leaderboard.
- `ItConsoleScreen.kt`: system health status list and data-health tiles.
- Route the correct home screen based on selected role.

### Phase 4: Backend support
- Add/extend server functions to feed new dashboard data:
  - `getAgentDashboardMetrics` — today's assigned/called/connected/interested/follow-up/site-visit counts and progress.
  - `getAgentPriorities` — hot leads, due follow-ups, newly assigned leads, missed/retry calls.
  - `getCoordinatorQueue` and `getAgentWorkload`.
  - `getExecutiveMetrics` and `getTopPerformers`.
  - `getSystemHealth` and `getDataHealth`.
- Keep existing call-report validation, lead resolution, offline sync, and reminder behavior intact.

### Phase 5: Build and release
- Bump `versionCode` and `versionName`.
- Build signed release APK.
- Upload to `app-downloads` bucket and publish a new `app_releases` row.

## Guardrails
- Existing logic remains: mandatory post-call report, offline sync queue, duplicate lead resolution, call log sweeper, reminders, and update checker.
- Bengali labels remain primary; mockup English placeholders are translated to Bengali.
- Black-gold theme stays, tuned to match the mockups.
- Role selection respects current least-privilege RBAC and does not grant extra capabilities.

## Open decisions
1. Should the agent be able to switch roles after selection without re-logging in? (Recommended: yes, from the More menu.)
2. Should the login identifier remain phone number, or should it switch to Employee ID as in the mockup? (Mockup shows Employee ID; currently the app uses phone + password.)
3. For Coordinator/Executive/HQ/IT Console roles: should those surfaces be visible only when the user has the matching role, or always visible with locked states?
