# CRM1 receiver — Winstone OS → CRM1

Single endpoint (no parallel receiver): `POST https://crm1.winstonebd.com/api/public/os/events`
Readiness: `GET` same path → `{ configured: boolean, event_types: [...] }` (never returns the secret).

## Authentication (either)
- `Authorization: Bearer <CRM_BRIDGE_SECRET>` (constant-time compare), or
- HMAC: `x-winstone-timestamp` (unix seconds, ±300 s) + `x-winstone-signature` = hex HMAC-SHA256 of `timestamp + "." + rawBody` (optional `sha256=` prefix).
Missing/mismatched → 401. Secret absent on the server → 503 `receiver_not_configured`.

Other headers: `x-idempotency-key` (8–200 chars `[A-Za-z0-9._:-]`), `x-winstone-api-version` (stored).
Rate limit: 120 req/min per source IP → 429 `rate_limited` (best-effort, per server instance). Body max 64 KB → 413.

## Envelopes (detected by `payload` vs `data`)
### Unified (RFC) — `lead_ingested`
```json
{ "event_id": "...", "event_type": "lead_ingested", "idempotency_key": "...", "occurred_at": "ISO-8601 with offset",
  "payload": {
    "external_lead_id": "...", "source": "...",
    "contact": { "name": "...", "phone": "...", "email": "...?", "city": "...?" },
    "qualification": { "project_interest": "?", "intent_level": "?", "budget_range": "?",
                       "ai_confidence_score": 0-1, "score_category": "?", "call_summary": "?" },
    "metadata": { "campaign_id": "?", "operator_id": "?", "...": "extra keys allowed" } } }
```
Idempotency key: header or envelope field (if both, they must match).
Phone must normalise to a Bangladesh mobile `8801XXXXXXXXX` (+880).

| Result | Status | Body |
|---|---|---|
| new lead created | 201 | `{ok:true,status:"lead_created",lead_id}` |
| phone already in CRM | 200 | `{ok:true,status:"lead_exists",lead_id}` |
| replay (same key, same body) | 409 | `{ok:true,status:"duplicate_ignored"}` — treat as success |
| same key, different body | 409 | `{ok:false,error:"idempotency_key_reused"}` |
| envelope/payload/phone/key invalid | 422 | `{ok:false,error,issues,retryable:false}` |
| auth | 401 | |
| transient | 429 / 500 / 503 | `retryable:true` (failed receipts are re-processed on retry) |

Mapping: goes through the canonical `intakeLead` (same dedupe/normalisation as the web desk). The lead lands **unassigned**; LeadHub Nexus remains the only assignment path. `external_lead_id`, source, qualification and metadata are stored on the server-only receipt/audit trail (`os_event_receipts`, `audit_logs`) and summarised into lead notes. AI scores are advisory: they never set temperature, grade or priority.

### Legacy — booking/payment (unchanged)
`{event_id, event_type: booking.created|booking.updated|booking.cancelled|payment.updated, occurred_at, data}`; `x-idempotency-key` header required. 200 success, 200 `{duplicate:true}` on replay, 400 schema, 422 unsupported type. Only existing bookings/leads are touched.

## Divergences from the RFC
- Replay on the **legacy** booking/payment envelope still returns 200 `duplicate:true` (preserved for compatibility); only the unified envelope returns 409 `duplicate_ignored`.
- Booking/payment events keep their dotted names (`booking.created`), not `booking_created`.
- Bearer auth is also accepted on the legacy envelope (HMAC still supported).
- A known phone returns 200 `lead_exists` (no new record, existing lead untouched) rather than an upsert that overwrites CRM data.
- No `lead_events` row is written for a new OS lead, because any lead event would make it ineligible for first assignment; provenance lives in the receipt + audit log instead.
- `external_lead_id` is not a unique DB column; identity is the canonical phone (DB-enforced) plus the idempotency key.
- Server storage: `os_event_receipts` is service-role only (RLS on, no client policies).
