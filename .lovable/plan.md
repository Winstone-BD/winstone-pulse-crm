# Integration audit and safe finish: FCM, Firecrawl, Google Maps

Nothing gets published. I won't send any real notifications, change data or schema, or add paid connectors.

## What the audit found
- **FCM push:** built. `src/lib/push.server.ts` sends from the server through the gateway, keeps an idempotent `push_deliveries` ledger and drops dead tokens. Web registration and the service worker exist. `FIREBASE_MESSAGING_API_KEY` is **not present** in this sandbox. Live delivery has never been proven. Gaps:
  - No dry-run path (`validate_only`).
  - Stored error text isn't redacted or length-limited.
  - Requests have no timeout.
  - 400 INVALID_ARGUMENT revokes the token even when the payload is the problem.
  - Values in `data` aren't forced to strings.
- **Firecrawl:** not built anywhere in the app code. No `FIRECRAWL_API_KEY`.
- **Google Maps / Places:** not built. No Maps key.
- **Readiness page:** lists push only. It has no Firecrawl or Maps entries.

## Fixes (small and safe)
1. **FCM hardening** in `push.server.ts`:
   - Add an optional `dryRun` flag that sends `validate_only: true`.
   - Add an 8 s timeout using AbortController.
   - Force every `data` value to a string.
   - Revoke the token only on 404 UNREGISTERED, or on 400 when the body names the token.
   - Redact token-like strings from stored and logged errors and cut them to 300 characters.
2. **HQ/IT-only "dry-run push" check** on the readiness page. It runs validate_only against the caller's own registered device and never delivers anything. If no key or device is present, it reports that plainly.
3. **Firecrawl: server-only foundation, no UI feature.** Add `src/lib/firecrawl.server.ts` plus an authenticated HQ/IT server function to scrape one page:
   - **Authentication:** requires an authorized caller, enforced through the existing `rate-limit.ts`.
   - **Gateway check:** detects gateway vs direct mode from the key prefix (`lovc_` vs `fc-`).
   - **SSRF guard:** https only. Blocks IP literals, localhost, private, link-local, CGNAT and metadata ranges, `.local` and `.internal` hosts, non-default ports, and credentials in URLs. Allows only a configured allowlist (winstonebd.com and its subdomains by default).
   - **Limits:** 15 s timeout and a capped markdown size.
   - **Errors:** redacted.
   - The function returns "not configured" when no key is present.
4. **Google Maps: server-only foundation.** Add `src/lib/maps.server.ts` with a Places Text Search (New) helper:
   - It always sends an explicit `X-Goog-FieldMask` (id, displayName, formattedAddress, location).
   - The server key comes only from `process.env`.
   - Bounded query length and timeout.
   - Rate-limited, authenticated server function.
   - Any future browser key must be `VITE_` and restricted by HTTP referrer (documented, not created).
5. **Readiness page:** add Firecrawl and Google Maps as optional cards. They show key presence only and never a "Verified" badge without a real check.
6. **Tests** (offline, mocked fetch):
   - The SSRF guard matrix.
   - Firecrawl gateway vs direct headers.
   - The Places field mask is always present.
   - FCM `validate_only`, string coercion, revoke rules, redaction and timeout.
   - Source test that none of these modules can be imported from client code.
7. **Docs:** add entries in `roadmap.md`, `docs/integrations.md` and the `src/lib/AGENTS.md` rule.

## Verification
Pin check (2.25.2), typecheck, then the new tests plus `push-flow`/`integration-boundaries` once, then a diff review.

## Honest blockers (not fixable in code)
- No FCM, Firecrawl or Maps keys are present in this environment, so I can't verify any of the three live. Push also needs a physical device.
- Using Firecrawl or Maps in a real product feature needs a use case later. For now I'm only building the guarded foundations.
