ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS area text;

CREATE TABLE public.bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE RESTRICT,
  agent_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  project text,
  area text,
  amount_usd numeric(12,2) CHECK (amount_usd IS NULL OR amount_usd >= 0),
  booked_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'booked' CHECK (status IN ('booked','completed','cancelled')),
  notes text,
  created_by text NOT NULL,
  updated_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.bookings TO service_role;

ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;

CREATE INDEX bookings_booked_at_idx ON public.bookings (booked_at DESC);
CREATE INDEX bookings_lead_id_idx ON public.bookings (lead_id);

CREATE OR REPLACE FUNCTION public.block_booking_delete()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  RAISE EXCEPTION 'Bookings cannot be deleted; set status to cancelled';
END;
$$;

CREATE TRIGGER bookings_block_delete
  BEFORE DELETE ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.block_booking_delete();

CREATE OR REPLACE FUNCTION public.protect_booking_link()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.lead_id IS DISTINCT FROM OLD.lead_id OR NEW.created_by IS DISTINCT FROM OLD.created_by THEN
    RAISE EXCEPTION 'Booking lead link and creator are immutable';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER bookings_protect_link
  BEFORE UPDATE ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.protect_booking_link();

CREATE TRIGGER bookings_touch_updated_at
  BEFORE UPDATE ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();