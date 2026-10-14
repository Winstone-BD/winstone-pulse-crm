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
- Accountability reviews are server-only; final approval needs HQ PIN, never IT.
- 9:05 Dhaka briefing ack enforced server-side on every agent mutation (web + Android) — why: UI notices are bypassable.
- History is append-only: follow_up_events never deleted, contact-close via DB trigger + immutable lead_events — why: UI checks can be bypassed.
- Staff names cleaned by profiles trigger; legal_name never shown — why: one rule everywhere.
- Android V2 sends six raw yes/no answers, server scores; nearby-lead GPS never uploaded — why: one scoring rule, no staff tracking.
- Project = inventory requirement labels; site visits/bookings only from saved report signals — why: no invented facts.
- Staging E2E (tests/staging) is opt-in and refuses the live project ref — why: preview and live share one DB.
- Server-module rules (maintenance, Sales Intel, Market News, notes, service bills, telemetry, AI cache, contributions, desk range) live in src/lib/AGENTS.md.
- Dense CRM data views use compact cards below `md` and full tables at `md+`; lower-frequency wide tables scroll only inside `.table-scroll` — why: phone usability without weakening desktop comparison views.
- Winstone OS inbound events only via POST /api/public/os/events (HMAC + idempotency in server-only os_event_receipts); mapping never invents entities — why: one verified, replay-safe bridge.
- Lead neglect: zero-work leads get 2 business-day notices (recall on the 3rd) then recall to the pool via `lead-neglect.server.ts`; recalls are append-only disputes, DB blocks re-assigning to the same agent and call-start refuses them — why: leads must not rot and the rule can't be bypassed from the UI.
- UI language uses src/lib/i18n.ts (useLang/useT, localStorage, Bengali default); new UI strings add { bn, en } pairs there or inline — why: one switch for both languages.
- Pin @lovable.dev/vite-tanstack-config to 2.25.2 — why: 2.26.0 emits createRequire(import.meta.url) that crashes every page on the live Worker.
- Bookings start `approval_status='pending'`; only HQ/IT approval (server-checked authority, decision final via trigger) queues the signed OS relay event — why: HQ gatekeeps what reaches Winstone OS.
- Knowledge Hub (winstonebd.com) data enters the CRM only as public pages (website_pages), verbatim official RSS news (market_news origin='official') and signed `site_visit.requested` events on /api/public/os/events into server-only website_visit_requests; a request becomes a site_visit only when the agent/HQ confirms it — why: no invented facts, one verified bridge.
- Vite pre-bundles React, react-router and the TanStack router-core/seroval/h3-v2 deps in vite.config optimizeDeps.include — why: late discovery re-optimized on every cold start and broke open tabs (stale chunks / invalid server-fn IDs).
- Restart recovery: `bun run test:restart` (sandbox-only; --account/--self/--list-accounts); post-publish: `bun run test:smoke` (live, signed out, read-only) — why: blank screens need real restarts/loads, not unit tests.
- Module recovery lives in src/lib/deploy-recovery.ts (injected by __root): it coalesces concurrent failures, bounds each availability probe with a timeout, and reloads only once the module that failed serves again, not merely the page — why: a restarting server answers its document long before its modules, and reloading into that state stranded a blank tab.
- Live tests needing a signed-in staff user use tests/fixtures/staff-session.ts (reuses an existing unexpired session, never creates users or prints tokens) — why: preview and live share one database.
- Theme colours live only in src/styles.css token overrides (.hq-luxe/.theme-light plus a `.dark` ancestor); the dark toggle only flips a class on <html> — why: the reskin must never touch logic.
- Billing uses PLAN_CODE=crm only; CRM/OS entitlements are independent.
- IT PIN yields a 10m challenge; completeItAccess checks approved admin roles and issues an 8h user-bound token; officer portraits never grant access — why: PIN/selection cannot identify IT staff.
- Architect/Super Admin roles come only from the profiles-insert trigger + server-only privileged_account_allowlist (confirmed email, first user binds); payment approval stays architect identity (Google+PIN) — why: no UI/API grants them.
- Subdirectories have their own AGENTS.md; read it before changing files there.
- Homepage role selection only filters existing entry cards; recommendations use getMyAccount and operational access uses useMaintenance with explicit unavailable states — why: navigation must not grant roles or fabricate health/access.
- Client IP for limits/logs comes only from cf-connecting-ip via requestSourceKey; 429s use rateLimitedResponse (Retry-After, no internals); no IP allowlists/office binding — why: X-Forwarded-For is spoofable and staff work from any network.
