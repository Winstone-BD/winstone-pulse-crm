ALTER TABLE public.system_maintenance
  ADD COLUMN IF NOT EXISTS plan_code text NOT NULL DEFAULT 'crm',
  ADD COLUMN IF NOT EXISTS base_cents integer,
  ADD COLUMN IF NOT EXISTS vat_rate_bps integer,
  ADD COLUMN IF NOT EXISTS vat_cents integer,
  ADD COLUMN IF NOT EXISTS total_cents integer,
  ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'USD';

CREATE OR REPLACE FUNCTION public.snapshot_invoice_amounts()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.base_cents IS NULL THEN
      NEW.base_cents := CASE WHEN NEW.plan_code = 'os' THEN 4629 ELSE 1579 END;
      NEW.vat_rate_bps := 1500;
      NEW.vat_cents := round(NEW.base_cents * 1500 / 10000.0);
      NEW.total_cents := NEW.base_cents + NEW.vat_cents;
    END IF;
  ELSIF OLD.total_cents IS NOT NULL AND (NEW.base_cents IS DISTINCT FROM OLD.base_cents
     OR NEW.vat_rate_bps IS DISTINCT FROM OLD.vat_rate_bps OR NEW.vat_cents IS DISTINCT FROM OLD.vat_cents
     OR NEW.total_cents IS DISTINCT FROM OLD.total_cents OR NEW.currency IS DISTINCT FROM OLD.currency) THEN
    RAISE EXCEPTION 'Invoice amount snapshot is immutable';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS system_maintenance_snapshot ON public.system_maintenance;
CREATE TRIGGER system_maintenance_snapshot BEFORE INSERT OR UPDATE ON public.system_maintenance
  FOR EACH ROW EXECUTE FUNCTION public.snapshot_invoice_amounts();

UPDATE public.system_maintenance SET base_cents = 1579, vat_rate_bps = 1500, vat_cents = 237, total_cents = 1816
WHERE total_cents IS NULL;