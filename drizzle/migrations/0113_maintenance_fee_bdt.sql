ALTER TABLE public.system_maintenance ADD COLUMN IF NOT EXISTS fee_bdt integer;
ALTER TABLE public.system_maintenance ALTER COLUMN fee_usd SET DEFAULT 0;
COMMENT ON COLUMN public.system_maintenance.fee_usd IS 'DEPRECATED for periods after 2026-10: maintenance fee is BDT (fee_bdt + currency). Kept unchanged on historical USD invoices.';
COMMENT ON COLUMN public.system_maintenance.fee_bdt IS 'Integer BDT maintenance fee snapshot for BDT invoices (currency = BDT; total_cents holds poisha).';