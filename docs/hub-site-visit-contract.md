# Knowledge Hub → CRM: `site_visit.requested` (v2 envelope)

For the separate Knowledge Hub project (winstonebd.com). The CRM fails closed: any
deviation returns 4xx and nothing is stored.

**Endpoint:** `POST https://crm.winstonebd.com/api/public/os/events`
**Secret:** the existing shared `CRM_BRIDGE_SECRET` (server-side only, never in the browser).

## Headers
| Header | Value |
|---|---|
| `content-type` | `application/json` |
| `x-winstone-timestamp` | Unix seconds; must be within ±300 s of CRM time |
| `x-winstone-signature` | `sha256=` + hex HMAC-SHA256(secret, `"<timestamp>.<raw body>"`) |
| `x-idempotency-key` | `[A-Za-z0-9._:-]{8,200}`, stable per request (e.g. `hub-visit-<request_id>`) |
| `x-winstone-api-version` | `2` (recorded) |

Signature is verified on the raw bytes before JSON parsing. Body ≤ 64 KB.

## Body (strict — unknown fields are rejected)
```json
{
  "event_id": "evt_01J...",
  "event_type": "site_visit.requested",
  "idempotency_key": "hub-visit-REQ123",
  "occurred_at": "2026-10-11T16:00:00+06:00",
  "payload": {
    "request_id": "REQ123",
    "name": "Customer name",
    "phone": "01712345678",
    "project": "winstone-heights",
    "preferred_date": "2026-10-15",
    "preferred_time": "11:00",
    "visitors": 2,
    "notes": "optional free text"
  }
}
```
- Required: `request_id` (1–200, unique per request), `name` (1–120), `phone` (Bangladesh mobile; any of `017…`, `+88017…`, `88017…`).
- Optional / nullable: `project` (≤200, ideally the `/projects/<slug>`), `preferred_date`/`preferred_time` (≤40 text), `visitors` (int 1–50), `notes` (≤1000).
- If `idempotency_key` is in both header and body they must match.

## Responses
| Status | Meaning | Retry? |
|---|---|---|
| 201 `request_on_existing_lead` / `request_new_lead` | stored as a pending request | no |
| 409 `duplicate_ignored` | same key already processed | no |
| 409 `idempotency_key_reused` | same key, different body | no |
| 401 | bad/missing signature or stale timestamp | fix clock/secret |
| 413 / 422 | too large / invalid envelope, payload, phone or type | no |
| 429 / 500 / 503 | rate-limited / processing failed / receiver not configured | yes, same key, backoff |

## What the CRM does
Matches the phone to an existing lead (existing phone dedupe). Unknown phone → normal
unassigned LeadHub intake. The request stays `requested` until the assigned agent or HQ/IT
confirms (creates a site visit through the existing flow) or dismisses it. The incoming
message never creates a site visit.

---

# Buyer portal → CRM: `enquiry.submitted` (v2 envelope)

Same endpoint, headers, signature, idempotency and responses as above; `event_type: "enquiry.submitted"`.
Use a key like `hub-enquiry-<request_id>`.

```json
"payload": {
  "request_id": "ENQ123",
  "name": "Customer name",
  "phone": "01712345678",
  "project": "winstone-heights",
  "property_type": "flat",
  "budget_min_bdt": 5000000,
  "budget_max_bdt": 9000000,
  "facing": "south",
  "amenities": ["lift", "parking", "generator"],
  "message": "optional",
  "page_url": "https://winstonebd.com/projects/winstone-heights",
  "utm_source": "facebook",
  "utm_medium": "social",
  "utm_campaign": "oct-heights-post"
}
```
- Required: `request_id`, `name`, `phone`. Everything else optional/nullable.
- `property_type`: flat | land | commercial | duplex | other. `facing`: north | south | east | west | north_east | north_west | south_east | south_west.
- Budgets are whole taka integers; min ≤ max. `amenities` ≤ 20 items, each ≤ 60 chars.
- 201 `enquiry_new_lead` (unassigned LeadHub Nexus lead) or `enquiry_on_existing_lead` (phone already known; no duplicate lead).
- HQ/IT see every enquiry at `/enquiries` (by day, budget, source/UTM, lead status).
