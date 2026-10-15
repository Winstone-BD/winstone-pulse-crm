ALTER TABLE public.sales_drafts DROP CONSTRAINT IF EXISTS sales_drafts_workflow_check;
ALTER TABLE public.sales_drafts ADD CONSTRAINT sales_drafts_workflow_check CHECK (workflow IN ('followup_pair','negotiation','call_coach'));
CREATE TABLE public.objection_answers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  objection_key text NOT NULL UNIQUE,
  objection text NOT NULL,
  answer text NOT NULL,
  approved_by uuid,
  approved_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.objection_answers TO service_role;
REVOKE ALL ON public.objection_answers FROM anon, authenticated;
ALTER TABLE public.objection_answers ENABLE ROW LEVEL SECURITY;