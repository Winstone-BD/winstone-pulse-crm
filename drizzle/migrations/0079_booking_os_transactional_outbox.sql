CREATE OR REPLACE FUNCTION public.queue_booking_os_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  bridge_event text;
  event_key text;
BEGIN
  IF TG_OP = 'INSERT' THEN
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
    NEW.agent_id,
    event_key,
    'crm_to_os_' || bridge_event,
    'booking',
    NEW.id::text,
    jsonb_build_object(
      'booking_id', NEW.id,
      'lead_id', NEW.lead_id,
      'project', NEW.project,
      'area', NEW.area,
      'amount_usd', NEW.amount_usd,
      'booked_at', NEW.booked_at,
      'status', NEW.status
    ),
    'queued'
  );
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.queue_booking_os_event() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.queue_booking_os_event() TO service_role;

CREATE TRIGGER bookings_queue_os_event
  AFTER INSERT OR UPDATE OF status ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.queue_booking_os_event();

COMMENT ON FUNCTION public.queue_booking_os_event() IS
  'Transactionally records CRM booking changes in the existing sync_events outbox; delivery remains blocked until a real OS endpoint contract is configured.';