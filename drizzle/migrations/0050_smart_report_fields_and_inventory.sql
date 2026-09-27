CREATE TABLE public.inventory_requirements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 100,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX inventory_requirements_label_key ON public.inventory_requirements (lower(label));
GRANT ALL ON public.inventory_requirements TO service_role;
ALTER TABLE public.inventory_requirements ENABLE ROW LEVEL SECURITY;

INSERT INTO public.inventory_requirements (label, sort_order) VALUES
 ('Ready Flat', 10), ('Under Construction', 20), ('2 Bed', 30), ('3 Bed', 40),
 ('4 Bed', 50), ('Commercial', 60), ('Land', 70), ('Investment', 80);

ALTER TABLE public.call_reports
  ADD COLUMN interest text,
  ADD COLUMN requirement text,
  ADD COLUMN customer_response text,
  ADD COLUMN next_action text,
  ADD COLUMN no_follow_up_reason text,
  ADD COLUMN smart_reasons jsonb;