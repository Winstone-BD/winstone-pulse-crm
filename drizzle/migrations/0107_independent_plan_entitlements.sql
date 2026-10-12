ALTER TABLE public.maintenance_unlock_requests ADD COLUMN IF NOT EXISTS plan_code text NOT NULL DEFAULT 'crm';
CREATE UNIQUE INDEX IF NOT EXISTS system_maintenance_period_plan_key ON public.system_maintenance (billing_period, plan_code);
ALTER TABLE public.system_maintenance DROP CONSTRAINT IF EXISTS system_maintenance_billing_period_key;
CREATE UNIQUE INDEX IF NOT EXISTS maintenance_one_open_request_per_plan ON public.maintenance_unlock_requests (billing_period, plan_code) WHERE status = 'requested';
DROP INDEX IF EXISTS public.maintenance_one_open_request;
CREATE OR REPLACE FUNCTION public.validate_plan_code() RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.plan_code NOT IN ('crm','os') THEN RAISE EXCEPTION 'invalid plan_code %', NEW.plan_code; END IF;
  IF TG_OP = 'UPDATE' AND NEW.plan_code IS DISTINCT FROM OLD.plan_code THEN RAISE EXCEPTION 'plan_code is immutable'; END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS system_maintenance_plan_code ON public.system_maintenance;
CREATE TRIGGER system_maintenance_plan_code BEFORE INSERT OR UPDATE ON public.system_maintenance FOR EACH ROW EXECUTE FUNCTION public.validate_plan_code();
DROP TRIGGER IF EXISTS unlock_requests_plan_code ON public.maintenance_unlock_requests;
CREATE TRIGGER unlock_requests_plan_code BEFORE INSERT OR UPDATE ON public.maintenance_unlock_requests FOR EACH ROW EXECUTE FUNCTION public.validate_plan_code();