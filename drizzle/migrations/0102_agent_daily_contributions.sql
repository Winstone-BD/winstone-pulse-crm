CREATE TABLE public.agent_daily_contributions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL REFERENCES public.profiles(id),
  business_date date NOT NULL,
  kind text NOT NULL CHECK (kind IN ('since_joining','daily')),
  summary text NOT NULL CHECK (char_length(summary) BETWEEN 20 AND 1500),
  source text NOT NULL DEFAULT 'web',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (agent_id, business_date)
);
GRANT ALL ON public.agent_daily_contributions TO service_role;
ALTER TABLE public.agent_daily_contributions ENABLE ROW LEVEL SECURITY;
COMMENT ON TABLE public.agent_daily_contributions IS 'Server-only, append-only 5:20 PM agent contribution reports.';
CREATE TRIGGER agent_daily_contributions_immutable BEFORE UPDATE OR DELETE ON public.agent_daily_contributions
  FOR EACH ROW EXECUTE FUNCTION public.block_history_mutation();