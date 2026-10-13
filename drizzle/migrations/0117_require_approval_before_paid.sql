CREATE OR REPLACE FUNCTION public.require_payment_review()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.payment_status = 'verified' AND OLD.payment_status IS DISTINCT FROM 'verified' THEN
    IF OLD.payment_status IS DISTINCT FROM 'pending' OR OLD.payment_ref IS NULL THEN
      RAISE EXCEPTION 'An invoice can only be marked paid after a payment reference is submitted and awaiting approval';
    END IF;
    IF NEW.payment_verified_by IS NULL OR NEW.payment_verified_by ILIKE '%owner instruction%' THEN
      RAISE EXCEPTION 'Marking an invoice paid requires an authorized approver';
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER system_maintenance_require_review
BEFORE UPDATE ON public.system_maintenance
FOR EACH ROW EXECUTE FUNCTION public.require_payment_review();