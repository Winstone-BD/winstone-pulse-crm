CREATE TABLE public.ai_summary_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL CHECK (kind IN ('upload','kb','drive')),
  content_hash text NOT NULL,
  summary jsonb NOT NULL,
  model text NOT NULL,
  created_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (kind, content_hash)
);
GRANT ALL ON public.ai_summary_cache TO service_role;
ALTER TABLE public.ai_summary_cache ENABLE ROW LEVEL SECURITY;