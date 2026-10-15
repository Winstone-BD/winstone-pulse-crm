CREATE TABLE public.website_enquiries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hub_request_id text NOT NULL UNIQUE,
  lead_id uuid REFERENCES public.leads(id),
  outcome text NOT NULL,
  customer_name text NOT NULL,
  phone text NOT NULL,
  project text,
  property_type text,
  budget_min_bdt bigint,
  budget_max_bdt bigint,
  facing text,
  amenities text[] NOT NULL DEFAULT '{}',
  message text,
  page_url text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.website_enquiries TO service_role;
ALTER TABLE public.website_enquiries ENABLE ROW LEVEL SECURITY;
CREATE INDEX website_enquiries_created_idx ON public.website_enquiries (created_at DESC);