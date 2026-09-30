CREATE TABLE IF NOT EXISTS public.lead_state_changes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL,
  field text NOT NULL,
  old_value text,
  new_value text,
  changed_by uuid,
  source text NOT NULL DEFAULT 'crm',
  changed_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.lead_state_changes TO service_role;
ALTER TABLE public.lead_state_changes ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS lead_state_changes_lead_idx ON public.lead_state_changes(lead_id, changed_at);

CREATE OR REPLACE FUNCTION public.block_history_mutation()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN RAISE EXCEPTION 'Lead history is append-only; add a correcting event instead'; END $$;

CREATE TRIGGER lead_state_changes_immutable BEFORE UPDATE OR DELETE ON public.lead_state_changes
FOR EACH ROW EXECUTE FUNCTION public.block_history_mutation();
CREATE TRIGGER lead_events_immutable BEFORE UPDATE OR DELETE ON public.lead_events
FOR EACH ROW EXECUTE FUNCTION public.block_history_mutation();

CREATE OR REPLACE FUNCTION public.log_lead_state_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _actor uuid := auth.uid();
BEGIN
  IF NEW.assigned_to IS DISTINCT FROM OLD.assigned_to THEN
    INSERT INTO public.lead_state_changes(lead_id, field, old_value, new_value, changed_by, source)
    VALUES (NEW.id, 'assigned_to', OLD.assigned_to::text, NEW.assigned_to::text, _actor, coalesce(NEW.assignment_source, 'crm'));
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.lead_state_changes(lead_id, field, old_value, new_value, changed_by)
    VALUES (NEW.id, 'status', OLD.status::text, NEW.status::text, _actor);
  END IF;
  IF NEW.work_state IS DISTINCT FROM OLD.work_state THEN
    INSERT INTO public.lead_state_changes(lead_id, field, old_value, new_value, changed_by)
    VALUES (NEW.id, 'work_state', OLD.work_state::text, NEW.work_state::text, _actor);
  END IF;
  IF NEW.temperature IS DISTINCT FROM OLD.temperature THEN
    INSERT INTO public.lead_state_changes(lead_id, field, old_value, new_value, changed_by)
    VALUES (NEW.id, 'temperature', OLD.temperature::text, NEW.temperature::text, _actor);
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER leads_log_state_change AFTER UPDATE ON public.leads
FOR EACH ROW EXECUTE FUNCTION public.log_lead_state_change();

CREATE INDEX IF NOT EXISTS lead_events_lead_time_idx ON public.lead_events(lead_id, created_at);
CREATE INDEX IF NOT EXISTS call_reports_lead_time_idx ON public.call_reports(lead_id, created_at);
CREATE INDEX IF NOT EXISTS call_recordings_lead_time_idx ON public.call_recordings(lead_id, created_at);
CREATE INDEX IF NOT EXISTS follow_up_events_lead_time_idx ON public.follow_up_events(lead_id, created_at);
CREATE INDEX IF NOT EXISTS call_reports_close_reason_idx ON public.call_reports(no_follow_up_reason) WHERE no_follow_up_reason IS NOT NULL;