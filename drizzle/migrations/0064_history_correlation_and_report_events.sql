ALTER TABLE public.lead_state_changes ADD COLUMN IF NOT EXISTS correlation_id uuid NOT NULL DEFAULT gen_random_uuid();
ALTER TABLE public.follow_up_changes ADD COLUMN IF NOT EXISTS correlation_id uuid NOT NULL DEFAULT gen_random_uuid();
CREATE UNIQUE INDEX IF NOT EXISTS lead_state_changes_correlation_uq ON public.lead_state_changes(correlation_id);
CREATE UNIQUE INDEX IF NOT EXISTS follow_up_changes_correlation_uq ON public.follow_up_changes(correlation_id);

CREATE OR REPLACE FUNCTION public.log_call_report_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NEW.lead_id IS NULL THEN RETURN NEW; END IF;
  IF TG_OP = 'INSERT' OR NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.lead_state_changes(lead_id, field, old_value, new_value, changed_by, source)
    VALUES (NEW.lead_id, 'report_status', CASE WHEN TG_OP = 'UPDATE' THEN OLD.status END, NEW.status,
      coalesce(auth.uid(), NEW.agent_id), 'call_report:' || NEW.id);
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.status = 'submitted' AND (NEW.category IS DISTINCT FROM OLD.category OR NEW.connected IS DISTINCT FROM OLD.connected) THEN
    INSERT INTO public.lead_state_changes(lead_id, field, old_value, new_value, changed_by, source)
    VALUES (NEW.lead_id, 'report_correction', OLD.category || '/' || OLD.connected, NEW.category || '/' || NEW.connected,
      coalesce(auth.uid(), NEW.agent_id), 'call_report:' || NEW.id);
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS call_reports_log_change ON public.call_reports;
CREATE TRIGGER call_reports_log_change AFTER INSERT OR UPDATE ON public.call_reports
FOR EACH ROW EXECUTE FUNCTION public.log_call_report_change();

CREATE OR REPLACE FUNCTION public.log_call_recording_created()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NEW.lead_id IS NOT NULL THEN
    INSERT INTO public.lead_state_changes(lead_id, field, old_value, new_value, changed_by, source)
    VALUES (NEW.lead_id, 'call_logged', NULL, NEW.id::text, coalesce(auth.uid(), NEW.agent_id), 'call_recording:' || NEW.id);
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS call_recordings_log_created ON public.call_recordings;
CREATE TRIGGER call_recordings_log_created AFTER INSERT ON public.call_recordings
FOR EACH ROW EXECUTE FUNCTION public.log_call_recording_created();