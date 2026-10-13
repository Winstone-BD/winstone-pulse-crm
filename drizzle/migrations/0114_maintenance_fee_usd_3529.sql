ALTER TABLE public.system_maintenance ALTER COLUMN fee_usd SET DEFAULT 35.29;
COMMENT ON COLUMN public.system_maintenance.fee_usd IS 'Canonical maintenance fee in USD for new invoices ($35.29, due 14th). Historical rows keep their stored snapshot.';
COMMENT ON COLUMN public.system_maintenance.fee_bdt IS 'DEPRECATED: unused; maintenance fee is USD (fee_usd + total_cents snapshot).';