ALTER TABLE public.call_reports
  ADD COLUMN IF NOT EXISTS evaluation_answers jsonb,
  ADD COLUMN IF NOT EXISTS evaluation_score integer,
  ADD COLUMN IF NOT EXISTS evaluation_model text,
  ADD COLUMN IF NOT EXISTS follow_up_priority text,
  ADD COLUMN IF NOT EXISTS next_best_action text;
COMMENT ON COLUMN public.call_reports.evaluation_model IS 'v2_six_question = server-derived score; NULL/legacy = V1 history, never rescored';