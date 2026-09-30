ALTER TABLE public.follow_up_events
  ADD COLUMN IF NOT EXISTS reason_code text,
  ADD COLUMN IF NOT EXISTS previous_call_id uuid,
  ADD COLUMN IF NOT EXISTS customer_response text,
  ADD COLUMN IF NOT EXISTS next_action text,
  ADD COLUMN IF NOT EXISTS reschedule_count integer NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS public.follow_up_changes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  follow_up_id uuid NOT NULL,
  lead_id uuid,
  action text NOT NULL,
  old_scheduled_at timestamptz,
  new_scheduled_at timestamptz,
  old_status text,
  new_status text,
  reason_code text,
  note text,
  changed_by uuid,
  changed_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.follow_up_changes TO service_role;
ALTER TABLE public.follow_up_changes ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS follow_up_changes_lead_idx ON public.follow_up_changes(lead_id, changed_at);

CREATE OR REPLACE FUNCTION public.block_follow_up_change_mutation()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN RAISE EXCEPTION 'Follow-up history is permanent'; END $$;

CREATE TRIGGER follow_up_changes_immutable BEFORE UPDATE OR DELETE ON public.follow_up_changes
FOR EACH ROW EXECUTE FUNCTION public.block_follow_up_change_mutation();

CREATE OR REPLACE FUNCTION public.validate_follow_up_reason()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.reason_code IS NOT NULL AND NEW.reason_code NOT IN (
    'callback','price','project_details','brochure','payment','location','family','more_time','site_visit','call_later','agent_send_info','other'
  ) THEN RAISE EXCEPTION 'invalid follow-up reason'; END IF;
  IF TG_OP = 'UPDATE' AND NEW.scheduled_at IS DISTINCT FROM OLD.scheduled_at THEN
    NEW.reschedule_count := coalesce(OLD.reschedule_count, 0) + 1;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER follow_up_events_reason BEFORE INSERT OR UPDATE ON public.follow_up_events
FOR EACH ROW EXECUTE FUNCTION public.validate_follow_up_reason();

CREATE OR REPLACE FUNCTION public.log_follow_up_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _action text;
BEGIN
  IF TG_OP = 'INSERT' THEN _action := 'created';
  ELSIF NEW.scheduled_at IS DISTINCT FROM OLD.scheduled_at THEN _action := 'rescheduled';
  ELSIF NEW.status IS DISTINCT FROM OLD.status THEN _action := CASE WHEN NEW.status IN ('done','completed') THEN 'completed' ELSE 'status_changed' END;
  ELSIF NEW.reason_code IS DISTINCT FROM OLD.reason_code OR NEW.note IS DISTINCT FROM OLD.note THEN _action := 'updated';
  ELSE RETURN NEW;
  END IF;
  INSERT INTO public.follow_up_changes(follow_up_id, lead_id, action, old_scheduled_at, new_scheduled_at, old_status, new_status, reason_code, note, changed_by)
  VALUES (NEW.id, NEW.lead_id, _action,
    CASE WHEN TG_OP = 'UPDATE' THEN OLD.scheduled_at END, NEW.scheduled_at,
    CASE WHEN TG_OP = 'UPDATE' THEN OLD.status END, NEW.status,
    NEW.reason_code, NEW.note, coalesce(auth.uid(), NEW.agent_id));
  RETURN NEW;
END $$;

CREATE TRIGGER follow_up_events_log AFTER INSERT OR UPDATE ON public.follow_up_events
FOR EACH ROW EXECUTE FUNCTION public.log_follow_up_change();