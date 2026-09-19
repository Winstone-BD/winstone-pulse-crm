ALTER TABLE public.leads DROP CONSTRAINT IF EXISTS leads_work_state_check;
ALTER TABLE public.leads
  ADD CONSTRAINT leads_work_state_check
  CHECK (work_state = ANY (ARRAY['pending'::text, 'completed'::text, 'duplicate_skipped'::text]));