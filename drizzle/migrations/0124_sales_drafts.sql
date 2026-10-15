CREATE TABLE public.sales_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL,
  lead_id uuid,
  workflow text NOT NULL CHECK (workflow IN ('followup_pair')),
  ai_output text NOT NULL,
  edited_output text,
  edited_at timestamptz,
  injection_flagged boolean NOT NULL DEFAULT false,
  model text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.sales_drafts TO service_role;
REVOKE ALL ON public.sales_drafts FROM anon, authenticated;
ALTER TABLE public.sales_drafts ENABLE ROW LEVEL SECURITY;
CREATE INDEX sales_drafts_agent_idx ON public.sales_drafts (agent_id, created_at DESC);