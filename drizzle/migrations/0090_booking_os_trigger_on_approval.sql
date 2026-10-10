DROP TRIGGER IF EXISTS bookings_queue_os_event ON public.bookings;
CREATE TRIGGER bookings_queue_os_event
  AFTER INSERT OR UPDATE OF status, approval_status ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.queue_booking_os_event();