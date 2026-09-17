-- Speed up the daily lead distribution eligibility checks.
-- The four history tables had no index on lead_id, so every per-lead
-- history check did a full table scan; the eligibility filter repeats
-- those checks thousands of times per run and hit the statement timeout.

CREATE INDEX IF NOT EXISTS idx_lead_assignments_lead_id ON public.lead_assignments (lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_events_lead_id ON public.lead_events (lead_id);
CREATE INDEX IF NOT EXISTS idx_call_recordings_lead_id ON public.call_recordings (lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_phone_keys_lead_id ON public.lead_phone_keys (lead_id);

-- Same rules, rewritten so each lead's phone numbers are extracted once
-- instead of once per comparison. Behaviour is unchanged; it is only fast.
CREATE OR REPLACE FUNCTION public.filter_eligible_lead_ids(_lead_ids uuid[])
RETURNS TABLE(lead_id uuid)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  WITH target AS (
    SELECT l.id, p.phone
    FROM public.leads l
    CROSS JOIN LATERAL public.extract_bd_phones(l.phone_number) p(phone)
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
  ),
  worked_phones AS (
    SELECT hp.phone
    FROM public.leads h
    CROSS JOIN LATERAL public.extract_bd_phones(h.phone_number) hp(phone)
    WHERE public.lead_has_work_history(h.id)
  )
  SELECT DISTINCT t.id
  FROM target t
  WHERE NOT EXISTS (
    SELECT 1 FROM worked_phones wp WHERE wp.phone = t.phone
  )
$function$;