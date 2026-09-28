CREATE TABLE public.agent_accountability_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  business_date date NOT NULL,
  unlock_for_date date NOT NULL,
  assigned_count integer NOT NULL DEFAULT 0,
  eligible_count integer NOT NULL DEFAULT 0,
  completed_count integer NOT NULL DEFAULT 0,
  pending_count integer NOT NULL DEFAULT 0,
  pending_percent numeric(5,1) NOT NULL DEFAULT 0,
  overdue_followups integer NOT NULL DEFAULT 0,
  missed_reports integer NOT NULL DEFAULT 0,
  trigger_reason text NOT NULL,
  evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'review_required' CHECK (status IN ('review_required','approved','hold')),
  reviewed_by text,
  reviewed_at timestamptz,
  approval_note text,
  review_history jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (agent_id, business_date)
);
GRANT ALL ON public.agent_accountability_reviews TO service_role;
ALTER TABLE public.agent_accountability_reviews ENABLE ROW LEVEL SECURITY;
CREATE INDEX agent_accountability_reviews_unlock_idx ON public.agent_accountability_reviews (agent_id, unlock_for_date);
CREATE TRIGGER agent_accountability_reviews_touch BEFORE UPDATE ON public.agent_accountability_reviews
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE OR REPLACE FUNCTION public.block_accountability_delete() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Accountability review history cannot be deleted'; END $$;
CREATE TRIGGER agent_accountability_reviews_no_delete BEFORE DELETE ON public.agent_accountability_reviews
  FOR EACH ROW EXECUTE FUNCTION public.block_accountability_delete();
COMMENT ON TABLE public.agent_accountability_reviews IS 'Daily pending-control reviews; server-only access. Never deleted.';