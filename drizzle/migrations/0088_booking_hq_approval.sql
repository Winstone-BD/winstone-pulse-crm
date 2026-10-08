ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS approval_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS reviewed_by text,
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS review_note text;

ALTER TABLE public.bookings DROP CONSTRAINT IF EXISTS bookings_approval_status_check;
ALTER TABLE public.bookings ADD CONSTRAINT bookings_approval_status_check
  CHECK (approval_status IN ('pending','approved','rejected'));

-- Only HQ-approved bookings reach Winstone OS. Approval sends booking.created;
-- later status changes are relayed only for approved bookings. Rejected never leave the CRM.
CREATE OR REPLACE FUNCTION public.queue_booking_os_event()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  bridge_event text;
  event_key text;
BEGIN
  IF NEW.approval_status IS DISTINCT FROM 'approved' THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'INSERT' OR OLD.approval_status IS DISTINCT FROM 'approved' THEN
    bridge_event := 'booking.created';
  ELSIF NEW.status = 'cancelled' AND OLD.status IS DISTINCT FROM NEW.status THEN
    bridge_event := 'booking.cancelled';
  ELSIF OLD.status IS DISTINCT FROM NEW.status THEN
    bridge_event := 'booking.updated';
  ELSE
    RETURN NEW;
  END IF;

  event_key := 'crm-booking:' || NEW.id::text || ':' || bridge_event || ':' || gen_random_uuid()::text;
  INSERT INTO public.sync_events (
    agent_id, idempotency_key, event_type, entity_type, entity_id, payload, status
  ) VALUES (
    NEW.agent_id, event_key, 'crm_to_os_' || bridge_event, 'booking', NEW.id::text,
    jsonb_build_object(
      'booking_id', NEW.id, 'lead_id', NEW.lead_id, 'project', NEW.project, 'area', NEW.area,
      'amount_usd', NEW.amount_usd, 'booked_at', NEW.booked_at, 'status', NEW.status
    ),
    'queued'
  );
  RETURN NEW;
END;
$function$;

-- A reviewed decision is final: approved/rejected cannot be flipped back.
CREATE OR REPLACE FUNCTION public.protect_booking_review()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  IF OLD.approval_status <> 'pending' AND NEW.approval_status IS DISTINCT FROM OLD.approval_status THEN
    RAISE EXCEPTION 'Booking review decision is final';
  END IF;
  IF NEW.approval_status = 'rejected' AND NEW.status IS DISTINCT FROM OLD.status AND OLD.approval_status = 'rejected' THEN
    RAISE EXCEPTION 'Rejected bookings cannot change status';
  END IF;
  RETURN NEW;
END $function$;

DROP TRIGGER IF EXISTS bookings_protect_review ON public.bookings;
CREATE TRIGGER bookings_protect_review BEFORE UPDATE ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.protect_booking_review();