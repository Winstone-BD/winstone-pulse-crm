ALTER TABLE public.market_news DROP CONSTRAINT IF EXISTS market_news_origin_check;
ALTER TABLE public.market_news ADD CONSTRAINT market_news_origin_check CHECK (origin = ANY (ARRAY['auto','manual','official']));

CREATE TABLE public.website_visit_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hub_request_id text NOT NULL UNIQUE,
  lead_id uuid REFERENCES public.leads(id),
  phone text NOT NULL,
  customer_name text,
  project text,
  preferred_date text,
  preferred_time text,
  visitors integer,
  notes text,
  status text NOT NULL DEFAULT 'requested',
  site_visit_id uuid REFERENCES public.site_visits(id),
  decided_by text,
  decided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.website_visit_requests TO service_role;
ALTER TABLE public.website_visit_requests ENABLE ROW LEVEL SECURITY;
CREATE INDEX website_visit_requests_lead_idx ON public.website_visit_requests(lead_id);

CREATE OR REPLACE FUNCTION public.validate_visit_request()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.status NOT IN ('requested','confirmed','dismissed') THEN
    RAISE EXCEPTION 'invalid visit request status';
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.status <> 'requested' AND NEW.status IS DISTINCT FROM OLD.status THEN
    RAISE EXCEPTION 'visit request decision is final';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER website_visit_requests_validate BEFORE INSERT OR UPDATE ON public.website_visit_requests
FOR EACH ROW EXECUTE FUNCTION public.validate_visit_request();
CREATE TRIGGER website_visit_requests_no_delete BEFORE DELETE ON public.website_visit_requests
FOR EACH ROW EXECUTE FUNCTION public.block_history_mutation();