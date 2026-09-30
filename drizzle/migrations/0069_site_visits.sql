CREATE TABLE public.site_visits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE RESTRICT,
  agent_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  project text,
  visit_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled','completed','cancelled','no_show')),
  notes text,
  created_by text NOT NULL,
  updated_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX site_visits_visit_at_idx ON public.site_visits (visit_at DESC);
CREATE INDEX site_visits_lead_idx ON public.site_visits (lead_id);
GRANT ALL ON public.site_visits TO service_role;
ALTER TABLE public.site_visits ENABLE ROW LEVEL SECURITY;
COMMENT ON TABLE public.site_visits IS 'Server-only. Site visits linked to canonical leads; never deleted, cancel via status.';

CREATE OR REPLACE FUNCTION public.block_site_visit_delete() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN RAISE EXCEPTION 'Site visits cannot be deleted; set status to cancelled'; END $$;
CREATE TRIGGER site_visits_no_delete BEFORE DELETE ON public.site_visits FOR EACH ROW EXECUTE FUNCTION public.block_site_visit_delete();

CREATE OR REPLACE FUNCTION public.protect_site_visit_link() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.lead_id <> OLD.lead_id OR NEW.created_by <> OLD.created_by OR NEW.created_at <> OLD.created_at THEN
    RAISE EXCEPTION 'Site visit lead link and creator are immutable';
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END $$;
CREATE TRIGGER site_visits_protect BEFORE UPDATE ON public.site_visits FOR EACH ROW EXECUTE FUNCTION public.protect_site_visit_link();