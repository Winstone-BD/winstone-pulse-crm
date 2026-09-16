CREATE TABLE public.service_invoices (
  period text PRIMARY KEY,
  amount_bdt numeric NOT NULL DEFAULT 4000,
  status text NOT NULL DEFAULT 'due',
  due_at timestamptz NOT NULL,
  grace_until timestamptz NOT NULL,
  paid_at timestamptz,
  verified_at timestamptz,
  verified_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  verified_by_label text,
  payment_ref text,
  payment_method text,
  service_active_until timestamptz,
  system_share_bdt numeric NOT NULL DEFAULT 3000,
  architect_share_bdt numeric NOT NULL DEFAULT 1000,
  split_at timestamptz,
  payout_status text NOT NULL DEFAULT 'pending',
  payout_at timestamptz,
  payout_ref text,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX service_invoices_status_idx ON public.service_invoices (status);

GRANT SELECT ON public.service_invoices TO authenticated;
GRANT ALL ON public.service_invoices TO service_role;

ALTER TABLE public.service_invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins and leaders read service invoices"
ON public.service_invoices
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'team_leader')
);

CREATE TRIGGER service_invoices_touch
BEFORE UPDATE ON public.service_invoices
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE OR REPLACE FUNCTION public.validate_service_invoice()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status NOT IN ('due','verifying','paid','overdue','failed') THEN
    RAISE EXCEPTION 'invalid service invoice status: %', NEW.status;
  END IF;
  IF NEW.payout_status NOT IN ('pending','processing','paid','failed') THEN
    RAISE EXCEPTION 'invalid payout status: %', NEW.payout_status;
  END IF;
  IF NEW.status = 'paid' AND NEW.paid_at IS NULL THEN
    RAISE EXCEPTION 'a paid invoice needs paid_at';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER service_invoices_validate
BEFORE INSERT OR UPDATE ON public.service_invoices
FOR EACH ROW EXECUTE FUNCTION public.validate_service_invoice();