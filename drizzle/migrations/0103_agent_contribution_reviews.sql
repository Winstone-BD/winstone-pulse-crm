CREATE TABLE public.agent_contribution_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid NOT NULL REFERENCES public.agent_daily_contributions(id),
  reviewer text NOT NULL,
  note text CHECK (note IS NULL OR char_length(note) <= 500),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX agent_contribution_reviews_report_idx ON public.agent_contribution_reviews(report_id, created_at DESC);
GRANT ALL ON public.agent_contribution_reviews TO service_role;
ALTER TABLE public.agent_contribution_reviews ENABLE ROW LEVEL SECURITY;
COMMENT ON TABLE public.agent_contribution_reviews IS 'Server-only, append-only HQ reviews of agent contribution reports.';
CREATE TRIGGER agent_contribution_reviews_immutable BEFORE UPDATE OR DELETE ON public.agent_contribution_reviews
  FOR EACH ROW EXECUTE FUNCTION public.block_history_mutation();