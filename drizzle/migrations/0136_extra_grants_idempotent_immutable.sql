ALTER TABLE public.lead_extra_grants ADD COLUMN IF NOT EXISTS request_id uuid;
CREATE UNIQUE INDEX IF NOT EXISTS lead_extra_grants_request_agent_uq
  ON public.lead_extra_grants (request_id, agent_profile_id) WHERE request_id IS NOT NULL;
CREATE OR REPLACE FUNCTION public.block_extra_grant_mutation()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  RAISE EXCEPTION 'lead_extra_grants is append-only';
END $$;
DROP TRIGGER IF EXISTS lead_extra_grants_append_only ON public.lead_extra_grants;
CREATE TRIGGER lead_extra_grants_append_only
  BEFORE UPDATE OR DELETE ON public.lead_extra_grants
  FOR EACH ROW EXECUTE FUNCTION public.block_extra_grant_mutation();