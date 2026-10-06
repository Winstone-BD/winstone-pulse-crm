CREATE TABLE public.lead_neglect_notices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE RESTRICT,
  agent_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  assigned_at timestamptz NOT NULL,
  notice_day integer NOT NULL CHECK (notice_day BETWEEN 1 AND 3),
  business_date date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (lead_id, agent_id, assigned_at, notice_day)
);
GRANT ALL ON public.lead_neglect_notices TO service_role;
ALTER TABLE public.lead_neglect_notices ENABLE ROW LEVEL SECURITY;
CREATE INDEX lead_neglect_notices_agent_idx ON public.lead_neglect_notices (agent_id, business_date DESC);

CREATE TABLE public.lead_neglect_recalls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE RESTRICT,
  agent_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  assigned_at timestamptz NOT NULL,
  business_date date NOT NULL,
  reason text NOT NULL,
  evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  recalled_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (lead_id, agent_id, assigned_at)
);
GRANT ALL ON public.lead_neglect_recalls TO service_role;
ALTER TABLE public.lead_neglect_recalls ENABLE ROW LEVEL SECURITY;
CREATE INDEX lead_neglect_recalls_agent_idx ON public.lead_neglect_recalls (agent_id, recalled_at DESC);
CREATE INDEX lead_neglect_recalls_lead_idx ON public.lead_neglect_recalls (lead_id);

CREATE OR REPLACE FUNCTION public.block_neglect_mutation()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  RAISE EXCEPTION 'Lead neglect history is append-only';
END $$;
CREATE TRIGGER lead_neglect_notices_immutable BEFORE UPDATE OR DELETE ON public.lead_neglect_notices
  FOR EACH ROW EXECUTE FUNCTION public.block_neglect_mutation();
CREATE TRIGGER lead_neglect_recalls_immutable BEFORE UPDATE OR DELETE ON public.lead_neglect_recalls
  FOR EACH ROW EXECUTE FUNCTION public.block_neglect_mutation();

-- A recalled lead whose number was never actually worked (no call, report,
-- recording or call-type event) counts as fresh again for distribution.
CREATE OR REPLACE FUNCTION public.lead_is_recalled_untouched(_lead_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT EXISTS (SELECT 1 FROM public.lead_neglect_recalls r WHERE r.lead_id = _lead_id)
    AND EXISTS (
      SELECT 1 FROM public.leads l
      WHERE l.id = _lead_id
        AND coalesce(l.call_count, 0) = 0
        AND coalesce(l.call_attempts, 0) = 0
        AND l.last_call_at IS NULL
    )
    AND NOT EXISTS (SELECT 1 FROM public.call_reports cr WHERE cr.lead_id = _lead_id)
    AND NOT EXISTS (SELECT 1 FROM public.call_recordings rec WHERE rec.lead_id = _lead_id)
    AND NOT EXISTS (
      SELECT 1 FROM public.lead_events le
      WHERE le.lead_id = _lead_id
        AND le.kind NOT IN ('workday_moved', 'neglect_warning', 'neglect_recalled')
    )
$$;

CREATE OR REPLACE FUNCTION public.lead_has_work_history(_lead_id uuid)
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.leads l
    WHERE l.id = _lead_id
      AND (
        l.assigned_to IS NOT NULL
        OR l.assigned_agent_id IS NOT NULL
        OR coalesce(l.call_count, 0) > 0
        OR coalesce(l.call_attempts, 0) > 0
        OR l.last_call_at IS NOT NULL
        OR (NOT public.lead_is_recalled_untouched(l.id) AND (
             EXISTS (SELECT 1 FROM public.lead_assignments la WHERE la.lead_id = l.id)
          OR EXISTS (SELECT 1 FROM public.lead_events le WHERE le.lead_id = l.id)))
        OR EXISTS (SELECT 1 FROM public.call_reports cr WHERE cr.lead_id = l.id)
        OR EXISTS (SELECT 1 FROM public.call_recordings rec WHERE rec.lead_id = l.id)
      )
  )
$function$;

CREATE OR REPLACE FUNCTION public.filter_eligible_lead_ids(_lead_ids uuid[])
 RETURNS TABLE(lead_id uuid) LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  WITH target AS MATERIALIZED (
    SELECT l.id, p.phone
    FROM public.leads l
    CROSS JOIN LATERAL public.extract_bd_phones(l.phone_number) p(phone)
    WHERE l.id = ANY(_lead_ids)
      AND l.assigned_to IS NULL
      AND l.assigned_agent_id IS NULL
      AND coalesce(l.call_count, 0) = 0
      AND coalesce(l.call_attempts, 0) = 0
      AND l.last_call_at IS NULL
      AND NOT EXISTS (SELECT 1 FROM public.call_reports cr WHERE cr.lead_id = l.id)
      AND NOT EXISTS (SELECT 1 FROM public.call_recordings rec WHERE rec.lead_id = l.id)
      AND (
        public.lead_is_recalled_untouched(l.id)
        OR (NOT EXISTS (SELECT 1 FROM public.lead_assignments la WHERE la.lead_id = l.id)
            AND NOT EXISTS (SELECT 1 FROM public.lead_events le WHERE le.lead_id = l.id))
      )
  ),
  all_phones AS MATERIALIZED (
    SELECT h.id, hp.phone
    FROM public.leads h
    CROSS JOIN LATERAL public.extract_bd_phones(h.phone_number) hp(phone)
  ),
  candidates AS MATERIALIZED (
    SELECT DISTINCT a.id, a.phone
    FROM all_phones a
    JOIN (SELECT DISTINCT phone FROM target) tp ON tp.phone = a.phone
  ),
  worked_phones AS (
    SELECT DISTINCT c.phone FROM candidates c WHERE public.lead_has_work_history(c.id)
  )
  SELECT DISTINCT t.id
  FROM target t
  WHERE NOT EXISTS (SELECT 1 FROM worked_phones wp WHERE wp.phone = t.phone)
$function$;

-- Eligibility + never back to the agent it was recalled from.
CREATE OR REPLACE FUNCTION public.enforce_first_lead_assignment_eligibility()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  IF OLD.assigned_to IS NULL
     AND OLD.assigned_agent_id IS NULL
     AND (NEW.assigned_to IS NOT NULL OR NEW.assigned_agent_id IS NOT NULL) THEN
    IF NOT EXISTS (SELECT 1 FROM public.filter_eligible_lead_ids(ARRAY[NEW.id]) eligible) THEN
      RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'lead phone was previously assigned or worked';
    END IF;
    IF EXISTS (
      SELECT 1 FROM public.lead_neglect_recalls r
      WHERE r.lead_id = NEW.id
        AND r.agent_id = COALESCE(NEW.assigned_to, NEW.assigned_agent_id)
    ) THEN
      RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'lead was recalled from this agent for neglect';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;