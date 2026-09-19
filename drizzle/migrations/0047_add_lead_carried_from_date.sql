-- Carry-over provenance: the workday a pending lead was first listed under
-- before day-rollover moved it forward. Nullable and additive; NULL means the
-- lead has never been carried over.
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS carried_from_date date;

CREATE INDEX IF NOT EXISTS leads_carried_from_date_idx
  ON public.leads (carried_from_date)
  WHERE carried_from_date IS NOT NULL;