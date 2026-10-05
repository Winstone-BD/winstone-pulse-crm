# Service Bill Review Workflow

## Build
- Add a read-only `/service-bill-alert` page showing the canonical current bill: Winstone IT service, USD $46.29, Pending Review, issuer/recipient, created/due timestamps, and no payment controls.
- Add `/service-bill-unlock` using the existing signed-in CRM identity and role checks, plus a server-only `SERVICE_BILL_UNLOCK_PIN` gate. Keep its short-lived review session in memory only.
- Unlock bill details for authorized human review only. Do not verify payment, approve a transaction, submit funds, or call any payment provider.

## Data and security
- Reuse `system_maintenance` and `maintenance_audit`; add only the review metadata genuinely missing from the current bill record.
- Record immutable unlock-attempt, details-viewed, and test-email events without PINs, tokens, or email credentials.
- Enforce database-backed per-identity/IP attempt limits so retries remain safe across server instances.
- Return the requested JSON fields only: `bill_id`, `service_name`, `amount`, `currency`, `status`, `issuer`, `recipient`, `created_at`, `due_at`, `review_status`, `reviewed_by`, `reviewed_at`.

## Email
- Add a Winstone-branded $46.29 service-bill alert email with a review link.
- Add an authorized test-send action using the existing Hostinger relay only when its existing secrets plus `SERVICE_BILL_APPROVER_EMAIL` are configured.
- If configuration is incomplete, return only missing secret names. No managed-email fallback and no secrets in client data or logs.

## Verification
- Add focused tests for bill projection, no-payment behavior, role/PIN access, rate limiting, audit safety, email content, and missing-secret reporting.
- Run targeted lint, typecheck, full tests, production build, and mobile/desktop browser checks of both pages.
- Do not publish unless explicitly requested after verification.

## Assumptions
- “Unlock” means reveal restricted bill review details, not unlock the CRM maintenance lock.
- Authorized reviewers are active approved admin accounts; the configured approver email further restricts email delivery and never grants a role by itself.
