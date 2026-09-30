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
- LeadHub Nexus access requires its dedicated server-verified PIN scope; agent, team-leader, and retired Coordinator sessions cannot read or mutate it — why: UI hiding alone is not security.

- Every lead import lands UNASSIGNED in the Canonical Lead Database; only LeadHub quantity assignment moves leads to agents — why: one source of truth and no quota bypass.

- Daily accountability: agent_accountability_reviews table is server-only (no client RLS policies); unlock/approve requires the HQ PIN scope, never IT — why: business rule says final approval is Executive HQ only.

- The temporary 2026-09-30 maintenance closure has ended; home, CRM roles, and Android default to open while retaining the server control for future emergencies — why: stale offline clients must not remain locked.

- Android V2 reports send six raw yes/no evaluation answers; the server derives score/category/priority and legacy reports are never rescored — why: one locked rule across web, phone and offline replay.
- Project reporting uses Inventory requirement labels as the current project dimension; site visits and bookings count only explicit saved report signals — why: no separate projects, site-visits, or bookings model exists yet, so free-text inference would invent facts.
- Agent calls require a daily 9:05 Asia/Dhaka briefing acknowledgement for the current policy version, enforced on the server across web and Android — why: UI-only notices are bypassable.
- Android nearby-lead distance uses foreground device location plus on-device geocoding of the assigned lead's saved address; the agent's GPS is never uploaded or persisted — why: proximity must not become staff tracking.

- Staff display names are cleaned in the database (profiles trigger strips MD/MSD/Mohammad/মোঃ); the original entry is kept only in profiles.legal_name, never selected for UI — why: one rule for web, Android and reports.
- Contact-close reasons are enforced by a call_reports DB trigger and logged as immutable `lead_events` kind `contact_closed` — why: server/UI checks alone can be bypassed.
- follow_up_events rows cannot be deleted; every change logs old/new values to follow_up_changes — why: history must be append-only.
- Agent self-claim (`claimLead`) is retired; only LeadHub assignment moves pool leads — why: single canonical assignment path.
- Agent mutations call `assertAgentBriefing`/`assertBriefingForCaller` from agent-briefing.server — why: 9:05 gate must be server-side on every protected action.
- Monthly maintenance lock ($35.29 USD, 14th 00:00 Dhaka) is decided only in `maintenance.server.ts`; `resolveCaller` and `src/server.ts` (device 423) enforce it, IT full PIN + /architect exempt — why: one server-authoritative state, no UI-only lock.
