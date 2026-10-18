# Call time source + WhatsApp call reporting

## 1. Show where a report's call time came from
On each call report detail (Reports page and lead history), add a small line:
- "ফোনের কল-হিস্টরি থেকে — সিংক হয়েছে {date/time}" when the time came from the Android call-history sync.
- "ওয়েব টাইমার থেকে" when it came from the web Call button timer.
- "এজেন্টের লেখা সময়" when neither existed.
- WhatsApp calls show "WhatsApp কল — এজেন্টের লেখা সময়" (the phone cannot measure WhatsApp call time).

Old reports with no saved source show "উৎস জানা নেই" — nothing is guessed.

## 2. WhatsApp button must lead to a report
When an agent presses the WhatsApp button on a lead and chooses "WhatsApp কল", the CRM:
- records that a WhatsApp call was started (never "connected" or "delivered");
- opens WhatsApp as today;
- when the agent returns, the same call-report form opens, marked channel = WhatsApp;
- the agent cannot start another call until that report is submitted (same rule as normal calls).
Choosing "মেসেজ" keeps today's behavior (logged as "WhatsApp opened", no report forced).

## Technical details
- Migration: add `duration_source text` (phone_sync / web_timer / entered / whatsapp_entered) and `duration_synced_at timestamptz` to `call_reports`; no backfill of old rows.
- `call-reports.server.ts` finalize step: set both from `resolveCallDuration` result (synced_at = matched `call_recordings.created_at`).
- WhatsApp call: server fn creates a pending report with `channel='whatsapp'` via the existing pending-report path (so `has_pending_call_report` gate and 9:05 ack apply); UI in the existing WhatsApp button components shows Call / Message choice.
- Tests: source labeling per case; WhatsApp call creates a pending report and blocks a second call.
