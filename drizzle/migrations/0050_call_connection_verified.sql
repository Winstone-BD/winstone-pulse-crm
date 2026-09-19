-- Telephony evidence for a call report.
-- connection_verified = the phone itself proved the call was answered
-- (measured duration, a synced recording, or a logged call start time).
-- A report where the agent merely claims "কথা হয়েছে" stays false, so it can
-- never count as a connected call, talk time, or a completed task.
ALTER TABLE public.call_reports
  ADD COLUMN IF NOT EXISTS connection_verified boolean NOT NULL DEFAULT false;

-- Backfill from the facts already stored on each report.
UPDATE public.call_reports
SET connection_verified = true
WHERE connected = true
  AND (
    coalesce(duration_seconds, 0) > 0
    OR recording_id IS NOT NULL
    OR call_started_at IS NOT NULL
  );

CREATE INDEX IF NOT EXISTS call_reports_verified_day_idx
  ON public.call_reports (agent_id, connection_verified, submitted_at);
