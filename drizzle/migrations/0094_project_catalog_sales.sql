CREATE TABLE public.project_catalog (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  location text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','archived')),
  price_per_sqft numeric,
  unit_sizes text,
  total_price text,
  down_payment text,
  installment_plan text,
  parking_charge text,
  extra_charges text,
  notes text,
  updated_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.project_catalog TO service_role;
ALTER TABLE public.project_catalog ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER project_catalog_touch BEFORE UPDATE ON public.project_catalog FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER project_catalog_no_delete BEFORE DELETE ON public.project_catalog FOR EACH ROW EXECUTE FUNCTION public.block_history_mutation();

CREATE TABLE public.project_sales_updates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES public.leads(id),
  project_id uuid NOT NULL REFERENCES public.project_catalog(id),
  agent_id uuid,
  interest text NOT NULL CHECK (interest IN ('interested','negotiating','not_now')),
  offered_price numeric,
  note text,
  created_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX project_sales_updates_lead_idx ON public.project_sales_updates(lead_id, created_at DESC);
GRANT ALL ON public.project_sales_updates TO service_role;
ALTER TABLE public.project_sales_updates ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER project_sales_updates_immutable BEFORE UPDATE OR DELETE ON public.project_sales_updates FOR EACH ROW EXECUTE FUNCTION public.block_history_mutation();

CREATE TABLE public.project_discussion_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.project_catalog(id),
  party text NOT NULL CHECK (party IN ('client','land_owner','flat_seller')),
  lead_id uuid REFERENCES public.leads(id),
  agent_id uuid,
  note text NOT NULL,
  created_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX project_discussion_notes_project_idx ON public.project_discussion_notes(project_id, created_at DESC);
GRANT ALL ON public.project_discussion_notes TO service_role;
ALTER TABLE public.project_discussion_notes ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER project_discussion_notes_immutable BEFORE UPDATE OR DELETE ON public.project_discussion_notes FOR EACH ROW EXECUTE FUNCTION public.block_history_mutation();