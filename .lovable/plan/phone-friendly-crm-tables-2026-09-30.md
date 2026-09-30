# Phone-friendly CRM tables

## Goal
Make CRM lists and tables comfortable on narrow phones while preserving the existing desktop layout, data, permissions, and business rules.

## Implementation
1. **Create one consistent responsive table pattern**
   - Keep wide operational tables inside their own horizontal scroll area so the whole page never slides sideways.
   - Add touch scrolling, clear scroll affordance, stable minimum widths, sticky headings where useful, and safe text wrapping/truncation.
   - Keep important identity/action columns easy to reach; avoid squeezing every desktop column into unreadable phone widths.

2. **Use compact phone rows for high-use workflows**
   - Keep the existing mobile lead cards.
   - Convert the most frequently used multi-column views—follow-up history, call/sync records, staff/account controls, tickets, and approval/review queues—to compact phone rows/cards showing the essential fields first.
   - Leave their full tables available automatically on tablet/laptop widths.

3. **Improve narrow-screen controls**
   - Stack search, filters, selectors, and row actions on phones; restore multi-column control bars on larger screens.
   - Keep buttons and inputs comfortably tappable, prevent labels from clipping, and make long customer/project text truncate or wrap without widening the page.

4. **Standardize remaining reporting and audit tables**
   - Apply the shared scrolling treatment to lower-frequency reports, exports, leaderboards, LeadHub tables, Market Pulse, and system/audit tables.
   - Preserve all existing values, sorting, filtering, downloads, drill-downs, and action permissions.

## Validation
- Check representative authenticated CRM pages at 390px phone, 820px tablet, and 1280px laptop widths.
- Confirm no page-level horizontal overflow; only intentionally wide table regions may scroll.
- Verify table actions, filters, dialogs, and expandable rows remain usable by touch and keyboard.
- Run the relevant automated tests and confirm the preview build reports no errors.

## Technical details
- Frontend presentation changes only; no database migration, data mutation, authentication change, or CRM rule change.
- Reuse existing semantic color tokens and Button/Input components.
- Prefer responsive mobile/desktop render variants only for dense tables; compact tables retain a controlled scroll wrapper rather than duplicating unnecessary markup.
