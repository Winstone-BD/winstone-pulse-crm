CREATE OR REPLACE FUNCTION public.normalize_bd_phone(_raw text)
RETURNS text
LANGUAGE sql
IMMUTABLE
STRICT
SET search_path = public
AS $$
  SELECT CASE
    WHEN digits ~ '^8801[3-9][0-9]{8}$' THEN digits
    WHEN digits ~ '^01[3-9][0-9]{8}$' THEN '88' || digits
    WHEN digits ~ '^1[3-9][0-9]{8}$' THEN '880' || digits
    ELSE NULL
  END
  FROM (SELECT regexp_replace(_raw, '[^0-9]', '', 'g') AS digits) s
$$;

CREATE OR REPLACE FUNCTION public.extract_bd_phones(_raw text)
RETURNS SETOF text
LANGUAGE sql
IMMUTABLE
STRICT
SET search_path = public
AS $$
  SELECT DISTINCT public.normalize_bd_phone(m[1])
  FROM regexp_matches(
    _raw,
    '(\+?8801[3-9][0-9]{8}|01[3-9][0-9]{8}|1[3-9][0-9]{8})',
    'g'
  ) AS matches(m)
  WHERE public.normalize_bd_phone(m[1]) IS NOT NULL
$$;

CREATE TABLE public.lead_phone_keys (
  canonical_phone text PRIMARY KEY,
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT lead_phone_keys_canonical_check CHECK (canonical_phone ~ '^8801[3-9][0-9]{8}$')
);
GRANT SELECT ON public.lead_phone_keys TO authenticated;
GRANT ALL ON public.lead_phone_keys TO service_role;
ALTER TABLE public.lead_phone_keys ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read lead phone keys"
ON public.lead_phone_keys FOR SELECT TO authenticated
USING (true);

CREATE INDEX lead_phone_keys_lead_id_idx ON public.lead_phone_keys(lead_id);

WITH candidate AS (
  SELECT
    p.canonical_phone,
    l.id AS lead_id,
    row_number() OVER (
      PARTITION BY p.canonical_phone
      ORDER BY
        CASE WHEN
          l.assigned_to IS NOT NULL
          OR l.assigned_agent_id IS NOT NULL
          OR coalesce(l.call_count, 0) > 0
          OR coalesce(l.call_attempts, 0) > 0
          OR l.last_call_at IS NOT NULL
          OR EXISTS (SELECT 1 FROM public.lead_assignments la WHERE la.lead_id = l.id)
          OR EXISTS (SELECT 1 FROM public.call_reports cr WHERE cr.lead_id = l.id)
          OR EXISTS (SELECT 1 FROM public.call_recordings rec WHERE rec.lead_id = l.id)
          OR EXISTS (SELECT 1 FROM public.lead_events le WHERE le.lead_id = l.id)
        THEN 0 ELSE 1 END,
        l.created_at,
        l.id
    ) AS priority
  FROM public.leads l
  CROSS JOIN LATERAL public.extract_bd_phones(l.phone_number) p(canonical_phone)
)
INSERT INTO public.lead_phone_keys(canonical_phone, lead_id)
SELECT canonical_phone, lead_id
FROM candidate
WHERE priority = 1;

CREATE OR REPLACE FUNCTION public.claim_lead_phone_keys()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _phone text;
  _owner uuid;
BEGIN
  FOR _phone IN SELECT * FROM public.extract_bd_phones(NEW.phone_number)
  LOOP
    SELECT lead_id INTO _owner
    FROM public.lead_phone_keys
    WHERE canonical_phone = _phone;

    IF _owner IS NOT NULL AND _owner IS DISTINCT FROM NEW.id THEN
      RAISE EXCEPTION USING
        ERRCODE = '23505',
        MESSAGE = 'normalized lead phone already exists',
        DETAIL = _phone;
    END IF;

    INSERT INTO public.lead_phone_keys(canonical_phone, lead_id)
    VALUES (_phone, NEW.id)
    ON CONFLICT (canonical_phone) DO NOTHING;
  END LOOP;

  IF NOT EXISTS (SELECT 1 FROM public.extract_bd_phones(NEW.phone_number)) THEN
    RAISE EXCEPTION USING
      ERRCODE = '22023',
      MESSAGE = 'no valid Bangladesh mobile phone found';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER leads_claim_phone_keys
AFTER INSERT OR UPDATE OF phone_number ON public.leads
FOR EACH ROW EXECUTE FUNCTION public.claim_lead_phone_keys();

CREATE OR REPLACE FUNCTION public.lead_has_work_history(_lead_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
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
        OR EXISTS (SELECT 1 FROM public.lead_assignments la WHERE la.lead_id = l.id)
        OR EXISTS (SELECT 1 FROM public.call_reports cr WHERE cr.lead_id = l.id)
        OR EXISTS (SELECT 1 FROM public.call_recordings rec WHERE rec.lead_id = l.id)
        OR EXISTS (SELECT 1 FROM public.lead_events le WHERE le.lead_id = l.id)
      )
  )
$$;

CREATE OR REPLACE FUNCTION public.lead_phone_was_ever_worked(_raw text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.extract_bd_phones(_raw) incoming(phone)
    JOIN public.leads l
      ON EXISTS (
        SELECT 1 FROM public.extract_bd_phones(l.phone_number) existing(phone)
        WHERE existing.phone = incoming.phone
      )
    WHERE public.lead_has_work_history(l.id)
  )
$$;

CREATE OR REPLACE FUNCTION public.lead_phone_status(_raw text)
RETURNS TABLE(canonical_phones text[], existing_lead_id uuid, already_worked boolean)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH phones AS (
    SELECT array_agg(phone ORDER BY phone) AS values
    FROM public.extract_bd_phones(_raw) p(phone)
  ), owner AS (
    SELECT k.lead_id
    FROM public.lead_phone_keys k, phones
    WHERE k.canonical_phone = ANY(coalesce(phones.values, ARRAY[]::text[]))
    ORDER BY k.created_at, k.lead_id
    LIMIT 1
  )
  SELECT
    coalesce(phones.values, ARRAY[]::text[]),
    owner.lead_id,
    public.lead_phone_was_ever_worked(_raw)
  FROM phones
  LEFT JOIN owner ON true
$$;

CREATE OR REPLACE FUNCTION public.filter_eligible_lead_ids(_lead_ids uuid[])
RETURNS TABLE(lead_id uuid)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT l.id
  FROM public.leads l
  WHERE l.id = ANY(_lead_ids)
    AND l.assigned_to IS NULL
    AND l.assigned_agent_id IS NULL
    AND coalesce(l.call_count, 0) = 0
    AND coalesce(l.call_attempts, 0) = 0
    AND l.last_call_at IS NULL
    AND NOT EXISTS (SELECT 1 FROM public.lead_assignments la WHERE la.lead_id = l.id)
    AND NOT EXISTS (SELECT 1 FROM public.call_reports cr WHERE cr.lead_id = l.id)
    AND NOT EXISTS (SELECT 1 FROM public.call_recordings rec WHERE rec.lead_id = l.id)
    AND NOT EXISTS (SELECT 1 FROM public.lead_events le WHERE le.lead_id = l.id)
    AND NOT EXISTS (
      SELECT 1
      FROM public.extract_bd_phones(l.phone_number) p(phone)
      JOIN public.leads historical
        ON historical.id <> l.id
       AND EXISTS (
         SELECT 1 FROM public.extract_bd_phones(historical.phone_number) hp(phone)
         WHERE hp.phone = p.phone
       )
      WHERE public.lead_has_work_history(historical.id)
    )
$$;

CREATE OR REPLACE FUNCTION public.enforce_first_lead_assignment_eligibility()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.assigned_to IS NULL
     AND OLD.assigned_agent_id IS NULL
     AND (NEW.assigned_to IS NOT NULL OR NEW.assigned_agent_id IS NOT NULL)
     AND NOT EXISTS (
       SELECT 1 FROM public.filter_eligible_lead_ids(ARRAY[NEW.id]) eligible
     ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'lead phone was previously assigned or worked';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER leads_first_assignment_eligibility
BEFORE UPDATE OF assigned_to, assigned_agent_id ON public.leads
FOR EACH ROW EXECUTE FUNCTION public.enforce_first_lead_assignment_eligibility();

REVOKE ALL ON FUNCTION public.lead_phone_status(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.filter_eligible_lead_ids(uuid[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.lead_phone_was_ever_worked(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.lead_has_work_history(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.lead_phone_status(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.filter_eligible_lead_ids(uuid[]) TO service_role;
GRANT EXECUTE ON FUNCTION public.lead_phone_was_ever_worked(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.lead_has_work_history(uuid) TO service_role;