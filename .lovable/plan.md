# Plan: date-filtered tile links, HQ contribution review, and Pipeline-style reskin

## 1. Date range carries into the opened list
- When you pick a range on the Command Center (আজ / ৭ / ৩০ দিন / custom dates) and click Leads, Calls or Follow-ups, the desk opens with that same range.
- The desk shows a clear chip at the top, for example "১ অক্টো – ১২ অক্টো", with a "সরান" button to clear it.
- Leads: leads added in the range. Calls: calls made in the range. Follow-ups: follow-up leads whose last change falls in the range.
- The range is part of the page address, so it survives a refresh and can be shared with a colleague, who still sees only their own records.

## 2. HQ page: agent daily contribution reports
- A new page called "এজেন্ট অবদান রিপোর্ট", for HQ/IT only, linked from the HQ menu.
- Filters: date range (presets plus custom), agent, and type ("যোগদান থেকে" or "দৈনিক").
- Summary at the top: reports submitted vs expected today, agents who haven't submitted yet, and how many reports are within the word limit.
- A table on desktop and cards on phones: agent, date, type, word and sentence count, and the full text in a side panel.
- Review: HQ can mark a report "দেখা হয়েছে" and add a short note. The agent's original text can never be edited or deleted; each review is saved as a separate record.
- CSV export of the filtered list (Bengali opens correctly in Excel).

## 3. New look in the style of "Sales Pipeline CRM", logic unchanged
Yes, this is possible. Only the look changes. All rules, permissions, gates (9:05 briefing, 5:20 report, call reports, billing lock), LeadHub assignment, data and server checks stay exactly as they are.

What changes visually:
- Colours: a calm light mint background for the sidebar and pages, a warm orange for main actions, and a dark teal for text and dark panels. There is a matching dark mode.
- Font: Outfit (clean and rounded, like the reference) for English and numbers. Bengali keeps the current Bengali font so it stays readable.
- Sidebar: mint panel with section labels (প্রধান, লিড ও বিক্রয়, …), rounded active item in orange, cleaner sub-items under "আমার ডেস্ক", and the user's avatar and sign-out at the bottom, like the reference. It collapses to icons and still works with the phone bottom menu.
- Page header: one shared title block on every page (title, one-line description, action buttons on the right), as in the reference.
- Cards, tables, badges and buttons: softer borders, more spacing, stage-style coloured badges (Hot/Warm/Cold, Pending/Follow-up/Closed).
- The desk welcome banner, Command Center and HQ panels are restyled with the new colours.

Rollout order, checked page by page:
1. Colours, font, sidebar and page header (changes every page at once).
2. Agent desk, lead queue and call panel.
3. HQ, LeadHub, Reports and Social pages.
4. Entry hall and sign-in pages.

Not copied from the reference: its pages (deals pipeline, companies, forecast), its sign-in system and its data. Only its visual style is used.

## Technical details
- Tile links: extend desk search params with optional `from`/`to` (YYYY-MM-DD, Dhaka). The lead list, call records and follow-up calendar sections filter client-side from the existing scoped snapshot, so agent and HQ scope rules stay unchanged.
- HQ page: route `src/routes/contributions.tsx` (AppShell + RoleGate authority). Server functions in `src/lib/agent-contribution.functions.ts` use `resolveCaller` HQ/IT scope plus the service client loaded inside the handler. New append-only table `agent_contribution_reviews` (report_id, reviewer, note, created_at): server-only, RLS on with no client policies, and a mutation-block trigger.
- Reskin: replace the oklch values in `src/styles.css` tokens (`--background`, `--primary`, `--sidebar-*`, badge and stage tokens) with the mint/orange/teal palette. Add Outfit via a `<link>` in `__root.tsx` and set `--font-sans`. Restyle `AppShell` sidebar markup and add a shared `PageHeader`. No server, query or route logic is edited. Run the existing tests and the build-tool pin check after each step.
