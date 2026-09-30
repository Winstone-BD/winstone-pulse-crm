ALTER TABLE public.call_reports ADD COLUMN IF NOT EXISTS no_follow_up_note text;
ALTER TABLE public.follow_up_changes
  ADD COLUMN IF NOT EXISTS old_reason_code text,
  ADD COLUMN IF NOT EXISTS old_note text;

-- Contact close: a structured reason is mandatory on submit, and the close is
-- written to the immutable lead history (lead_events) with actor + time.
CREATE OR REPLACE FUNCTION public.enforce_contact_close_reason()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.status = 'submitted' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'submitted')
     AND NEW.follow_up_at IS NULL THEN
    IF NEW.no_follow_up_reason IS NULL OR NEW.no_follow_up_reason NOT IN (
      'not_interested','info_completed','converted','wrong_number','duplicate','no_contact','other','not_connected'
    ) THEN
      RAISE EXCEPTION 'contact close reason required';
    END IF;
    IF NEW.no_follow_up_reason = 'other' AND length(coalesce(trim(NEW.no_follow_up_note), '')) < 2 THEN
      RAISE EXCEPTION 'note required for other close reason';
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS call_reports_close_reason ON public.call_reports;
CREATE TRIGGER call_reports_close_reason BEFORE INSERT OR UPDATE ON public.call_reports
FOR EACH ROW EXECUTE FUNCTION public.enforce_contact_close_reason();

CREATE OR REPLACE FUNCTION public.log_contact_close()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NEW.status = 'submitted' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'submitted')
     AND NEW.follow_up_at IS NULL AND NEW.no_follow_up_reason IS NOT NULL THEN
    INSERT INTO public.lead_events(lead_id, agent_id, recording_id, kind, detail)
    VALUES (NEW.lead_id, NEW.agent_id, NEW.recording_id, 'contact_closed',
      jsonb_build_object('report_id', NEW.id, 'reason_code', NEW.no_follow_up_reason,
        'note', NEW.no_follow_up_note, 'at', coalesce(NEW.submitted_at, now()))::text);
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS call_reports_log_close ON public.call_reports;
CREATE TRIGGER call_reports_log_close AFTER INSERT OR UPDATE ON public.call_reports
FOR EACH ROW EXECUTE FUNCTION public.log_contact_close();

-- Follow-ups: every change (incl. cancel) logs old/new values; base rows can never be deleted.
CREATE OR REPLACE FUNCTION public.log_follow_up_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _action text;
BEGIN
  IF TG_OP = 'INSERT' THEN _action := 'created';
  ELSIF NEW.scheduled_at IS DISTINCT FROM OLD.scheduled_at THEN _action := 'rescheduled';
  ELSIF NEW.status IS DISTINCT FROM OLD.status THEN
    _action := CASE WHEN NEW.status IN ('done','completed') THEN 'completed'
                    WHEN NEW.status IN ('cancelled','canceled') THEN 'cancelled'
                    ELSE 'status_changed' END;
  ELSIF NEW.reason_code IS DISTINCT FROM OLD.reason_code OR NEW.note IS DISTINCT FROM OLD.note THEN _action := 'updated';
  ELSE RETURN NEW;
  END IF;
  INSERT INTO public.follow_up_changes(follow_up_id, lead_id, action, old_scheduled_at, new_scheduled_at,
    old_status, new_status, old_reason_code, reason_code, old_note, note, changed_by)
  VALUES (NEW.id, NEW.lead_id, _action,
    CASE WHEN TG_OP = 'UPDATE' THEN OLD.scheduled_at END, NEW.scheduled_at,
    CASE WHEN TG_OP = 'UPDATE' THEN OLD.status END, NEW.status,
    CASE WHEN TG_OP = 'UPDATE' THEN OLD.reason_code END, NEW.reason_code,
    CASE WHEN TG_OP = 'UPDATE' THEN OLD.note END, NEW.note,
    coalesce(auth.uid(), NEW.agent_id));
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.block_follow_up_delete()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN RAISE EXCEPTION 'Follow-ups are permanent; cancel instead of deleting'; END $$;

DROP TRIGGER IF EXISTS follow_up_events_no_delete ON public.follow_up_events;
CREATE TRIGGER follow_up_events_no_delete BEFORE DELETE ON public.follow_up_events
FOR EACH ROW EXECUTE FUNCTION public.block_follow_up_delete();