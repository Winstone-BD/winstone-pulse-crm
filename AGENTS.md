<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->
- Lead assignment only via LeadHub Nexus (server PIN scope); imports land unassigned; claimLead retired — why: one canonical path, no quota bypass.
- agent_accountability_reviews is server-only; approval needs HQ PIN, never IT — why: Executive HQ final approval.
- 9:05 Dhaka briefing ack enforced server-side on every agent mutation (web + Android) — why: UI notices are bypassable.
- History is append-only: follow_up_events never deleted, contact-close via DB trigger + immutable lead_events — why: UI checks can be bypassed.
- Staff names cleaned by profiles trigger; legal_name never shown — why: one rule everywhere.
- Android V2 sends six raw yes/no answers, server scores; nearby-lead GPS never uploaded — why: one scoring rule, no staff tracking.
- Project = inventory requirement labels; site visits/bookings only from saved report signals — why: no invented facts.
- Staging E2E (tests/staging) is opt-in and refuses the live project ref — why: preview and live share one DB.
- Server-module rules live in src/lib/AGENTS.md; workspace_role_grants are session-verified read-only HQ authority, never IT/LeadHub — why: preserve ownership without write escalation.
- Dense CRM data views use compact cards below `md` and full tables at `md+`; lower-frequency wide tables scroll only inside `.table-scroll` — why: phone usability without weakening desktop comparison views.
- Winstone OS inbound events only via POST /api/public/os/events (HMAC + idempotency in server-only os_event_receipts); mapping never invents entities — why: one verified, replay-safe bridge.
- Lead neglect: zero-work leads get 2 business-day notices (recall on the 3rd) then recall to the pool via `lead-neglect.server.ts`; recalls are append-only disputes, DB blocks re-assigning to the same agent and call-start refuses them — why: leads must not rot and the rule can't be bypassed from the UI.
- UI language uses src/lib/i18n.ts (useLang/useT, localStorage, Bengali default); new UI strings add { bn, en } pairs there or inline — why: one switch for both languages.
- Pin @lovable.dev/vite-tanstack-config to 2.25.2 — why: 2.26.0 emits createRequire(import.meta.url) that crashes every page on the live Worker.
- Bookings start `approval_status='pending'`; only HQ/IT approval (server-checked authority, decision final via trigger) queues the signed OS relay event — why: HQ gatekeeps what reaches Winstone OS.
- Knowledge Hub (winstonebd.com) data enters the CRM only as public pages (website_pages), verbatim official RSS news (market_news origin='official') and signed `site_visit.requested` events on /api/public/os/events into server-only website_visit_requests; a request becomes a site_visit only when the agent/HQ confirms it — why: no invented facts, one verified bridge.
- Vite pre-bundles the TanStack router-core/seroval/h3-v2 deps in vite.config optimizeDeps.include — why: late discovery re-optimized on every cold start and broke open tabs (stale chunks / invalid server-fn IDs).
- Restart recovery is regression-checked by scripts/restart-recovery-check.py (bun run test:restart; sandbox-only, kills local Vite) — why: blank screens after restarts must be caught by a real restart, not unit tests.
- Module recovery coalesces concurrent failures and bounds each availability probe with a timeout — why: duplicate browser events and hanging requests must not loop reloads or strand a blank tab.
- Router-caught module import failures dispatch the shared recovery event instead of being reported immediately as fatal crashes — why: lazy-route errors may be caught before browser global error listeners see them.
- Live tests needing a signed-in staff user use tests/fixtures/staff-session.ts (reuses an existing unexpired session, never creates users or prints tokens) — why: preview and live share one database.
- Board live refresh coalesces realtime changes into one snapshot reload per 8s and hidden tabs only mark it stale — why: per-change full-floor reloads in every tab were the top database load.
- Call UI reuses scoped notes/history and reporting; SIM controls use Android Telecom InCallService with explicit dialer-role consent, never a browser bridge — why: real controls, unchanged CRM gates.
- Desk uses a non-scrolling section grid; mobile navigation opens from below — why: avoid sideways navigation.
- Social moderation: CRM logs work only (append-only social_activity_logs) and makes unassigned leads via intakeLead — why: no Meta API; LeadHub assigns.
- Workspace wrappers and portals inherit src/styles.css tokens; shared Buttons separate actions from accents — why: one palette everywhere.
- Shared headers stack phone actions, dialogs reserve close-button space, tables contain horizontal scroll — why: improve all workspaces without changing workflows.
- Desk work views (Pipeline/Tasks/Activities/Outlook in desk/WorkViews.tsx) are read-only over the scoped snapshot; stage changes stay in call reports — why: no second write path.
