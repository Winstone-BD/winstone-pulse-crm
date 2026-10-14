ALTER TABLE public.site_visits DROP CONSTRAINT site_visits_status_check;
ALTER TABLE public.site_visits ADD CONSTRAINT site_visits_status_check CHECK (status = ANY (ARRAY['scheduled','confirmed','completed','offer_made','cancelled','no_show']));
ALTER TABLE public.site_visits ADD COLUMN IF NOT EXISTS outcome text CHECK (outcome IS NULL OR length(outcome) <= 1000);
ALTER TABLE public.site_visits ADD COLUMN IF NOT EXISTS outcome_interest text CHECK (outcome_interest IS NULL OR outcome_interest IN ('hot','warm','cold','not_interested'));
ALTER TABLE public.site_visits ADD COLUMN IF NOT EXISTS outcome_at timestamptz;
ALTER TABLE public.site_visits ADD COLUMN IF NOT EXISTS outcome_by text;