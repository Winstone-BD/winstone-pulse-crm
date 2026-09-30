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
- Coordinator Deck access = `deckAccess()` in access.server.ts (full/intake/none); Sell Team Admin intake is server-enforced, never widens dispatch/IT — why: UI hiding alone is not security.

- Imports and coordinator intake always land in the Head Lead Store UNASSIGNED; only Coordinator Deck distribution (daily quota) or manual assignment moves leads to agents — why: one source of truth, no bypass of the 50/day rule.

- Daily accountability: agent_accountability_reviews table is server-only (no client RLS policies); unlock/approve requires the HQ PIN scope, never IT — why: business rule says final approval is Executive HQ only.

- The temporary 2026-09-30 11:30 Asia/Dhaka maintenance closure is a global non-dismissible gate — why: home and every CRM role must stop using CRM until IT confirms reopening.

- Android V2 reports send six raw yes/no evaluation answers; the server derives score/category/priority and legacy reports are never rescored — why: one locked rule across web, phone and offline replay.
