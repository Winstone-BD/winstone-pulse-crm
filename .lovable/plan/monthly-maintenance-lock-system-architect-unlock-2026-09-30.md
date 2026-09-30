# Monthly Maintenance Lock + System Architect Unlock

Replace the old ৳4,000 service bill with one $35.29 USD monthly maintenance system that the server enforces. IT Console verifies payments, and only the System Architect can grant a temporary unlock.

## What users will see

- **Agents and Executive HQ:** when payment is due or the CRM is locked, a red **P** badge shows on the profile card and a red banner shows across the CRM ("SYSTEM MAINTENANCE PAYMENT DUE — $35.29 USD — CONTACT IT CONSOLE"). Tapping P opens the notice with a **Payment / Unlock Request** button, which only notifies IT Console. Nobody sees billing controls.
- **Warnings before the 14th:** a quiet notice from the 7th, a stronger one from the 12th, and a red "due today" notice on the 14th. Once the lock time passes, a full lock screen appears.
- **Lock screen:** "🔒 SYSTEM MAINTENANCE LOCKED", with the $35.29 USD fee, PAYMENT REQUIRED status and the request button.
- **Badge states:** red P (due), amber P (pending), red P + LOCKED, green VERIFIED, amber UNLOCK PENDING. Nothing shows when the month is paid.
- **Phone app:** while the CRM is locked, it gets "locked" from the server on every request and shows the same notice.
- **IT Console → "Maintenance & System Access" page:**
  - Current status, billing period, fee, due date and lock time (the lock time can be edited).
  - Actions: **Verify payment** (needs a payment reference), **Mark pending** and **Request system unlock**. If payment isn't verified yet, the request shows a warning and records that.
  - Payment, lock, unlock and approval history, plus the audit log.
- **System Architect Control Center (`/architect`):**
  - **Sign-in:** Google sign-in, then the server checks the account email. Only zhemon.sm123@gmail.com is accepted; any other account sees ACCESS DENIED. The Architect then enters a secret credential that is checked on the server.
  - **Dashboard:** the status table and pending requests.
  - **Decision:** approve with 1, 2, 4, 8, 12 or 24 hours, or a custom length up to 24 hours. Deny needs a reason.
  - **After approval:** a "SYSTEM UNLOCKED" card shows when it started and when it expires, in Dhaka time.
- No BDT or ৳ anywhere in this feature. The old ৳4,000 bill panels are removed from HQ and IT. Old invoice rows stay in the database, hidden.

## Lock rule (server only)

```text
payment VERIFIED for current period      -> ACTIVE
valid architect unlock (now < expires)   -> ACTIVE
now >= lock_at (default 14th 00:00 Dhaka) -> LOCKED
otherwise                                -> ACTIVE (with due warnings)
```

- **Unlock expiry:** an unlock stops working the moment its time runs out, because every request checks the time. There is no browser timer.
- **Who is blocked:** while locked, agents, Executive HQ and the phone app are refused. IT Console (full PIN) can still get in so payment can be verified. The Architect portal always works as the recovery path.
- **If the check fails:** agents are treated as locked (fail closed), and IT and the Architect keep access so the organisation can't be permanently locked out. Every such case is logged.

## Technical details

- **Migration:**
  - enum `maintenance_payment_status` (unpaid/pending/verified) and enum `maintenance_unlock_status` (none/requested/approved/denied/expired).
  - Table `system_maintenance`: one row per `billing_period`, with the fields in the spec. `fee_usd` defaults to 35.29, `lock_at` defaults to the 14th at 00:00 Dhaka.
  - Table `maintenance_unlock_requests`: requester, reason, payment snapshot, decision, duration, start/expiry, denial reason.
  - Table `maintenance_audit`: append-only. A trigger blocks update and delete.
  - Table `architect_auth_attempts`: used for rate limiting.
  - All four tables are server-only. RLS is on with no client policies, and grants go to `service_role` only.
- **`src/lib/maintenance.server.ts`:** the one rule function `maintenanceAccess(now)`. It creates the period row lazily, logs lock and expiry transitions once each, and uses a 30-second in-request cache.
- **Server enforcement:**
  - `resolveCaller` (every web server function) returns a locked error for agent, coordinator and HQ-read-only callers.
  - `resolveApiCaller` (every phone and device endpoint) returns HTTP 423 when locked.
  - The full IT PIN, the maintenance endpoints and the architect endpoints are exempt.
- **`src/lib/maintenance.functions.ts`:**
  - `getMaintenanceStatus` gives a public-safe status for badges and banners.
  - `requestPaymentHelp` is the agent's request; it only notifies IT and logs to audit.
  - IT actions (full PIN, write access): `itMaintenance`, `verifyMaintenancePayment`, `setMaintenancePending`, `setLockAt`, `requestUnlock` (blocks duplicate open requests).
  - Architect actions: `architectLogin` checks Google identity, credential and rate limit. `architectOverview` and `architectDecide` need an architect session token.
- **Architect identity:**
  - The bearer token is checked with `getClaims`. It must have `email` = zhemon.sm123@gmail.com, email verified and provider `google`. Any email the client sends is ignored.
  - The credential lives in a new secret `ARCHITECT_UNLOCK_CREDENTIAL`, which I'll ask you to add. It is compared with a timing-safe check.
  - Rate limit: 5 failures in 15 minutes locks sign-in for 15 minutes. Every attempt is logged.
  - On success the server issues an HMAC-signed architect token that lasts 30 minutes. It is kept in memory only, never in localStorage.
  - Google sign-in is turned on for the project through the Lovable broker.
- **UI:**
  - `MaintenanceBadge` (P plus popup) goes in `MyProfileCard` and the HQ profile area. `MaintenanceBanner` and `MaintenanceLockScreen` go in the root shell.
  - IT page `MaintenancePanel` goes in `system.tsx`, replacing `ServiceBillPanel`, which is also removed from `hq.tsx`.
  - New route `src/routes/architect.tsx` with its own head().
  - Android: `MaintenanceControl` also reads the new status, and a 423 response opens the existing maintenance screen. This is code only; it can't be built here.
- **Retire:** the old service-billing functions, alerts and hook stop being used (their tables are left in place). The system manual and handover text are updated to $35.29 USD.
- **Tests:**
  - The rule on the 13th, the 14th, verified, unpaid after lock, unlock active and unlock expired.
  - No BDT text in the feature files.
  - Architect email and provider check, bad credential, rate limit.
  - Duplicate unlock request blocked; audit table protected against update and delete.
  - `resolveCaller` and `resolveApiCaller` refuse locked callers; the IT PIN is exempt.
  - Then typecheck, the full test suite and a build.

## Needs from you during build

- Save the Architect secret credential when the secure form opens.
