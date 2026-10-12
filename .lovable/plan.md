# CRM audit log, backups and safe restore

## 1. Audit log
- One HQ/IT "Audit log" page: every create, edit and archive on leads, call reports, follow-ups, bookings, site visits and staff profiles.
- Each row: when (Dhaka time), who (clean staff name, or "System"), what record, action (Created / Edited / Archived / Restored), and the changed fields old -> new.
- Filters: date range, person, record type, action; search by record; CSV download.
- Permanent: entries can never be edited or deleted. Agents see only their own records' history.
- "Archived" = parked/cancelled/closed (records are never hard-deleted).

## 2. Daily backup (automatic)
- Every night at 11:30 PM Dhaka a copy of leads, call reports, follow-ups, bookings, site visits and profiles is saved privately. Last 30 days kept.

## 3. Download export (HQ)
- "Backups" list with date and row counts; download any day, or "Back up now". HQ PIN required; every download is logged in the audit log.

## 4. Restore one record (HQ)
- Pick a lead or call report, see backup vs. today side by side, restore only the chosen fields. HQ PIN, logged as "Restored".
- Never deletes anything, never changes lead assignment (LeadHub stays the only path), never edits history.

## 5. Full database restore
- Not built into the CRM: preview and live share one database, so a rollback would erase every agent's work after that time. It stays a platform emergency action with Lovable support; the daily downloads are your safety copy.

## Technical details
- `record_audit_log` table (append-only via block trigger, no client writes); generic SECURITY DEFINER row trigger on the six tables storing actor (auth.uid() or 'system'), op, jsonb diff of changed columns only; secrets/legal_name excluded.
- Reads through HQ/IT-scoped createServerFn with paging; agent view scoped to own leads.
- Private storage bucket `crm-backups`; server-only `crm_backup_runs` (date, counts, checksum); pg_cron daily -> `/api/public/backups/run` gated by a server-only secret header; idempotent per date; prune > 30 days.
- Restore = normal update through existing triggers; excluded columns: ids, assignment, created_at, phone.
