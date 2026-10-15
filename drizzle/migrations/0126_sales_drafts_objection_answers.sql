CREATE TABLE IF NOT EXISTS public.sales_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL,
  lead_id uuid NOT NULL,
  workflow text NOT NULL,
  ai_output text NOT NULL,
  edited_output text,
  edited_at timestamptz,
  injection_flagged boolean NOT NULL DEFAULT false,
  model text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS sales_drafts_agent_idx ON public.sales_drafts (agent_id, created_at DESC);
GRANT ALL ON public.sales_drafts TO service_role;
ALTER TABLE public.sales_drafts ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.objection_answers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  objection_key text NOT NULL UNIQUE,
  objection text NOT NULL,
  answer text NOT NULL,
  approved_by uuid,
  approved_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.objection_answers TO service_role;
ALTER TABLE public.objection_answers ENABLE ROW LEVEL SECURITY;