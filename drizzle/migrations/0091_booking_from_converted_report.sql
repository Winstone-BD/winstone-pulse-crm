CREATE OR REPLACE FUNCTION public.booking_from_converted_report()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'submitted' AND NEW.category = 'closed_converted' AND NEW.lead_id IS NOT NULL
     AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'submitted' OR OLD.category IS DISTINCT FROM 'closed_converted')
     AND NOT EXISTS (SELECT 1 FROM public.bookings b WHERE b.lead_id = NEW.lead_id AND b.status <> 'cancelled') THEN
    INSERT INTO public.bookings (lead_id, agent_id, booked_at, notes, created_by, approval_status)
    VALUES (NEW.lead_id, NEW.agent_id, COALESCE(NEW.submitted_at, now()),
            left('কল রিপোর্ট থেকে স্বয়ংক্রিয় (report ' || NEW.id || ')' || COALESCE(' — ' || NEW.requirement, ''), 500),
            'system:call_report', 'pending');
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.booking_from_converted_report() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER call_reports_auto_booking AFTER INSERT OR UPDATE OF status, category ON public.call_reports
FOR EACH ROW EXECUTE FUNCTION public.booking_from_converted_report();