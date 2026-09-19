ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS retry_after timestamptz,
  ADD COLUMN IF NOT EXISTS unanswered_attempts integer NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS leads_retry_after_idx
  ON public.leads (assigned_to, work_state, retry_after);