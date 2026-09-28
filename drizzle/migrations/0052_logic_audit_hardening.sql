-- 1) Server-only helpers: not callable through the public API.
REVOKE EXECUTE ON FUNCTION public.lead_phone_status(text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.lead_phone_was_ever_worked(text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.lead_has_work_history(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.filter_eligible_lead_ids(uuid[]) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.claim_lead_phone_keys() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enforce_first_lead_assignment_eligibility() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.lead_phone_status(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.lead_phone_was_ever_worked(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.lead_has_work_history(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.filter_eligible_lead_ids(uuid[]) TO service_role;

-- 2) Customer leads are never hard-deleted.
DROP POLICY IF EXISTS "Admins can delete leads" ON public.leads;
CREATE OR REPLACE FUNCTION public.block_lead_delete() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN RAISE EXCEPTION 'Customer leads are never deleted — park them as duplicate_skipped instead'; END $$;
CREATE TRIGGER leads_no_delete BEFORE DELETE ON public.leads FOR EACH ROW EXECUTE FUNCTION public.block_lead_delete();

-- 3) Lead identity/provenance cannot be changed by agents through direct API writes.
CREATE OR REPLACE FUNCTION public.protect_lead_provenance() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NOT NULL
     AND NOT (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'team_leader'))
     AND (NEW.phone_number IS DISTINCT FROM OLD.phone_number
       OR NEW.reference_by IS DISTINCT FROM OLD.reference_by
       OR NEW.source IS DISTINCT FROM OLD.source
       OR NEW.created_at IS DISTINCT FROM OLD.created_at
       OR NEW.work_date IS DISTINCT FROM OLD.work_date
       OR NEW.assignment_source IS DISTINCT FROM OLD.assignment_source) THEN
    RAISE EXCEPTION 'Lead phone, source, reference and assignment history can only change through the CRM';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER leads_protect_provenance BEFORE UPDATE ON public.leads FOR EACH ROW EXECUTE FUNCTION public.protect_lead_provenance();

-- 4) Submitted call reports are final for agents' direct API writes.
CREATE OR REPLACE FUNCTION public.protect_submitted_report() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND OLD.status = 'submitted'
     AND NOT (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'team_leader')) THEN
    RAISE EXCEPTION 'A submitted call report can only be corrected through the CRM';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER call_reports_protect_submitted BEFORE UPDATE ON public.call_reports FOR EACH ROW EXECUTE FUNCTION public.protect_submitted_report();

-- 5) Agent note is optional (business rule); structured fields stay required.
CREATE OR REPLACE FUNCTION public.validate_call_report() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at = now();
  IF NEW.status = 'submitted' THEN
    IF NEW.category IS NULL OR NEW.category NOT IN (
      'hot_lead','follow_up','interested','not_interested','callback','no_answer','wrong_number','closed_converted'
    ) THEN
      RAISE EXCEPTION 'invalid or missing call report category';
    END IF;
    IF coalesce(btrim(NEW.summary), '') = '' THEN
      RAISE EXCEPTION 'call summary is required';
    END IF;
    IF NEW.category IN ('not_interested','wrong_number') AND coalesce(btrim(NEW.reason), '') = '' THEN
      RAISE EXCEPTION 'this category requires a reason';
    END IF;
    IF NEW.connected THEN
      IF NEW.temperature IS NULL OR NEW.temperature NOT IN ('hot','warm','cold') THEN
        RAISE EXCEPTION 'a received call requires a temperature classification';
      END IF;
      IF NEW.grade IS NULL OR NEW.grade NOT IN ('A','B','C','D') THEN
        RAISE EXCEPTION 'a received call requires a grade classification';
      END IF;
    END IF;
    IF NEW.submitted_at IS NULL THEN NEW.submitted_at = now(); END IF;
  END IF;
  RETURN NEW;
END $$;