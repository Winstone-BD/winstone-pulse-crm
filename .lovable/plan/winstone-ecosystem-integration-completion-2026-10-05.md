# Winstone ecosystem integration completion

## Goal
Finish and harden the integrations that legitimately belong in the existing Winstone ecosystem without creating another CRM, LeadHub, lead store, or ERP.

## Confirmed boundaries
- CRM remains the canonical lead and Lead 360 system; LeadHub Nexus remains the only assignment path.
- Web only captures public enquiries into the canonical CRM intake.
- Winstone OS remains ERP/operations/finance; CRM accepts verified OS booking/payment events without inventing records.
- Public MCP will expose only public project/property facts. Private leads, contacts, calls, recordings, reports, staff data, and payments will not be exposed.
- WhatsApp is for customer notifications, never OTP.
- No fake production data, destructive database changes, invented credentials, or live write tests.

## Work plan

### 1. Resolve the current maintenance-email change
- Keep the confirmed maintenance fee at **$46.29 USD** everywhere in the active maintenance system and database defaults; leave verified historical payments unchanged.
- Send service-bill alerts through Hostinger only, using `sender`, `recipient`, `subject`, and `body`; never fall back to the managed app-email sender.
- Keep sign-in codes and password resets on Lovable’s managed email system.
- Verify `HOSTINGER_SENDER_EMAIL` is exactly `info@winstonebd.com` and `NOTIFY_EMAIL_ENDPOINT` is a real HTTPS URL before sending a test.
- Publish only after the Hostinger endpoint returns success. Current blocker: the saved endpoint is not a valid URL and the saved sender is not confirmed as `info@winstonebd.com`.

### 2. Canonical Web / CRM / OS data flows
- Audit every public enquiry entry point and route it through the existing canonical lead intake with validation, source attribution, normalized Bangladesh phone dedupe, idempotency, and unassigned LeadHub intake.
- Preserve the existing OS receiver contract, HMAC/Bearer verification, replay window, event receipt ledger, retry semantics, and canonical booking/payment mapping.
- Add outbound CRM→OS behavior only for a real required event and a configured OS endpoint; otherwise document inbound-only status rather than create a fake handoff.
- Expose safe sync status and explicit retry controls to authorized IT/HQ users using existing event receipts; no automatic destructive retry.

### 3. Webhook reliability and observability
- Wire the existing webhook delivery ledger into applicable verified webhooks.
- Harden Paddle replay/out-of-order handling before treating it as production-ready.
- Preserve WhatsApp’s provider-message dedupe and monotonic delivery status; add delivery-attempt visibility without weakening signature checks.
- Standardize safe error classes: permanent validation/auth errors versus retryable rate-limit/server failures.
- Use existing audit and server logs; do not add a new monitoring vendor without an authorized connection.

### 4. Authentication and authorization
- Preserve current email/Google authentication and server-side RBAC/RLS.
- Prepare phone OTP for a real Bangladesh SMS gateway only: 6 digits, 300-second expiry, auto-confirm off, Send SMS Hook, request throttling, and staff-account/role verification after OTP.
- Do not enable phone OTP or choose a provider until a real gateway connection and credentials exist.
- Review the database linter’s security-definer warnings and the one shared support-category read policy; fix only confirmed exposure without breaking intended shared support knowledge.

### 5. Public MCP privacy
- Replace the current CRM-operations MCP toolset with a read-only public catalog limited to verified project/property facts, or disable the public MCP until such facts are safely available.
- Remove write tools and access to leads, phone numbers, reports, call intelligence, recordings, staff rosters, and floor metrics from the public MCP manifest.
- Keep private operational tooling inside authenticated CRM surfaces.

### 6. Real connector status
- Keep the linked Google Drive connection and verify its current CRM archive access without creating retained probe files.
- Keep the newly linked GitHub API connection for legitimate repository automation only; do not treat it as Git sync or create repository hooks without a specific repository target.
- Meta Ads, WhatsApp Business, and Lovable API app connectors remain **CONFIGURATION REQUIRED** unless a real authorized workspace connection exists.
- Do not let optional connectors block CRM/OS core operations.

### 7. Verification and release gate
- Run focused tests during changes, then full typecheck, lint, full tests, build, RLS/security scans, and safe read-only endpoint checks.
- Do not claim lint clean if unrelated pre-existing lint errors remain; report them precisely.
- Do not publish while Hostinger is unverified, critical security findings exist, or the release gate fails.
- Final report will classify every area as **CONNECTED / IMPLEMENTED / CONFIGURATION REQUIRED / BLOCKED / VERIFIED**, list changed files and database changes, name endpoints and secret names only, and state publish safety.

## Current verified status
- Backend healthy; latest preview build succeeds.
- Full tests pass: 48 files, 323 tests.
- Typecheck passes.
- Lint currently fails on pre-existing formatting/type issues, primarily in tests.
- Google Drive is linked; GitHub API is now linked.
- Security scan has one info-level shared-category policy finding; dependency scan reports one high transitive Firebase advisory and one moderate development-server advisory.
- Hostinger test did not send because the saved endpoint is invalid; nothing was published.
