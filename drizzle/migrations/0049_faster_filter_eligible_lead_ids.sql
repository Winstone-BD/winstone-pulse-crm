CREATE OR REPLACE FUNCTION public.filter_eligible_lead_ids(_lead_ids uuid[])
 RETURNS TABLE(lead_id uuid)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
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
      AND NOT EXISTS (SELECT 1 FROM public.lead_assignments la WHERE la.lead_id = l.id)
      AND NOT EXISTS (SELECT 1 FROM public.call_reports cr WHERE cr.lead_id = l.id)
      AND NOT EXISTS (SELECT 1 FROM public.call_recordings rec WHERE rec.lead_id = l.id)
      AND NOT EXISTS (SELECT 1 FROM public.lead_events le WHERE le.lead_id = l.id)
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