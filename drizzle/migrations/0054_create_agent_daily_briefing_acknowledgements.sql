CREATE TABLE public.agent_briefing_acknowledgements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES public.profiles(id),
  business_date DATE NOT NULL,
  policy_version TEXT NOT NULL,
  acknowledged_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  source TEXT NOT NULL,
  CONSTRAINT agent_briefing_ack_source CHECK (source IN ('web', 'android')),
  CONSTRAINT agent_briefing_ack_unique UNIQUE (agent_id, business_date, policy_version)
);

GRANT ALL ON public.agent_briefing_acknowledgements TO service_role;

ALTER TABLE public.agent_briefing_acknowledgements ENABLE ROW LEVEL SECURITY;

CREATE INDEX agent_briefing_ack_agent_date_idx
  ON public.agent_briefing_acknowledgements (agent_id, business_date DESC);

CREATE OR REPLACE FUNCTION public.block_agent_briefing_ack_mutation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  RAISE EXCEPTION 'Daily briefing acknowledgements are immutable';
END;
$$;

CREATE TRIGGER agent_briefing_ack_no_update
BEFORE UPDATE ON public.agent_briefing_acknowledgements
FOR EACH ROW EXECUTE FUNCTION public.block_agent_briefing_ack_mutation();

CREATE TRIGGER agent_briefing_ack_no_delete
BEFORE DELETE ON public.agent_briefing_acknowledgements
FOR EACH ROW EXECUTE FUNCTION public.block_agent_briefing_ack_mutation();