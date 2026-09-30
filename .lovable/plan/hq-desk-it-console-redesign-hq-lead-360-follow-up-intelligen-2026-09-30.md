# HQ, Desk, IT Console redesign + HQ Lead 360 Follow-up Intelligence

## Goal
1. Split HQ, Desk and IT Console into short, grouped pages that match the left sidebar (no giant single pages).
2. Give HQ a Lead 360 workspace: one lead = one permanent history (calls, follow-ups, reschedules, outcome), with structured follow-up reasons and a full change audit.

## Part A — Shorter pages that match the sidebar
Each big page becomes a small parent with sub-pages, shown as a second level in the sidebar (and as tabs on phones). Existing panels are moved, not rewritten; no rule or permission changes.

```text
HQ (/hq)                 Desk (/desk)              IT Console (/system)
 ├ Overview (KPIs)        ├ Today (command center)  ├ Health (backend, alerts)
 ├ Lead 360 (NEW)         ├ My leads                ├ Knowledge (website, Drive)
 ├ Follow-ups             ├ Calls & WhatsApp        ├ Notices (notice board)
 ├ Agents & performance   ├ Follow-up calendar      ├ Access & PINs
 └ Accountability         ├ My reports              └ Releases & devices
                          └ Team support
```
- Each sub-page gets its own address so it can be bookmarked and the sidebar highlights it.
- Consistent page header (title, short Bengali description, date filter where relevant), card grouping, and the same spacing on every sub-page.

## Part B — HQ Lead 360
**Search**: name, phone (BD-normalized), Lead ID, agent, reference by, source, requirement, follow-up status, call category, date range. Results show "6 কল · 3 ফলো-আপ · 4 Connected · Next: 29 Sep".

**Lead 360 screen**
- Profile: name, phone, source, reference by, requirement, assigned agent.
- KPI strip: total / connected / not connected calls; total / completed / upcoming / overdue follow-ups.
- Current follow-up card: date-time, status, reason, created by.
- Follow-up summary: first / last / next follow-up, rescheduled count, days since contact.
- Complete Activity Timeline (newest first): lead created, each call (connected + duration or not-connected + retry action), customer response, next action, follow-up set / updated / rescheduled / completed, status change, conversion.
- Links to the call recording/report where it already exists. HQ/IT only; agents keep seeing only their own leads.

**Structured follow-up reason** (agent picks one; optional short note only for "অন্য কারণ"):
callback চেয়েছেন, Price, Project details, Brochure, Payment details, Location, Family-এর সাথে আলোচনা, আরও সময়, Site visit আগ্রহী, পরে কল করতে বলেছেন, Agent তথ্য পাঠাবে, অন্য কারণ.
Added to web and Android follow-up forms; old follow-ups show their existing note as the reason (never rewritten).

**Permanent history rule**: follow-ups are never overwritten. Rescheduling records the original time, new time, who, when and why. "Current follow-up" is just the latest active one.

## Technical details
- DB (additive only): `follow_up_events` gets `reason_code text`, `previous_call_id uuid`, `customer_response text`, `next_action text`, `reschedule_count int default 0`. New table `follow_up_changes` (follow_up_id, lead_id, action, old_scheduled_at, new_scheduled_at, reason_code, changed_by, changed_at) — insert-only, update/delete blocked by trigger, server-only access (no client policies), grants to service_role.
- Trigger on `follow_up_events` insert/update writes `follow_up_changes` rows automatically, so web, Android and offline replay all get audited.
- Server functions `searchLead360` and `getLead360` (HQ/IT scope, server-verified) assemble profile, calls (`call_recordings` + `call_reports`), follow-ups, changes and `lead_events` into one timeline.
- Routes: `/hq/*`, `/desk/*`, `/system/*` child routes with `<Outlet />`; `NavSidebar` gains nested items.
- Android: reason picker in follow-up form, sent as `reason_code`; server validates against the fixed list.
- Tests for timeline ordering, KPI counts, reason validation, and audit trigger; typecheck + full test run; Playwright screenshots of each new page.

## Not changed
Scoring V2, quotas, LeadHub routing, 9:05 briefing, accountability rules, existing data.
