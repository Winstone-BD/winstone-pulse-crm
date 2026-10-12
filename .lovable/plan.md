# CRM backup and safe restore

## What you get
1. **Daily backup (automatic)** — every night at 11:30 PM Dhaka the CRM saves a copy of leads, call reports, follow-ups, bookings, site visits and staff profiles into a private backup store. Last 30 days kept.
2. **Download export (HQ)** — Executive HQ sees a "Backups" list (date, row counts) and can download any day as a file, or make a fresh one now. HQ PIN required; every download is logged.
3. **Restore one record (HQ)** — HQ picks a lead or call report, sees "backup version vs. today" side by side, and restores only the changed fields. HQ PIN required, logged permanently. Restore never deletes anything, never changes who a lead is assigned to (LeadHub stays the only way), and never edits history logs — it adds a "restored from backup" entry instead.
4. **Full database restore** — not built inside the CRM. Preview and the live app share one database, so a full rollback would erase every call and report made after the backup time for all agents. This stays a platform-level emergency action handled with the Lovable support team; the daily downloads above are your safety copy.

## Technical details
- Private storage bucket `crm-backups` (service-role only) holding gzipped JSON per table per day; server-only `crm_backup_runs` table (date, counts, checksum, status) with no client grants.
- Scheduled job → signed server route `/api/public/backups/run` (secret header check) writes the snapshot.
- `createServerFn`s gated by the HQ PIN scope: list runs, create now, signed download URL (5 min), diff record, restore record.
- Restore writes through normal updates so all existing triggers (provenance, submitted-report protection, append-only history) still apply; excluded fields: assignment columns, ids, created_at, phone keys.
- New `backup_restore_events` append-only audit table.
- Support inbox (already done): a failed 15s check now keeps the last loaded tickets on screen with a small "retrying" notice.
