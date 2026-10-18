# Instruction copilot and PIN protection verification

## Delivered, not published
- Nexus and IT instruction drafting uses no AI calls. Common assignment requests prepare the existing form; only Nexus's existing confirmed server path assigns leads. IT links to Nexus, never gains dispatch privileges.
- Signed-in preview: `assign 25 leads to WIN2607` selects the correct agent and quantity. Today's full quota correctly prevents additional allocation. Editable Lovable instructions and 360px layout verified.
- Vault PIN comparisons for IT/HQ read master/IT entries only, never Nexus. Existing environment PINs, tokens, roles and encrypted vault values are preserved; no plaintext PIN storage added.
- New server-only authentication state is additive, with atomic begin/finish leases, service-only grants and RLS. No customer table or existing business data changed.
- Verified accounts use account+surface counters; signed-out PIN authentication uses a server-signed HttpOnly session cookie. No shared-IP blocking. Clearing the anonymous cookie creates a new anonymous session; account protection persists across devices. This is not a global bot defense.

## Actual preview browser checks
- Four wrong attempts followed by a correct PIN succeed and reset the counter.
- Five consecutive wrong attempts show `5:00` pause and disable entry.
- Reload and correct PIN cannot bypass the server pause.
- After five minutes, correct PIN succeeds.
- No real PIN/token appeared in logs, screenshots or documentation. Security tests affected only an isolated anonymous attempt counter, never customer records.

## Current live release checks
- crm.winstonebd.com Agent, follow-up, HQ and IT pages returned 200 with no page errors or HTTP 5xx.
- Current signed-in session is an admin with no assigned leads. Empty Agent view is not a populated agent end-to-end pass.
- Genuine Nexus PIN unlock: canonical database, distribution history/quality and assignment form opened. No import/assignment submitted.
- Genuine IT PIN unlock: account/access view opened. No account/settings edits submitted.
- HQ real floor populated with 4,863 leads.
- Read-only inventory: eight active approved agents have owned leads and HQ oversight; two inactive/rejected agent profiles stay blocked. This is not eight-agent browser verification.

## Remaining verification blockers
- Full all-agent end-to-end testing requires authorized sessions for each agent and truthful daily reports/customer-specific mutation targets. Never fabricate these or impersonate agents through a PIN.
- Changes are not published; live checks apply to the existing release, not the new PIN guard/copilot.
- Full-suite run: 557 passed, seven failed (six require an agent session but current injected session is admin; one build-version pin corrected afterward). Focused security/authorization/draft checks passed; no claim of all-suite pass.