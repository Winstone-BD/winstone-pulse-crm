# Agent Desk modernisation + lead/call efficiency + AI summary saving

## Why the agent desk feels "not smart" today
The agent desk is one long page with about 20 stacked blocks. In order: notices, news, visit requests, profile, phone setup, charts, stats, insights, alarm, queue, day board, neglect notice, AI panel, support inbox, then 8 tabs. On a phone (where agents work) the most important thing — **who to call next** — sits far below the fold. Nothing on the page is removed by this plan; it is reorganised and prioritised.

## Part A — Modern agent desk (UI only, same data and permissions)

```text
Phone                          Desktop
+--------------------------+   +--------+---------------------------+-----------+
| Hi, Rahim · 23/50 today  |   | Nav    | NEXT CALL card            | Today     |
| [progress ring]          |   | Today  |  name · project · score   | follow-ups|
+--------------------------+   | Leads  |  [Call] [WhatsApp] [Skip] | visits    |
| NEXT CALL (big card)     |   | Calls  +---------------------------+ alerts    |
| [Call]  [WhatsApp]       |   | Follow | Queue (compact list)      |           |
+--------------------------+   | Visits |                           |           |
| Alerts (1 line each,     |   | Report |                           |           |
|  tap to expand)          |   +--------+---------------------------+-----------+
| Today's queue            |
+--------------------------+
| bottom tab bar: Today ·  |
| Leads · Calls · Follow · |
| More                     |
+--------------------------+
```

1. **"Today" home view** — a greeting with a progress ring (done / daily quota) and a large **Next call** card. The card shows lead name, project interest, score band (Hot/Warm/Cold badge with icon + text), last outcome, and one-tap Call / WhatsApp. The next lead comes from the agent's existing queue order — no new routing logic.
2. **Smart alert stack** — briefing ack, deadline, neglect notice, visit requests, site-visit reminders and accountability banners become one compact, prioritised list (red = action needed, amber = soon, neutral = info). Each item is one line and expands on tap. The rules behind each alert are not changed.
3. **Bottom tab bar on phones** — Today · Leads · Calls · Follow-ups · More, with a side rail on desktop. Existing tabs (support, WhatsApp, calendar, reports, AI summaries) live under these. Every current route and action stays reachable.
4. **Move rarely used setup to "More / Profile"** — profile card, photo upload, phone setup and lead import move out of the main scroll.
5. **Modern visual polish within the existing design system** — consistent cards, number/score chips, skeleton loading, empty states with a clear next step, subtle motion on status changes, and full Bengali/English via the existing language switch.
6. **Winstone AI quick access** — a floating button opens the existing assistant panel. Its behaviour is unchanged: it proposes, the agent confirms.

## Part B — Lead list and call efficiency checks (what you asked to verify)
1. **New leads show up immediately:** run a live check in the preview. Add a lead, then confirm it appears on an open board within the 8-second window, and screenshot the result as proof.
2. **One-day comparison of the lead list and call list:** for one Dhaka day, put the lead-list results and the call-list results side by side, so you can see the call list matches the lead list.
3. **Has the number of database loads dropped?** Reset the database counters, then measure lead-list and call-list loads after the change under normal use. Report the before/after counts honestly; the change must be published for live traffic to count.
4. **Lighter lead list:** load only the columns the board actually shows, instead of every field. This is a code change only and does not change what the board displays.

## Part C — Per-call report update
- When a call is synced from the phone, the lead's row, the call list and the agent's report summary update together on every open screen. Today, report and follow-up changes already trigger this; this extends it to call syncs, so a finished call shows its pending-report prompt immediately.

## Part D — AI summaries: charge once, then reuse
- **Uploaded files:** save the summary against a fingerprint of the file. Uploading the same file again shows the saved summary with no new charge, plus a "saved on <date>" tag and an optional "Regenerate" button (which is charged).
- **Help articles and Drive documents:** save the summary per article/document version. It is regenerated only when the content changes.
- Call-report summaries already work this way — no change.
- New storage is HQ/IT-readable only and append-only; it is audited as today.

## Not changed
Lead assignment (LeadHub only), scoring, quotas, the 9:05 briefing gate, permissions, history rules, the Android app, and the Executive HQ / IT screens.

## Technical details
- New UI: `src/components/crm/desk/` (TodayHome, NextCallCard, AlertStack, DeskTabBar). `src/routes/desk.tsx` becomes a layout over these, with tab state in the URL search params.
- Next-call ordering: reuse the existing MobileLeadQueue/LeadDayBoard ordering helper; no new server logic.
- Lean lead select: replace `select("*")` in `getCrmSnapshot` with an explicit column list used by board components (type-checked).
- Call-sync refresh: in `crm-data.ts` live refresh, `call_recordings` changes also invalidate `my-call-reports` and `pending-call-report`.
- Summary cache: new server-only table `ai_summary_cache` (kind, content_hash unique, summary, model, created_at, created_by). It is written by the existing summary server functions before calling the model; there are no client grants. One additive migration.
- Verification: typecheck, tests (new tests for the hash cache and the column list), Playwright at 390 and 1280 widths on the desk, a pg_stat_statements before/after report, and a build-tool pin check. Nothing is published.
