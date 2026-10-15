# Pulse AI — next release plan

## What already exists (kept, not rebuilt)
- Winstone AI chat on all surfaces (role-scoped, proposes actions, user confirms, server re-checks role, prompt-injection guard).
- Sales Copilot: buyer-check autofill, Gemini buyer-check suggestion from call notes, call-prep brief, AI WhatsApp/SMS drafts, negotiation helper, call coach, draft history.
- Project matching from saved inventory requirements (deterministic, missing data labeled).
- Objection library page (`/objections`), handover checklist + printable HQ summary.
- Lead scoring V2 (locked) + insight score, neglected-lead flags.

So the brief's Phases 2–3A–3C are largely in place. This release fills the real gaps.

## Release 1 — build now
1. **Pipeline Intelligence (Q&A with real numbers)**
   - Fixed, server-calculated questions: follow-ups due today, leads inactive 7+ days, pipeline count by stage, overdue activities per agent, this week's leads/visits summary, leads matching available inventory.
   - Numbers come from database queries scoped to the user's role (agent = own leads, HQ/IT = all). AI only writes the plain-language explanation and always states period, filters and limits. No forecasts presented as certain.
   - Added as a "Pipeline" tab inside Winstone AI with suggested-question chips.
2. **Coach suggests approved objection answers**
   - Call coach and pre-call brief look up HQ-approved answers in the objection library that match objections in the latest report and show them ("Approved answer" badge). Unapproved objections are never presented as approved.
   - The library is filled only from real call reports; HQ/IT approve answers. I will not write invented answers.
3. **Handover due dates (fixed rules) + reminders**
   - Documents due 7 days after the first completed site visit; payment due on the booking date.
   - Overdue / due-soon badges on the handover checklist and HQ summary; reminders through the existing bell + Android push, once per item (idempotent), Dhaka dates, Friday respected only for display.
4. **Daily report sheet (in CRM)**
   - HQ/IT page with one row per lead: owner, stage, visits, bookings, payments status, last activity, for a chosen Dhaka date; CSV export. Ready to push to Google Sheets once connected.

## Needs you
- **Google Drive + Sheets**: I'll open both connect cards; last time the Drive card was declined. Sync (recordings in, daily sheet out) gets wired only after they're linked.
- **"Run Gemini on a real call note and save the lead"**: this writes to the live database (preview and live share one). I'll run the suggestion on a real lead read-only and show you the fields; saving needs your OK in the app, as agents must confirm.
- **Model routing**: "GPT-6 Terra" doesn't exist. Plan: Gemini 3.8 Flash for everyday copilot text (you asked for Gemini), GPT-6 Astra for management reports, existing models kept elsewhere. Config stays in one server file.

## Technical details
- New `src/lib/pipeline-intel.server.ts` + `.functions.ts` (requireSupabaseAuth, role check, whitelisted question IDs only — no free SQL).
- Objection lookup reused in `sales-drafts.server.ts`/`precall.server.ts`; answers passed as trusted HQ text, notes stay enveloped.
- Handover due dates computed from existing site_visits/bookings (no new table); reminder keys added to existing notification idempotency.
- Daily sheet: `src/routes/daily-sheet.tsx` (HQ/IT), server aggregation, CSV.
- Tests: role scoping, numeric calculations vs fixtures, due-date rules (incl. Friday/Dhaka midnight), approved-vs-unapproved answers, injection in notes. Pin stays 2.25.2. Not published.
