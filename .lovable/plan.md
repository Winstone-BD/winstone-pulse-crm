# Dealflow-style smart UI for Winstone Pulse (English first)

The reference video shows a clean "Dealflow" CRM. Its pages: Dashboard, Pipeline, Contacts, Companies, Activities, Tasks, Calendar, Forecast, Reports, Import/Export, Settings. It also has a top bar with search (⌘K), notifications and a theme toggle. Below is how each one maps to what Winstone Pulse already has, and what will be built. All data stays real and role-scoped. No business rules change and nothing is published.

## Feature map

| Reference | Winstone Pulse today | Plan |
|---|---|---|
| Dashboard: "Welcome back", period chips, 4 stat cards with coloured left edge + icon, Recent Activity, Coming Soon | Desk "Today" hero, KPI strip, Next best call | Restyle to match: welcome line, This Week / This Month / This Quarter / All Time chips (reuse existing date range), stat cards with coloured edge + icon, "Coming up in 7 days" (follow-ups due) and "Recent activity" cards with friendly empty states |
| Pipeline (kanban by stage) | Missing | **New "Pipeline" view** in My Desk: columns Pending → Contacted → Follow-up → Closed from the agent's own leads, with count badges and an empty state per column. Cards open Lead 360 / Call. **Read-only board, no drag-to-change-stage**: stage changes still happen only through call reports, so the report gate and history rules stay intact |
| Contacts | My leads list | Restyle as "Contacts": search box, table on desktop, cards on phone |
| Companies | No such data | **Skipped**: the CRM has no company records, and the plan won't invent any |
| Activities | Call log + WhatsApp | Combine into one "Activities" timeline (calls, WhatsApp, lead events), filterable |
| Tasks: To Do / Completed tabs, priority filter, empty state | Follow-ups | Restyle follow-ups as "Tasks": To Do / Completed tabs, search, filter by overdue/today/upcoming. New follow-ups still go through the existing follow-up flow (no new task table) |
| Calendar | Follow-up calendar | Visual refresh only |
| Forecast (revenue projection) | No deal values stored | **Replaced by "Outlook"**: real counts only (hot leads, follow-ups due per week, bookings pending approval). No money projection, because the CRM has no deal amounts |
| Reports: stat cards + "Deals by Stage" / "Value by Stage" bars | Reports page + charts dashboard | Add a "Leads by stage" horizontal bar chart and the reference-style stat cards; translate all chart labels |
| Import/Export | Lead import (HQ/agent) + CSV exports | Group under one "Import / Export" nav entry, where the role allows |
| Top bar: search ⌘K, bell, theme | Bell + theme exist | **New ⌘K / Ctrl+K command palette**: jump to any page or search your own leads by name/number (only data you can already see) |
| Sidebar: flat English list, Settings + Sign out at bottom | Grouped sidebar | Simplify the agent sidebar to the flat English list above. HQ/IT groups stay |

## Language
- English is primary on every touched screen; Bengali remains the secondary switch.
- Finish translating the leftovers: charts dashboard, agent overview, the app install card, top-bar buttons, lead list and call history.

## Order of work
1. Sidebar + top bar + ⌘K palette
2. Dashboard restyle
3. Pipeline board
4. Contacts / Tasks / Activities restyle
5. Reports bars + Outlook
6. Translation leftovers
7. Checks: typecheck, tests, phone/tablet/desktop screenshots signed in, build-tool pin

## Technical notes
- Everything reads the existing scoped snapshot; there are no new tables and no migrations.
- New views live as desk sections (`?s=pipeline`, `?s=tasks`, …), so existing role gates and the briefing/billing gates apply unchanged.
- Shared `StatCard` / `EmptyState` components use only semantic colour tokens.
