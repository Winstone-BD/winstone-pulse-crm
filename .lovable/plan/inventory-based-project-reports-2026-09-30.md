# Inventory-based Project Reports

## Build
- Keep the completed Android six-answer scoring flow unchanged and verify its score auto-fill, payload, offline replay, and server-derived category.
- Add a secure report data function that uses Inventory entries as the project list and aggregates only stored CRM facts.
- Add Daily and Monthly project views for Leads, Calls, Site Visits, and Bookings, with date/project controls, totals, empty/error/loading states, and CSV export.
- Restrict project-wide results to existing HQ/Coordinator access; agents continue seeing only their permitted data.

## Metric rules
- Leads: leads created in the selected period and matched to their saved Inventory requirement/project.
- Calls: submitted call reports in the period, counted against the report's saved Inventory requirement.
- Site visits and bookings: count only explicit saved outcomes that the existing CRM already records; do not infer or manufacture them.
- Use Asia/Dhaka calendar boundaries for daily and monthly grouping.

## Validation
- Add deterministic aggregation tests for project matching, Dhaka day/month boundaries, inactive Inventory history, and zero-data projects.
- Run focused tests, Android scoring tests, and confirm the web build is green.
